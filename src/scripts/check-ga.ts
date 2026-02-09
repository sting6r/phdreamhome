import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkGA() {
  const propertyId = process.env.GA_PROPERTY_ID;
  const credentialsJson = process.env.GA_SERVICE_ACCOUNT_CREDENTIALS;

  console.log('--- Google Analytics Connectivity Check ---');
  
  if (!propertyId) {
    console.error('❌ Error: GA_PROPERTY_ID is missing in .env');
    return;
  }
  console.log(`✅ GA_PROPERTY_ID found: ${propertyId}`);

  if (!credentialsJson) {
    console.error('❌ Error: GA_SERVICE_ACCOUNT_CREDENTIALS is missing in .env');
    return;
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
    console.log(`✅ GA_SERVICE_ACCOUNT_CREDENTIALS is valid JSON`);
    console.log(`ℹ️ Service Account Email: ${credentials.client_email}`);
  } catch (e) {
    console.error('❌ Error: GA_SERVICE_ACCOUNT_CREDENTIALS is not valid JSON.');
    console.log('\n--- DIAGNOSIS ---');
    console.log('Your .env file has the credentials spread over multiple lines.');
    console.log('Environment variables in .env MUST be on a single line.');
    
    console.log('\n--- HOW TO FIX ---');
    console.log('1. Open your .env file.');
    console.log('2. Find the GA_SERVICE_ACCOUNT_CREDENTIALS= line.');
    console.log('3. Remove all newlines and spaces so that the entire JSON { "type": ... } is on ONE SINGLE LINE.');
    console.log('4. It should look like this:');
    console.log('   GA_SERVICE_ACCOUNT_CREDENTIALS={"type":"service_account",...}');
    return;
  }

  const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });

  try {
    console.log('⏳ Attempting to fetch a simple report...');
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    });

    console.log('✅ Success! GA connectivity is working.');
    console.log(`📊 Active users in last 7 days: ${response.rows?.[0]?.metricValues?.[0]?.value || 0}`);
  } catch (error: any) {
    console.error('❌ Error fetching GA data:');
    if (error.message?.includes('PERMISSION_DENIED') || error.code === 7) {
      console.error(`   Status: PERMISSION_DENIED (Code 7)`);
      console.error(`   Reason: The service account email "${credentials.client_email}" does not have access to Property ID "${propertyId}".`);
      console.log('\n--- HOW TO FIX ---');
      console.log('1. Go to Google Analytics (https://analytics.google.com/)');
      console.log('2. Click Admin (gear icon) in the bottom left.');
      console.log('3. In the Property column, click "Property Access Management".');
      console.log('4. Click the blue "+" button and "Add users".');
      console.log(`5. Enter the email: ${credentials.client_email}`);
      console.log('6. Assign the "Viewer" role.');
      console.log('7. Click "Add".');
    } else {
      console.error(`   ${error.message}`);
    }
  }
}

checkGA();
