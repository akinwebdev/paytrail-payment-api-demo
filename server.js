const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Password for demo store access (from environment variable)
const DEMO_PASSWORD = process.env.DEMO_STORE_PASSWORD;

if (!DEMO_PASSWORD) {
    console.error('❌ Error: DEMO_STORE_PASSWORD environment variable is required');
    process.exit(1);
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for demo purposes
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Simple in-memory session store (for demo purposes)
const sessions = new Map();

// Generate session ID
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

// Authentication middleware
function requireAuth(req, res, next) {
    const sessionId = req.cookies.sessionId;
    
    console.log('🔒 Auth check - Path:', req.path, 'Session ID:', sessionId ? 'present' : 'missing');
    console.log('🔒 All cookies:', req.cookies);
    if (sessionId) {
        console.log('🔒 Session exists in store:', sessions.has(sessionId));
        console.log('🔒 Total sessions in store:', sessions.size);
    }
    
    // Check if session is valid
    if (sessionId && sessions.has(sessionId)) {
        console.log('✅ Authenticated - allowing access');
        return next();
    }
    
    // Allow access to login page, logout, API endpoints, health check, and static assets
    const publicPaths = ['/login', '/logout', '/health'];
    const publicPrefixes = ['/api/', '/styles.css', '/fonts/', '/images/', '/favicon'];
    
    if (publicPaths.includes(req.path) || 
        publicPrefixes.some(prefix => req.path.startsWith(prefix)) ||
        req.path.endsWith('.css') || 
        req.path.endsWith('.js') || 
        req.path.endsWith('.svg') || 
        req.path.endsWith('.png') || 
        req.path.endsWith('.jpg') || 
        req.path.endsWith('.woff') || 
        req.path.endsWith('.woff2') || 
        req.path.endsWith('.ttf')) {
        console.log('✅ Public route - allowing access');
        return next();
    }
    
    // Redirect to login with return URL
    console.log('❌ Not authenticated - redirecting to login');
    const returnUrl = req.originalUrl || req.url;
    res.redirect(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
}

// Login route (must be before authentication middleware)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
    const { password, returnUrl } = req.body;
    
    if (password === DEMO_PASSWORD) {
        // Create session
        const sessionId = generateSessionId();
        sessions.set(sessionId, {
            authenticated: true,
            createdAt: Date.now()
        });
        
        // Set cookie
        res.cookie('sessionId', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'lax', // Allow cookie to be sent on navigation
            path: '/' // Ensure cookie is available for all paths
        });
        console.log('🍪 Cookie set - Session ID:', sessionId, 'Path: /');
        
        // Redirect to returnUrl if provided and valid, otherwise to homepage
        const redirectTo = returnUrl && returnUrl !== '/login' && returnUrl.startsWith('/') 
            ? decodeURIComponent(returnUrl) 
            : '/';
        console.log('✅ Login successful, redirecting to:', redirectTo);
        res.redirect(redirectTo);
    } else {
        const errorUrl = returnUrl ? `/login?error=1&returnUrl=${encodeURIComponent(returnUrl)}` : '/login?error=1';
        res.redirect(errorUrl);
    }
});

// Logout route
app.get('/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');
    res.redirect('/login');
});

// Serve static files BEFORE authentication (CSS, JS, fonts, images, etc.)
// This must be registered BEFORE the authentication middleware
app.use((req, res, next) => {
    // Skip API routes and special paths
    if (req.path.startsWith('/api/') || req.path === '/login' || req.path === '/logout' || 
        req.path === '/health' || req.path === '/documentation' || req.path.startsWith('/api-documentation_rev1') ||
        req.path === '/' || req.path === '/payment-success') {
        return next();
    }
    
    // Check if it's a static file request
    const isStaticFile = req.path.endsWith('.css') || 
                        req.path.endsWith('.js') || 
                        req.path.endsWith('.svg') || 
                        req.path.endsWith('.png') || 
                        req.path.endsWith('.jpg') || 
                        req.path.endsWith('.jpeg') || 
                        req.path.endsWith('.woff') || 
                        req.path.endsWith('.woff2') || 
                        req.path.endsWith('.ttf') ||
                        req.path.startsWith('/fonts/') ||
                        req.path.startsWith('/images/');
    
    if (isStaticFile) {
        const filePath = path.join(__dirname, req.path);
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.svg': 'image/svg+xml',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf'
            };
            res.type(mimeTypes[ext] || 'text/plain');
            return res.sendFile(filePath);
        }
    }
    
    // Use express.static for other paths
    express.static(__dirname, {
        index: false,
        setHeaders: (res, filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.svg': 'image/svg+xml',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf'
            };
            if (mimeTypes[ext]) {
                res.type(mimeTypes[ext]);
            }
        }
    })(req, res, next);
});

