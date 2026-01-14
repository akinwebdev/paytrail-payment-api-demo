// ============================================
// CONFIGURATION
// ============================================
// Klarna API endpoint - calling directly from browser
const KLARNA_API_ENDPOINT = 'https://api-global.test.klarna.com/v2/payment/requests';

// Klarna API Key - Required for authentication (Basic Auth)
// WARNING: Exposing API keys in frontend code is a security risk. Use only for testing/demos.
// In production, always use a server-side proxy to keep API keys secure.
const KLARNA_API_KEY = 'klarna_test_api_TSlqb040SVJ3d0IxdzlpUHVhS2MhTk0wdiUzOGNZZTcsODdkYmI5OGEtMzk2Yi00YTU0LWI3NWYtZjMyN2EwOTQyYTQwLDEsMmk2RWx0K0dUTEEwQmhJbHdtbHFwa011Y0hzOUtDOWRMV2ZGak5Tb0lIYz0';

// Klarna Client ID - This client ID works with on-site messaging in CodePen
const KLARNA_CLIENT_ID = "klarna_test_client_MWVIem1QNDcjJE8zKjUyZEwtako2MEdLUGp2Ti8zTjgsOTNjYTA0OGMtNjg3My00YTRmLWFmZTgtZjc2ODE3MDg1OTRkLDEsczBrUGJ3RjdnYjVRdjg1YXpESnhRL083R0ZUeEREd1pjNXBvMFdCdTlwST0";

// ============================================
// INITIALIZATION
// ============================================
// Check if script is running in 1st-party context (not in iframe)
// Note: CodePen runs in an iframe, so this is just a warning
if (window.self !== window.top) {
    console.warn('⚠️ Running in iframe context. Klarna SDK may have limited functionality in iframes.');
    console.warn('⚠️ For full functionality, deploy to your own domain and ensure it\'s whitelisted with Klarna.');
} else {
    console.log('✅ Script is running in 1st-party context (not in iframe)');
}

let Klarna = null;
let currentLocale = 'en-GB';

// Function to get selected locale
function getSelectedLocale() {
    const select = document.getElementById('locale-select');
    return select ? select.value : 'en-GB';
}

// Function to initialize Klarna SDK with locale
async function initializeKlarnaSDK(locale) {
    // If SDK is already initialized, don't reinitialize (causes custom element registration errors)
    if (Klarna) {
        console.log('⚠️ SDK already initialized. Locale cannot be changed without page reload.');
        return Klarna;
    }

    // Use the configured client ID
    const clientId = 'klarna_test_client_MWVIem1QNDcjJE8zKjUyZEwtako2MEdLUGp2Ti8zTjgsOTNjYTA0OGMtNjg3My00YTRmLWFmZTgtZjc2ODE3MDg1OTRkLDEsczBrUGJ3RjdnYjVRdjg1YXpESnhRL083R0ZUeEREd1pjNXBvMFdCdTlwST0';

    // Initialize Klarna WebSDK
    const { KlarnaSDK } = await import("https://js.klarna.com/web-sdk/v2/klarna.mjs");

    Klarna = await KlarnaSDK({ 
        clientId: clientId,
        products: ["PAYMENT", "MESSAGING"],
        locale: locale,
    });

    console.log('✅ Klarna SDK initialized with locale:', locale);
    console.log('✅ Products specified:', ["PAYMENT", "MESSAGING"]);
    return Klarna;
}

// Check for stored locale preference
const storedLocale = sessionStorage.getItem('klarnaLocale');
if (storedLocale) {
    currentLocale = storedLocale;
    const localeSelect = document.getElementById('locale-select');
    if (localeSelect) {
        localeSelect.value = storedLocale;
    }
}

