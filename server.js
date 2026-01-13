const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { execSync } = require('child_process');
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

// CORS configuration - explicitly allow all origins and required headers for Klarna SDK
app.use(cors({
    origin: true, // Allow all origins (or specify your domain)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors());

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
    
    // Allow access to login page, logout, API endpoints, health check, product page, and static assets
    const publicPaths = ['/login', '/logout', '/health', '/product', '/payment-success'];
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

// Authentication disabled for testing - remove requireAuth middleware
// app.use(requireAuth);

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

// Klarna API configuration
const KLARNA_API_KEY = process.env.KLARNA_API_KEY;
const KLARNA_BASE_URL = process.env.KLARNA_BASE_URL || 'https://api-global.test.klarna.com';


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

// GET /api/klarna/config - Return Klarna WebSDK Client ID
app.get('/api/klarna/config', (req, res) => {
    try {
        const KLARNA_WEBSDK_CLIENT_ID = process.env.KLARNA_WEBSDK_CLIENT_ID;
        
        if (!KLARNA_WEBSDK_CLIENT_ID) {
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

// Helper function to create Klarna payment request
async function createKlarnaPaymentRequest(data, req) {
    const axios = require('axios');
    const crypto = require('crypto');
        
        if (!KLARNA_API_KEY) {
        throw new Error('KLARNA_API_KEY environment variable is not set');
    }
    
    const url = `${KLARNA_BASE_URL}/v2/payment/requests`;
    
    // Get the base URL for return_url from request headers or environment
    // IMPORTANT: This must match the whitelisted domain in Klarna's portal exactly
    const protocol = 'https'; // Klarna requires HTTPS
    
    // Log all possible host values for debugging
    const xForwardedHost = req?.get('x-forwarded-host');
    const hostHeader = req?.get('host');
    const vercelUrl = process.env.VERCEL_URL;
    const origin = req?.get('origin');
    
    console.log('🔍 Host detection for return URL:');
    console.log('  - x-forwarded-host:', xForwardedHost);
    console.log('  - host header:', hostHeader);
    console.log('  - VERCEL_URL env:', vercelUrl);
    console.log('  - origin header:', origin);
    
    // Use the whitelisted domain explicitly to ensure it matches
    const host = xForwardedHost || hostHeader || vercelUrl || 'paytrail-payment-api-demo.vercel.app';
    
    // Ensure we're using the exact whitelisted domain (no www, no paths)
    const cleanHost = host.split(':')[0].split('/')[0]; // Remove port and path if present
    
    console.log('  - Final host used:', cleanHost);
    
    const returnUrl = `https://${cleanHost}/payment-success?payment_request_id={klarna.payment_request.id}&state={klarna.payment_request.state}&payment_token={klarna.payment_request.payment_token}`;
    
    console.log('  - Return URL:', returnUrl);
    
    const payload = {
        currency: data.currency || "EUR",
        amount: data.amount || 1590,
        payment_request_reference: `pay-ref-${crypto.randomUUID()}`,
        supplementary_purchase_data: {
            purchase_reference: `pay-ref-${crypto.randomUUID()}`,
            line_items: [],
            shipping: [],
            customer: {},
        },
            customer_interaction_config: {
            return_url: returnUrl,
            // Don't specify method - let WebSDK handle the interaction method
            // When using WebSDK with initiate callback, the SDK manages the flow
        },
    };

    // Merge any additional data from frontend (but don't override currency/amount if provided)
    if (data) {
        if (data.currency) payload.currency = data.currency;
        if (data.amount) payload.amount = data.amount;
    }

    console.log('📤 Creating Klarna payment request:', JSON.stringify(payload, null, 2));

    // Create Basic Auth header (Klarna uses Basic Auth, not Bearer)
    const auth = Buffer.from(`${KLARNA_API_KEY}:`).toString('base64');

    const response = await axios.post(url, payload, {
                headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
                    'Authorization': `Basic ${auth}`,
        },
    });

    return response.data;
}

// GET /api/klarna-proxy - Proxy endpoint for Klarna messaging API (to bypass CORS)
// Note: This may not work directly with Klarna SDK as it makes its own API calls
app.get('/api/klarna-proxy', async (req, res) => {
    try {
        const axios = require('axios');
        // Construct the full URL for Klarna API using query parameters
        const klarnaApiUrl = `https://js.playground.klarna.com/eu/cma/v4/messaging?${new URLSearchParams(req.query).toString()}`;
        
        console.log('🔄 Proxying Klarna messaging request:', klarnaApiUrl);
        
        const response = await axios.get(klarnaApiUrl, {
            headers: {
                'Accept': 'application/json',
            }
        });
        
        console.log('✅ Klarna proxy response received');
        res.json(response.data);
    } catch (error) {
        console.error('❌ Proxy error:', error.message);
        console.error('Error details:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            message: 'Error fetching from Klarna API',
            error: error.response?.data || error.message
        });
    }
});

// POST /api/klarna/payment-request - Create Klarna payment request
app.post('/api/klarna/payment-request', async (req, res) => {
    try {
        console.log('🔄 Creating Klarna payment request...');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Request origin:', req.get('origin'));
        console.log('Request headers:', JSON.stringify(req.headers, null, 2));
        
        const klarnaResp = await createKlarnaPaymentRequest(req.body, req);

        console.log('✅ Klarna payment request created:', klarnaResp.payment_request_id);
        console.log('Full Klarna response:', JSON.stringify(klarnaResp, null, 2));
        
        // Set explicit CORS headers
        res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        
        res.json({
            paymentRequestId: klarnaResp.payment_request_id,
        });
    } catch (err) {
        console.error('❌ Klarna payment request error:', err.response ? err.response.data : err.message);
        console.error('Error stack:', err.stack);
        
        // Set CORS headers even on error
        res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        res.status(500).json({
            error: 'Failed to create payment request',
            details: err.response ? err.response.data : err.message,
        });
    }
});

// GET /api/commit - Return git commit hash for deployment tracking
app.get('/api/commit', (req, res) => {
    try {
        let commitHash = 'unknown';
        
        // Vercel provides VERCEL_GIT_COMMIT_SHA automatically
        if (process.env.VERCEL_GIT_COMMIT_SHA) {
            commitHash = process.env.VERCEL_GIT_COMMIT_SHA;
        } else {
            // For local development, try to get it from git
            try {
                commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
            } catch (gitError) {
                console.warn('⚠️ Could not get commit hash from git:', gitError.message);
            }
        }
        
        res.json({
            commit: commitHash,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error getting commit hash:', error.message);
        res.json({
            commit: 'unknown',
            timestamp: new Date().toISOString()
        });
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
