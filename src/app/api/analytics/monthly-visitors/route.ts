import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

// Initialize the client with credentials from environment variables
// GA_SERVICE_ACCOUNT_CREDENTIALS should be the stringified JSON of the service account key
// GA_PROPERTY_ID should be your Google Analytics 4 property ID
export async function GET() {
  const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
  const propertyId = process.env.GA_PROPERTY_ID;
  const credentialsJson = process.env.GA_SERVICE_ACCOUNT_CREDENTIALS;

  if (!propertyId || !credentialsJson) {
    console.error("Missing GA environment variables", { propertyId: !!propertyId, credentials: !!credentialsJson });
    return NextResponse.json({ error: "Analytics configuration missing" }, { status: 500 });
  }

  let credentials;
  try {
    // Attempt to parse directly, then try to handle potential multi-line/unquoted issues
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (e) {
      // If it fails, it might be because it's stored as a multi-line string in .env without proper escaping
      // We can try to reconstruct it if it looks like the start of a JSON object
      if (credentialsJson.trim().startsWith('{')) {
        // This is a common issue with multi-line env vars in some environments
        console.warn("GA_SERVICE_ACCOUNT_CREDENTIALS failed standard JSON.parse, attempting reconstruction");
        // Replace newlines that are NOT inside the private key string with nothing, 
        // but this is risky. A better approach for the user is to provide it as a single line.
        throw e; 
      }
      throw e;
    }
  } catch (error) {
    console.error("Failed to parse GA_SERVICE_ACCOUNT_CREDENTIALS. Ensure it is a single-line stringified JSON in .env", error);
    return NextResponse.json({ error: "Invalid analytics credentials format" }, { status: 500 });
  }

  const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });

  try {
    // Determine the start date based on today
    const now = new Date();
    const currentYear = now.getFullYear();
    const startDate = `${currentYear}-01-01`;

    const [response] = await Promise.race([
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: startDate,
            endDate: 'today',
          },
        ],
        dimensions: [
          {
            name: 'month',
          },
        ],
        metrics: [
          {
            name: 'activeUsers',
          },
        ],
        orderBys: [
          {
            dimension: {
              dimensionName: 'month',
            },
          },
        ],
      }),
      timeout(20000) // Increased timeout to 20s for potentially slow GA response
    ]) as any;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    interface FormattedEntry {
      name: string;
      visitors: number;
      monthIndex: number;
    }
    
    // Safety check for response.rows
    if (!response || !response.rows || response.rows.length === 0) {
      console.warn("GA response has no rows. Returning empty array.");
      return NextResponse.json([]);
    }

    const formattedData = ((response.rows.map((row: any) => {
      const monthStr = row.dimensionValues?.[0]?.value || '01';
      const monthIndex = parseInt(monthStr) - 1;
      const visitors = parseInt(row.metricValues?.[0]?.value || '0');
      
      return {
        name: monthNames[monthIndex] || monthStr,
        visitors: isNaN(visitors) ? 0 : visitors,
        monthIndex,
      };
    })) as FormattedEntry[]).sort((a, b) => a.monthIndex - b.monthIndex);

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('Error fetching GA data:', error);
    
    // Check for permission denied error and provide helpful info
    if (error.message?.includes('PERMISSION_DENIED') || error.code === 7) {
      const clientEmail = credentials?.client_email || 'unknown service account email';
      console.error(`GA Permission Denied: Please add the service account email "${clientEmail}" to your Google Analytics Property ID "${propertyId}" with at least "Viewer" role.`);
      return NextResponse.json({ 
        error: 'Permission denied in Google Analytics', 
        details: `Service account ${clientEmail} needs access to property ${propertyId}`,
        serviceAccountEmail: clientEmail
      }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
