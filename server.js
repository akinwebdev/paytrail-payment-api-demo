const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for demo purposes
}));
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
    if (req.path.includes('documentation') || req.path.includes('api-documentation')) {
        console.log('🔍 Request received:', req.method, req.path, req.url);
    }
    next();
});

// Paytrail API configuration
const PAYTRAIL_API_URL = process.env.PAYTRAIL_API_URL || 'https://services.paytrail.com';
const MERCHANT_ID = process.env.PAYTRAIL_MERCHANT_ID;
const SECRET_KEY = process.env.PAYTRAIL_SECRET_KEY;

// Validate required environment variables
if (!MERCHANT_ID || !SECRET_KEY) {
    console.error('❌ Error: PAYTRAIL_MERCHANT_ID and PAYTRAIL_SECRET_KEY environment variables are required');
    process.exit(1);
}

// Utility function to create HMAC signature for Paytrail API
function createPaytrailSignature(method, uri, headers, body = '') {
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomUUID();
    
    // Headers that need to be included in signature (Paytrail format)
    const signatureHeaders = {
        'checkout-account': MERCHANT_ID,
        'checkout-algorithm': 'sha256',
        'checkout-method': method,
        'checkout-nonce': nonce,
        'checkout-timestamp': timestamp
    };

    // Add request-specific headers
    Object.assign(signatureHeaders, headers);

    // Create signature string according to Paytrail format
    const signatureString = Object.keys(signatureHeaders)
        .sort()
        .map(key => `${key}:${signatureHeaders[key]}`)
        .join('\n') + '\n' + body;

    // Create HMAC signature
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(signatureString)
        .digest('hex');

    return {
        headers: signatureHeaders,
        signature
    };
}

// Function to make authenticated request to Paytrail API
async function makePaytrailRequest(method, endpoint, body = null) {
    const axios = require('axios');
    
    const bodyString = body ? JSON.stringify(body) : '';
    const { headers, signature } = createPaytrailSignature(method, endpoint, {}, bodyString);
    
    const requestHeaders = {
        ...headers,
        'signature': signature,
        'content-type': 'application/json; charset=utf-8'
    };

    console.log(`Making ${method} request to: ${PAYTRAIL_API_URL}${endpoint}`);
    console.log('Request headers:', requestHeaders);
    
    // Log request payload for POST requests
    if (method === 'POST' && body) {
        console.log('Request payload sent to Paytrail:', JSON.stringify(body, null, 2));
    }

    try {
        const response = await axios({
            method: method,
            url: `${PAYTRAIL_API_URL}${endpoint}`,
            headers: requestHeaders,
            data: bodyString || undefined
        });

        // Log raw response from Paytrail API
        console.log('Raw response from Paytrail API:');
        console.log(JSON.stringify(response.data, null, 2));

        return response.data;
    } catch (error) {
        console.error('Paytrail API Error:', error.response?.data || error.message);
        throw error;
    }
}

// Serve documentation page (register early to ensure it's matched)
app.get('/documentation', (req, res) => {
    console.log('📚 Documentation route hit - Path:', req.path, 'URL:', req.url, 'Method:', req.method);
    const docPath = path.join(__dirname, 'documentation.html');
    console.log('Sending file from:', docPath);
    console.log('__dirname is:', __dirname);
    
    // Set content type explicitly
    res.type('text/html');
    res.sendFile(docPath, (err) => {
        if (err) {
            console.error('❌ Error serving documentation:', err);
            console.error('File path attempted:', docPath);
            // List files in __dirname for debugging
            const fs = require('fs');
            try {
                const files = fs.readdirSync(__dirname);
                console.error('Files in __dirname:', files);
            } catch (e) {
                console.error('Error reading __dirname:', e.message);
            }
            res.status(500).json({ error: 'Failed to serve documentation', message: err.message, path: docPath });
        } else {
            console.log('✅ Documentation served successfully');
        }
    });
});

// Handle trailing slash
app.get('/documentation/', (req, res) => {
    console.log('📚 Documentation route hit (trailing slash)');
    res.redirect(301, '/documentation');
});

