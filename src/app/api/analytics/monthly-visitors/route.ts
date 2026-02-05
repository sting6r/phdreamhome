import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

// Initialize the client with credentials from environment variables
// GA_SERVICE_ACCOUNT_CREDENTIALS should be the stringified JSON of the service account key
// GA_PROPERTY_ID should be your Google Analytics 4 property ID
export async function GET() {
  const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
  const propertyId = process.env.GA_PROPERTY_ID;
  let credentials = null;
  
  try {
    if (process.env.GA_SERVICE_ACCOUNT_CREDENTIALS) {
      credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_CREDENTIALS);
    }
  } catch (e) {
    console.warn("Failed to parse GA_SERVICE_ACCOUNT_CREDENTIALS, using fallback data. Check if it's valid JSON and single-line in .env");
  }

  const analyticsDataClient = credentials 
    ? new BetaAnalyticsDataClient({ credentials }) 
    : null;

  if (!analyticsDataClient || !propertyId) {
    console.log('Google Analytics credentials not found, returning fallback data');
    // Fallback data if GA is not configured yet
    return NextResponse.json([
      { name: "Jan", visitors: 4500 },
      { name: "Feb", visitors: 5200 },
      { name: "Mar", visitors: 4800 },
      { name: "Apr", visitors: 6100 },
      { name: "May", visitors: 5900 },
      { name: "Jun", visitors: 7200 },
      { name: "Jul", visitors: 8100 },
      { name: "Aug", visitors: 7800 },
      { name: "Sep", visitors: 8500 },
      { name: "Oct", visitors: 9200 },
      { name: "Nov", visitors: 10500 },
      { name: "Dec", visitors: 12000 },
    ]);
  }

  try {
    const [response] = await Promise.race([
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: '2026-01-01',
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
      timeout(5000)
    ]) as any; // Type assertion needed for Promise.race result mixed with timeout

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    interface FormattedEntry {
      name: string;
      visitors: number;
      monthIndex: number;
    }
    
    const formattedData = ((response.rows?.map((row: any) => {
      const monthIndex = parseInt(row.dimensionValues?.[0]?.value || '1') - 1;
      return {
        name: monthNames[monthIndex],
        visitors: parseInt(row.metricValues?.[0]?.value || '0'),
        monthIndex,
      };
    }) || []) as FormattedEntry[]).sort((a, b) => a.monthIndex - b.monthIndex);

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching GA data:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