// Initialize SDK and mount components
(async function init() {
    try {
        // Initialize with default locale
        await initializeKlarnaSDK(currentLocale);

        // Function to mount Klarna on-site messaging placement
        // Note: Messaging may fail if domain is not whitelisted or client ID doesn't have messaging permissions
        // This is expected and won't affect the payment button functionality
        function mountMessagingPlacement() {
            if (Klarna?.Messaging?.placement) {
                try {
                    const placement = Klarna.Messaging.placement({
                        key: 'credit-promotion-badge',
                        locale: currentLocale,
                        amount: 15900
                    });
                    
                    // Add error handler for messaging placement
                    if (placement.on) {
                        placement.on('error', (error) => {
                            console.warn('⚠️ Klarna messaging placement error (expected if domain not whitelisted for messaging or client ID lacks messaging permissions):', error);
                        });
                    }
                    
                    placement.mount('#osm-placement');
                    console.log('✅ Klarna messaging placement mounted');
                } catch (error) {
                    console.warn('⚠️ Error mounting messaging placement (expected if domain not whitelisted for messaging or client ID lacks messaging permissions):', error);
                }
            } else {
                console.warn('⚠️ Klarna.Messaging.placement not available');
            }
        }

        // Function to mount the button
        function mountKlarnaButton() {
            console.log('Attempting to mount Klarna button...');
            console.log('Klarna object:', Klarna);
            console.log('Klarna.Payment:', Klarna?.Payment);
            
            // Mount the button
            const buttonElement = document.getElementById('klarna-payment-button');
            console.log('Button element:', buttonElement);
            
            if (!buttonElement) {
                console.error('Button container not found');
                return;
            }

            if (!Klarna?.Payment?.button) {
                console.error('Klarna.Payment.button is not available');
                return;
            }

            // Create button configuration with initiate callback
            const buttonConfig = {
                intents: ["PAY"],
                initiationMode: "ON_PAGE", // Keep payment flow on-page, not in new tab
                initiate: async () => {
                    console.log('Button initiate called - creating payment request directly with Klarna API');
                    console.log('Using Klarna API endpoint:', KLARNA_API_ENDPOINT);
                    
                    if (!KLARNA_API_KEY) {
                        const errorMsg = 'Klarna API key is not configured. Please set KLARNA_API_KEY in the configuration section.';
                        console.error('❌', errorMsg);
                        const errorEl = document.getElementById('error-message');
                        if (errorEl) {
                            errorEl.innerHTML = `<strong>Configuration Error:</strong> ${errorMsg}`;
                            errorEl.style.display = 'block';
                        }
                        throw new Error(errorMsg);
                    }
                    
                    try {
                        // Create Basic Auth header
                        const auth = btoa(`${KLARNA_API_KEY}:`);
                        
                        // Generate unique references
                        const paymentRef = `pay-ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        const purchaseRef = `purchase-ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        
                        // Get return URL (use current origin)
                        const returnUrl = `${window.location.origin}/payment-success?payment_request_id={klarna.payment_request.id}&state={klarna.payment_request.state}&payment_token={klarna.payment_request.payment_token}`;
                        
                        // Prepare payload matching Klarna API requirements
                        const payload = {
                            currency: "EUR",
                            amount: 15900,
                            payment_request_reference: paymentRef,
                            supplementary_purchase_data: {
                                purchase_reference: purchaseRef,
                                line_items: [],
                                shipping: [],
                                customer: {},
                            },
                            customer_interaction_config: {
                                return_url: returnUrl,
                            },
                        };
                        
                        console.log('📤 Request payload:', JSON.stringify(payload, null, 2));
                        
                        const resp = await fetch(KLARNA_API_ENDPOINT, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Authorization': `Basic ${auth}`
                            },
                            body: JSON.stringify(payload)
                        });

                        console.log('Response status:', resp.status);
                        console.log('Response headers:', [...resp.headers.entries()]);

                        if (!resp.ok) {
                            const errorText = await resp.text();
                            console.error('Klarna API error response:', errorText);
                            
                            // Show error message to user
                            const errorEl = document.getElementById('error-message');
                            if (errorEl) {
                                errorEl.innerHTML = `
                                    <strong>Klarna API Error:</strong> ${errorText}<br>
                                    <small>Status: ${resp.status}. Check your API key and request payload.</small>
                                `;
                                errorEl.style.display = 'block';
                            }
                            
                            throw new Error(`Klarna API returned ${resp.status}: ${errorText}`);
                        }
                        
                        const data = await resp.json();
                        console.log('✅ Klarna API response:', data);
                        
                        // Klarna returns 'payment_request_id', not 'paymentRequestId'
                        const paymentRequestId = data.payment_request_id;
                        
                        if (!paymentRequestId) {
                            throw new Error('Klarna API did not return payment_request_id');
                        }
                        
                        console.log('✅ Payment request created:', paymentRequestId);
                        
                        // Hide any previous error messages
                        const errorEl = document.getElementById('error-message');
                        if (errorEl) {
                            errorEl.style.display = 'none';
                        }
                        
                        return { paymentRequestId: paymentRequestId };
                    } catch (error) {
                        console.error('❌ Error creating payment request:', error);
                        
                        // Show error message to user
                        const errorEl = document.getElementById('error-message');
                        if (errorEl) {
                            let errorMsg = `Error: ${error.message}`;
                            
                            // Provide helpful error messages
                            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                                errorMsg = `
                                    <strong>Network Error:</strong> Could not reach Klarna API.<br>
                                    <small>This might be a CORS issue. Klarna's API may not allow direct browser requests.</small>
                                `;
                            } else if (error.message.includes('CORS')) {
                                errorMsg = `
                                    <strong>CORS Error:</strong> Klarna API is blocking cross-origin requests.<br>
                                    <small>You may need to use a server-side proxy instead of calling Klarna's API directly from the browser.</small>
                                `;
                            } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                                errorMsg = `
                                    <strong>Authentication Error:</strong> Invalid API key.<br>
                                    <small>Please check your <code>KLARNA_API_KEY</code> configuration.</small>
                                `;
                            }
                            
                            errorEl.innerHTML = errorMsg;
                            errorEl.style.display = 'block';
                        }
                        
                        throw error;
                    }
                }
            };

            console.log('Button configuration created:', buttonConfig);

            try {
                const klarnaPaymentButton = Klarna.Payment.button(buttonConfig);
                console.log('Button instance created:', klarnaPaymentButton);
                klarnaPaymentButton.mount('#klarna-payment-button');
                console.log('Klarna button mounted successfully');
            } catch (error) {
                console.error('Error mounting button:', error);
                
                // Show error message to user
                const errorEl = document.getElementById('error-message');
                if (errorEl) {
                    errorEl.textContent = `Error mounting button: ${error.message}`;
                    errorEl.style.display = 'block';
                }
            }
        }

        // Mount components when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener("DOMContentLoaded", () => {
                mountMessagingPlacement();
                mountKlarnaButton();
                
                // Add locale change handler
                const localeSelect = document.getElementById('locale-select');
                if (localeSelect) {
                    localeSelect.addEventListener('change', async (e) => {
                        const newLocale = e.target.value;
                        console.log('Locale changed to:', newLocale);
                        
                        // Note: Klarna SDK locale is set during initialization and cannot be changed dynamically
                        // The locale affects the SDK initialization, so changing it requires a page reload
                        if (newLocale !== currentLocale) {
                            // Store locale preference and reload
                            sessionStorage.setItem('klarnaLocale', newLocale);
                            window.location.reload();
                        }
                    });
                }
            });
        } else {
            // DOM is already loaded
            mountMessagingPlacement();
            mountKlarnaButton();
            
            // Add locale change handler
            const localeSelect = document.getElementById('locale-select');
            if (localeSelect) {
                localeSelect.addEventListener('change', async (e) => {
                    const newLocale = e.target.value;
                    console.log('Locale changed to:', newLocale);
                    
                    // Note: Klarna SDK locale is set during initialization and cannot be changed dynamically
                    // The locale affects the SDK initialization, so changing it requires a page reload
                    if (newLocale !== currentLocale) {
                        // Store locale preference and reload
                        sessionStorage.setItem('klarnaLocale', newLocale);
                        window.location.reload();
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error initializing Klarna SDK:', error);
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.textContent = `Error initializing Klarna SDK: ${error.message}`;
            errorEl.style.display = 'block';
        }
    }
})();