// Apply authentication to all routes except login, logout, and API endpoints
app.use(requireAuth);

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

// Klarna WebSDK configuration
const KLARNA_WEBSDK_CLIENT_ID = process.env.KLARNA_WEBSDK_CLIENT_ID;
const KLARNA_API_KEY = process.env.KLARNA_API_KEY; // API key for Basic Auth
const KLARNA_PARTNER_ACCOUNT_ID = process.env.KLARNA_PARTNER_ACCOUNT_ID; // Partner account ID for API requests
const KLARNA_API_URL = process.env.KLARNA_API_URL || 'https://api-global.test.klarna.com';

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

// Test endpoint to verify files are in deployment
app.get('/test-docs', (req, res) => {
    const fs = require('fs');
    const docsDir = path.join(__dirname, 'api-documentation_rev1', 'docs');
    const exists = fs.existsSync(docsDir);
    let files = [];
    let error = null;
    
    if (exists) {
        try {
            files = fs.readdirSync(docsDir);
            // Check for README.md specifically
            const readmePath = path.join(docsDir, 'README.md');
            const readmeExists = fs.existsSync(readmePath);
            res.json({ 
                docsDirExists: true, 
                docsDir: docsDir,
                __dirname: __dirname,
                files: files,
                readmeExists: readmeExists,
                readmePath: readmePath
            });
        } catch (e) {
            error = e.message;
            res.json({ docsDirExists: true, error: error, docsDir: docsDir });
        }
    } else {
        res.json({ docsDirExists: false, docsDir: docsDir, __dirname: __dirname });
    }
});

