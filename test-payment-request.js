/**
 * Test script to verify Klarna payment request creation
 * Run with: node test-payment-request.js
 */

const axios = require('axios');
require('dotenv').config();

const KLARNA_API_KEY = process.env.KLARNA_API_KEY;
const KLARNA_API_URL = process.env.KLARNA_API_URL || 'https://api-global.test.klarna.com';

async function testPaymentRequest() {
    try {
        console.log('🧪 Testing Klarna Payment Request Creation...\n');
        console.log('Configuration:');
        console.log('  API URL:', KLARNA_API_URL);
        console.log('  API Key:', KLARNA_API_KEY ? `${KLARNA_API_KEY.substring(0, 20)}...` : 'NOT SET');
        console.log('');

        if (!KLARNA_API_KEY) {
            throw new Error('KLARNA_API_KEY environment variable is not set');
        }

        // Prepare payload (minimal as per API specs)
        const payload = {
            currency: 'EUR',
            amount: 1590, // 15.90 EUR in cents
            customer_interaction_config: {
                method: 'HANDOVER',
                return_url: 'https://paytrail-payment-api-demo.vercel.app/payment-success?paymentRequestId={klarna.payment_request.id}'
            }
        };

        console.log('📤 Request Payload:');
        console.log(JSON.stringify(payload, null, 2));
        console.log('');

        // Create Basic Auth header
        const auth = Buffer.from(`${KLARNA_API_KEY}:`).toString('base64');
        const endpointUrl = `${KLARNA_API_URL}/v2/payment/requests`;

        console.log('📤 Endpoint:', endpointUrl);
        console.log('');

        // Make the request
        const response = await axios({
            method: 'POST',
            url: endpointUrl,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            data: payload
        });

        console.log('✅ SUCCESS!');
        console.log('Response Status:', response.status);
        console.log('');
        console.log('📥 Response Data:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');
        console.log('✅ Payment Request ID:', response.data.payment_request_id);
        console.log('✅ State:', response.data.state);

    } catch (error) {
        console.error('❌ ERROR:');
        console.error('Message:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received. Request details:', error.request);
        } else {
            console.error('Error details:', error);
        }
        process.exit(1);
    }
}

testPaymentRequest();