// Serve markdown files and assets for documentation (must be early)
// Use app.use to catch all requests to this path
app.use('/api-documentation_rev1/docs', (req, res) => {
    // Get the file path from req.path (Express removes the matched prefix)
    let requestedPath = req.path;
    if (requestedPath.startsWith('/')) {
        requestedPath = requestedPath.substring(1); // Remove leading slash
    }
    const filePath = path.join(__dirname, 'api-documentation_rev1', 'docs', requestedPath);
    
    console.log('📄 Serving documentation file - req.path:', req.path, 'req.url:', req.url);
    console.log('Requested path:', requestedPath);
    console.log('Full path:', filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    
    // Set appropriate content type
    if (ext === '.md') {
        res.type('text/markdown');
    } else if (ext === '.svg') {
        res.type('image/svg+xml');
    } else if (ext === '.png') {
        res.type('image/png');
    } else if (ext === '.jpg' || ext === '.jpeg') {
        res.type('image/jpeg');
    } else if (ext === '.css') {
        res.type('text/css');
    } else if (ext === '.yaml' || ext === '.yml') {
        res.type('text/yaml');
    }
    
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('❌ Error serving documentation file:', err.message);
            console.error('Requested path:', requestedPath);
            console.error('File path:', filePath);
            // List files for debugging
            const fs = require('fs');
            try {
                const docsDir = path.join(__dirname, 'api-documentation_rev1', 'docs');
                if (fs.existsSync(docsDir)) {
                    const files = fs.readdirSync(docsDir);
                    console.error('Files in docs directory:', files);
                } else {
                    console.error('Docs directory does not exist:', docsDir);
                }
            } catch (e) {
                console.error('Error reading docs directory:', e.message);
            }
            res.status(404).json({ error: 'File not found', path: requestedPath, fullPath: filePath });
        } else {
            console.log('✅ Documentation file served:', requestedPath);
        }
    });
});

// GET /merchants/payment-providers
app.get('/api/merchants/payment-providers', async (req, res) => {
    try {
        console.log('🔄 Fetching payment providers from Paytrail API...');
        
        const response = await makePaytrailRequest('GET', '/merchants/payment-providers');
        
        console.log('✅ Payment providers fetched successfully from Paytrail');
        res.json(response);
    } catch (error) {
        console.error('❌ Error fetching payment providers:', error.message);
        
        // If API call fails, return error details
        const errorResponse = {
            error: 'Failed to fetch payment providers from Paytrail API',
            message: error.response?.data?.message || error.message,
            status: error.response?.status || 500,
            timestamp: new Date().toISOString()
        };
        
        res.status(error.response?.status || 500).json(errorResponse);
    }
});

// GET /merchants/grouped-payment-providers
app.get('/api/merchants/grouped-payment-providers', async (req, res) => {
    try {
        console.log('🔄 Fetching grouped payment providers from Paytrail API...');
        
        const response = await makePaytrailRequest('GET', '/merchants/grouped-payment-providers');
        
        console.log('✅ Grouped payment providers fetched successfully from Paytrail');
        res.json(response);
    } catch (error) {
        console.error('❌ Error fetching grouped payment providers:', error.message);
        
        // If API call fails, return error details
        const errorResponse = {
            error: 'Failed to fetch grouped payment providers from Paytrail API',
            message: error.response?.data?.message || error.message,
            status: error.response?.status || 500,
            timestamp: new Date().toISOString()
        };
        
        res.status(error.response?.status || 500).json(errorResponse);
    }
});

// POST /payments
app.post('/api/payments', async (req, res) => {
    try {
        console.log('🔄 Creating payment with Paytrail API...');
        console.log('Payment data received:', JSON.stringify(req.body, null, 2));
        
        const paymentData = req.body;
        
        // Validate required fields for Paytrail API
        const requiredFields = ['stamp', 'reference', 'amount', 'currency', 'items', 'customer', 'redirectUrls'];
        const missingFields = requiredFields.filter(field => !paymentData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                missing: missingFields,
                timestamp: new Date().toISOString()
            });
        }

        // Make real API call to Paytrail
        const response = await makePaytrailRequest('POST', '/payments', paymentData);
        
        console.log('✅ Payment created successfully with Paytrail');
        res.status(201).json(response);
    } catch (error) {
        console.error('❌ Error creating payment:', error.message);
        
        // If API call fails, return error details
        const errorResponse = {
            error: 'Failed to create payment with Paytrail API',
            message: error.response?.data?.message || error.message,
            status: error.response?.status || 500,
            details: error.response?.data || null,
            timestamp: new Date().toISOString()
        };
        
        res.status(error.response?.status || 500).json(errorResponse);
    }
});

// Serve static files (HTML, CSS, JS, images, etc.) - must be after specific routes
// Exclude documentation path from static serving
app.use((req, res, next) => {
    // Skip static serving for documentation routes
    if (req.path === '/documentation' || req.path === '/documentation/' || req.path.startsWith('/api-documentation_rev1')) {
        return next();
    }
    express.static(__dirname, { index: false })(req, res, next);
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Export app for Vercel serverless functions
// Vercel will use this as the handler
module.exports = app;

// Start server (only when running locally, not on Vercel)
// Check for Vercel environment or if PORT is not set (serverless)
if (!process.env.VERCEL && process.env.PORT) {
    app.listen(PORT, () => {
        console.log('🚀 Paytrail API Demo Server started');
        console.log(`📍 Server running at http://localhost:${PORT}`);
        console.log(`🌐 Open http://localhost:${PORT} in your browser to test the API`);
        console.log('');
        console.log('Available endpoints:');
        console.log(`  🔗 GET  /api/merchants/payment-providers`);
        console.log(`  🔗 GET  /api/merchants/grouped-payment-providers`);
        console.log(`  🔗 POST /api/payments`);
        console.log(`  🔗 GET  /health`);
        console.log(`  🔗 GET  /documentation`);
        console.log('');
    });
} 