// Serve markdown files and assets for documentation (must be early)
// Use a regex route to match all files under this path
app.get(/^\/api-documentation_rev1\/docs\/(.+)$/, (req, res) => {
    // Extract the file path from req.url
    const match = req.url.match(/\/api-documentation_rev1\/docs\/(.+)/);
    const requestedPath = match ? decodeURIComponent(match[1].split('?')[0]) : '';
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

// GET /api/klarna/config - Return Klarna WebSDK configuration
app.get('/api/klarna/config', (req, res) => {
    try {
        console.log('🔍 Klarna config request - CLIENT_ID present:', !!KLARNA_WEBSDK_CLIENT_ID);
        console.log('🔍 Environment check:', {
            hasClientId: !!process.env.KLARNA_WEBSDK_CLIENT_ID,
            hasApiKey: !!process.env.KLARNA_API_KEY
        });
        
        if (!KLARNA_WEBSDK_CLIENT_ID) {
            console.error('❌ Klarna WebSDK Client ID not configured in environment variables');
            return res.status(500).json({
                error: 'Klarna WebSDK Client ID not configured',
                message: 'Please set KLARNA_WEBSDK_CLIENT_ID environment variable',
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            clientId: KLARNA_WEBSDK_CLIENT_ID
        });
    } catch (error) {
        console.error('❌ Error getting Klarna config:', error.message);
        res.status(500).json({
            error: 'Failed to get Klarna configuration',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/klarna/payment-request - Create a Klarna payment request
app.post('/api/klarna/payment-request', async (req, res) => {
    try {
        console.log('🔄 Creating Klarna payment request...');
        console.log('Payment request data:', JSON.stringify(req.body, null, 2));
        
        if (!KLARNA_API_KEY) {
            console.error('❌ Klarna API key not configured');
            return res.status(500).json({
                error: 'Klarna API key not configured',
                message: 'Please set KLARNA_API_KEY environment variable',
                timestamp: new Date().toISOString()
            });
        }

        if (!KLARNA_PARTNER_ACCOUNT_ID) {
            console.error('❌ Klarna Partner Account ID not configured');
            return res.status(500).json({
                error: 'Klarna Partner Account ID not configured',
                message: 'Please set KLARNA_PARTNER_ACCOUNT_ID environment variable',
                timestamp: new Date().toISOString()
            });
        }

        const axios = require('axios');
        const { amount, currency } = req.body;

        // Get the base URL for return_url
        // Use the request origin or construct from headers
        const protocol = req.protocol || (req.get('x-forwarded-proto') || 'https');
        const host = req.get('host') || req.get('x-forwarded-host') || 'paytrail-payment-api-demo.vercel.app';
        const returnUrl = `${protocol}://${host}/payment-success?paymentRequestId={klarna.payment_request.id}`;

        // Prepare minimal payment request payload per Klarna API specs
        const payload = {
            currency: currency || 'EUR',
            amount: amount || 1590, // Default to 15.90 EUR in cents
            customer_interaction_config: {
                method: 'HANDOVER',
                return_url: returnUrl
            }
        };

        console.log('📤 Sending to Klarna API:', JSON.stringify(payload, null, 2));
        console.log('📤 Return URL:', returnUrl);

        // Create Basic Auth header using API key
        // For Klarna API, the API key is used as the username with empty password
        const auth = Buffer.from(`${KLARNA_API_KEY}:`).toString('base64');

        const endpointUrl = `${KLARNA_API_URL}/v2/accounts/${KLARNA_PARTNER_ACCOUNT_ID}/payment/requests`;
        console.log('📤 Klarna API endpoint:', endpointUrl);

        const response = await axios({
            method: 'POST',
            url: endpointUrl,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            data: payload
        });

        console.log('✅ Klarna payment request created successfully');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        console.log('Payment request ID:', response.data.payment_request_id);
        
        if (!response.data.payment_request_id) {
            console.error('❌ Payment request ID missing from response');
            return res.status(500).json({
                error: 'Invalid response from Klarna API',
                message: 'Payment request ID not found in response',
                response: response.data,
                timestamp: new Date().toISOString()
            });
        }
        
        // Check if the response contains a redirect URL or action URL
        // Check multiple possible locations and nested structures
        const redirectUrl = response.data.redirect_url 
            || response.data.url 
            || response.data.action_url
            || response.data.redirectUrl
            || response.data.actionUrl
            || response.data.next_action?.url
            || response.data.next_action?.redirect_url
            || response.data.next_action?.redirectUrl
            || response.data.nextAction?.url
            || response.data.nextAction?.redirectUrl
            || response.data.actions?.find(a => a.type === 'redirect' || a.type === 'REDIRECT')?.url
            || response.data.actions?.find(a => a.type === 'redirect' || a.type === 'REDIRECT')?.redirect_url
            || response.data.actions?.find(a => a.type === 'redirect' || a.type === 'REDIRECT')?.redirectUrl
            || response.data.state_context?.redirect_url
            || response.data.state_context?.url
            || response.data.stateContext?.redirectUrl
            || response.data.stateContext?.url;
        
        console.log('🔍 Redirect URL search result:', redirectUrl || 'NOT FOUND');
        console.log('🔍 Response structure:', {
            hasActions: !!response.data.actions,
            hasNextAction: !!response.data.next_action,
            hasStateContext: !!response.data.state_context,
            allKeys: Object.keys(response.data || {})
        });
        
        res.status(201).json({
            paymentRequestId: response.data.payment_request_id,
            state: response.data.state,
            redirectUrl: redirectUrl || null,
            // Include full response for debugging
            _debug: {
                hasRedirectUrl: !!redirectUrl,
                responseKeys: Object.keys(response.data || {}),
                fullResponse: response.data // Include full response for client-side debugging
            }
        });
    } catch (error) {
        console.error('❌ Error creating Klarna payment request:', error.message);
        console.error('Error response status:', error.response?.status);
        console.error('Error response headers:', error.response?.headers);
        console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
        
        res.status(error.response?.status || 500).json({
            error: 'Failed to create Klarna payment request',
            message: error.response?.data?.message || error.response?.data?.error || error.message,
            details: error.response?.data || null,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/klarna/payment-request/:paymentRequestId - Get payment request details and redirect URL
app.get('/api/klarna/payment-request/:paymentRequestId', async (req, res) => {
    try {
        const { paymentRequestId } = req.params;
        console.log('🔍 Fetching Klarna payment request:', paymentRequestId);
        
        if (!KLARNA_API_KEY) {
            return res.status(500).json({
                error: 'Klarna API key not configured',
                message: 'Please set KLARNA_API_KEY environment variable',
                timestamp: new Date().toISOString()
            });
        }

        if (!KLARNA_PARTNER_ACCOUNT_ID) {
            return res.status(500).json({
                error: 'Klarna Partner Account ID not configured',
                message: 'Please set KLARNA_PARTNER_ACCOUNT_ID environment variable',
                timestamp: new Date().toISOString()
            });
        }

        const axios = require('axios');
        const auth = Buffer.from(`${KLARNA_API_KEY}:`).toString('base64');
        const endpointUrl = `${KLARNA_API_URL}/v2/accounts/${KLARNA_PARTNER_ACCOUNT_ID}/payment/requests/${paymentRequestId}`;
        
        console.log('📤 Fetching from Klarna API:', endpointUrl);

        const response = await axios({
            method: 'GET',
            url: endpointUrl,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Klarna payment request fetched successfully');
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
        // Extract redirect URL from various possible locations
        // Check multiple possible locations and nested structures
        const redirectUrl = response.data.redirect_url 
            || response.data.url 
            || response.data.action_url
            || response.data.redirectUrl
            || response.data.actionUrl
            || response.data.next_action?.url
            || response.data.next_action?.redirect_url
            || response.data.next_action?.redirectUrl
            || response.data.nextAction?.url
            || response.data.nextAction?.redirectUrl
            || response.data.actions?.find(a => a.type === 'redirect' || a.type === 'REDIRECT')?.url
            || response.data.actions?.find(a => a.type === 'redirect' || a.type === 'REDIRECT')?.redirect_url
            || response.data.actions?.find(a => a.type === 'redirect' || a.type === 'REDIRECT')?.redirectUrl
            || response.data.state_context?.redirect_url
            || response.data.state_context?.url
            || response.data.stateContext?.redirectUrl
            || response.data.stateContext?.url;
        
        console.log('🔍 Redirect URL search result:', redirectUrl || 'NOT FOUND');
        console.log('🔍 Response structure:', {
            hasActions: !!response.data.actions,
            hasNextAction: !!response.data.next_action,
            hasStateContext: !!response.data.state_context,
            allKeys: Object.keys(response.data || {})
        });
        
        res.json({
            paymentRequestId: response.data.payment_request_id || paymentRequestId,
            state: response.data.state,
            redirectUrl: redirectUrl || null,
            paymentRequest: response.data,
            _debug: {
                hasRedirectUrl: !!redirectUrl,
                responseKeys: Object.keys(response.data || {}),
                fullResponse: response.data // Include full response for client-side debugging
            }
        });
    } catch (error) {
        console.error('❌ Error fetching Klarna payment request:', error.message);
        console.error('Error details:', error.response?.data);
        
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch Klarna payment request',
            message: error.response?.data?.message || error.message,
            details: error.response?.data || null,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/klarna/webhook - Handle Klarna webhooks
app.post('/api/klarna/webhook', async (req, res) => {
    try {
        console.log('📥 Received Klarna webhook');
        console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
        
        const { metadata, data } = req.body;
        
        if (metadata?.event_type === 'payment.request.state-change.completed') {
            const interoperabilityToken = data?.state_context?.interoperability_token;
            const paymentRequestId = data?.payment_request_id;
            
            console.log('✅ Payment request completed');
            console.log('Payment Request ID:', paymentRequestId);
            console.log('Interoperability Token:', interoperabilityToken);
            
            // Store the interoperability token for later use
            // In a real implementation, you would store this in a database
            // and associate it with the payment request ID
            
            // For now, we'll log it and the frontend will handle authorization
            // when the payment completes
        }
        
        // Always return 200 to acknowledge receipt
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('❌ Error processing Klarna webhook:', error.message);
        // Still return 200 to prevent Klarna from retrying
        res.status(200).json({ received: true, error: error.message });
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

        // Log the reference being sent
        console.log('📤 Sending to Paytrail API:');
        console.log('  Reference in request:', paymentData.reference);
        console.log('  Stamp in request:', paymentData.stamp);
        
        // Log Klarna interoperability token if present
        if (paymentData.providerDetails?.klarna?.networkSessionToken) {
            console.log('  Klarna Network Session Token (interoperability_token):', paymentData.providerDetails.klarna.networkSessionToken);
        }
        
        // Make real API call to Paytrail
        const response = await makePaytrailRequest('POST', '/payments', paymentData);
        
        // Log the reference received
        console.log('📥 Received from Paytrail API:');
        console.log('  Reference in response:', response.reference);
        console.log('  TransactionId in response:', response.transactionId);
        if (response.checkoutReference) {
            console.log('  CheckoutReference in response:', response.checkoutReference);
        }
        console.log('  Full response:', JSON.stringify(response, null, 2));
        
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

// Serve product detail page
app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, 'product.html'));
});

// Serve payment success page
app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment-success.html'));
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

// 404 handler - but skip for static files that might not exist
app.use((req, res) => {
    // If it's a static file request, try to serve it with correct MIME type
    const isStaticAsset = req.path.endsWith('.css') || 
                         req.path.endsWith('.js') || 
                         req.path.endsWith('.svg') || 
                         req.path.endsWith('.png') || 
                         req.path.endsWith('.jpg') || 
                         req.path.endsWith('.woff') || 
                         req.path.endsWith('.woff2') || 
                         req.path.endsWith('.ttf');
    
    if (isStaticAsset) {
        const filePath = path.join(__dirname, req.path);
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.svg': 'image/svg+xml',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf'
            };
            res.type(mimeTypes[ext] || 'text/plain');
            return res.sendFile(filePath);
        }
    }
    
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
