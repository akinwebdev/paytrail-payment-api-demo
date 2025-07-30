# 🏦 Paytrail Payment API Demo

A **live integration** with the Paytrail Payment API showcasing three key endpoints with real API calls and a modern web interface.

## 📋 Features

**✅ LIVE API INTEGRATION** - This application makes real calls to Paytrail's API using test credentials:

### 🔧 API Testing Interface
- **GET /merchants/payment-providers** - Retrieve available payment providers
- **GET /merchants/grouped-payment-providers** - Get payment providers grouped by type  
- **POST /payments** - Create a new payment

### 🔄 Complete Payment Flow Demo
- **Interactive Payment Form** - Create payments with real customer data
- **Real Provider Selection** - Choose from live Finnish payment providers
- **Actual Payment Processing** - Navigate to real payment provider URLs
- **Success/Cancel Handling** - Proper redirect flow handling

**🔥 Real Finnish Payment Methods**: OP, Nordea, Danske Bank, Visa, Mastercard, Apple Pay, Google Pay, Siirto, Walley, and more!

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0 or higher
- npm or yarn package manager

### Installation

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment (optional)**
   ```bash
   cp .env.example .env
   # Edit .env with your Paytrail credentials if you want to use real API calls
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🖥️ Usage

The web interface provides three buttons corresponding to the Paytrail API endpoints:

### 📋 Get Payment Providers
Fetches a list of all available payment providers (banks, credit cards, mobile payments, etc.)

### 📊 Get Grouped Providers  
Retrieves payment providers organized by categories (bank payments, card payments, mobile payments)

### 💳 Create Payment
Creates a new payment with demo data including:
- Amount: €15.90
- Currency: EUR
- Customer information
- Delivery and invoicing addresses
- Redirect URLs

## 🔄 Complete Payment Flow Demo

For a full end-to-end payment testing experience:

1. **Access Payment Flow**: Click "🚀 Launch Payment Flow Demo" or visit `http://localhost:3000/payment-flow.html`

2. **Create Payment**: 
   - Fill out the payment form with customer details
   - Adjust amount, description, and customer information
   - Click "Create Payment & Show Providers"

3. **Select Provider**: 
   - Choose from real Finnish payment providers grouped by type:
     - **🏦 Banks**: OP, Nordea, Danske Bank, S-pankki, POP Pankki, Aktia, Säästöpankki, Ålandsbanken
     - **📱 Mobile**: Siirto, Apple Pay, Google Pay
     - **💳 Cards**: Visa, Mastercard, American Express
     - **📄 Credit**: Walley (B2C and B2B)

4. **Complete Payment**: 
   - Click on any provider to navigate to their actual payment interface
   - Test the real payment flow with safe test credentials

5. **Return Handling**: 
   - Experience proper success/cancel redirect flows
   - See transaction details on completion pages

## 🔧 API Endpoints

### GET /api/merchants/payment-providers
Returns an array of available payment providers.

**Response Example:**
```json
[
  {
    "id": "nordea",
    "name": "Nordea", 
    "group": "bank",
    "icon": "https://static.paytrail.com/brand/nordea.svg",
    "svg": "<svg>...</svg>",
    "parameters": []
  }
]
```

### GET /api/merchants/grouped-payment-providers
Returns payment providers grouped by type.

**Response Example:**
```json
{
  "terms": "Terms and conditions...",
  "groups": [
    {
      "id": "bank",
      "name": "Bank payments", 
      "providers": [...]
    }
  ]
}
```

### POST /api/payments
Creates a new payment.

**Request Body Example:**
```json
{
  "stamp": "payment-1234567890",
  "reference": "ref-1234567890", 
  "amount": 1590,
  "currency": "EUR",
  "items": [...],
  "customer": {...},
  "redirectUrls": {...}
}
```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `PAYTRAIL_API_URL` | Paytrail API base URL | `https://services.paytrail.com` |
| `PAYTRAIL_MERCHANT_ID` | Paytrail merchant ID | `375917` (test credentials) |
| `PAYTRAIL_SECRET_KEY` | Paytrail secret key | `SAIPPUAKAUPPIAS` (test credentials) |
| `NODE_ENV` | Environment mode | `development` |

### ✅ Live API Integration

**The application is already configured with real Paytrail API integration!**

- Uses official Paytrail test credentials (375917 / SAIPPUAKAUPPIAS)
- Makes authenticated HMAC-SHA256 signed requests
- Returns real Finnish payment provider data

### Production Setup

For production use:

1. Sign up for a [Paytrail merchant account](https://www.paytrail.com/)
2. Replace test credentials with your production merchant ID and secret key
3. Update environment variables in your deployment

## 📁 Project Structure

```
paytrail-api-demo/
├── index.html          # Frontend web interface
├── server.js           # Express.js backend server
├── package.json        # Node.js dependencies and scripts
├── .env.example        # Environment configuration template
├── README.md           # This documentation
└── .gitignore          # Git ignore rules
```

## 🔒 Security Notes

- **Real API Integration** - Uses official Paytrail test credentials
- Test credentials are safe for public demonstration
- In production, implement proper authentication, validation, and error handling
- Never expose your production Paytrail secret key in client-side code
- Use HTTPS in production environments
- Replace test credentials with production credentials for live use

## 📚 API Documentation

For complete Paytrail API documentation, visit:
- [Paytrail Developer Documentation](https://docs.paytrail.com)
- [Paytrail Payment Service](https://www.paytrail.com)

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
Error: listen EADDRINUSE: address already in use :::3000
```
Solution: Change the port in `.env` file or kill the process using port 3000.

**Dependencies not installing:**
Make sure you have Node.js 16+ installed:
```bash
node --version
npm --version
```

**API calls failing:**
Check the browser console for detailed error messages and verify your network connection.

## 📄 License

This project is provided as-is for demonstration purposes. Use at your own risk.

## 🤝 Contributing

This is a demo application. For actual Paytrail SDK contributions, please visit the official Paytrail repositories.

---

## ✅ Integration Status

**🔥 LIVE PAYTRAIL API INTEGRATION COMPLETE**

All three endpoints are now making **authenticated requests** to Paytrail's production API using official test credentials:

- ✅ **GET /merchants/payment-providers** - Returns real Finnish payment methods
- ✅ **GET /merchants/grouped-payment-providers** - Returns providers grouped by type  
- ✅ **POST /payments** - Creates actual payment transactions

**Test Credentials Used:**
- Merchant ID: `375917`
- Secret Key: `SAIPPUAKAUPPIAS`

**Authentication:** HMAC-SHA256 signatures with `checkout-*` headers according to Paytrail API specification.

### 🔍 Enhanced Logging

The server now provides detailed logging for debugging:

**Example: Create Payment Request**
```
🔄 Creating payment with Paytrail API...
Payment data received: {
  "stamp": "test-payment-123",
  "reference": "ref-123", 
  "amount": 1590,
  "currency": "EUR",
  ...
}
Making POST request to: https://services.paytrail.com/payments
Request headers: {
  'checkout-account': '375917',
  'checkout-algorithm': 'sha256',
  'checkout-method': 'POST',
  'checkout-nonce': '8c5a1d3b-f60b-4abb-9d69-2a93dfd6184c',
  'checkout-timestamp': '2025-07-30T18:53:27.989Z',
  signature: '482ba3596b10b27367960097d84f3e798754ef0303c19f30882e739394c72ebd'
}
Request payload sent to Paytrail: {
  "stamp": "test-payment-123",
  "reference": "ref-123",
  "amount": 1590,
  "currency": "EUR",
  ...
}
✅ Payment created successfully with Paytrail
```

---

**Disclaimer:** This is an unofficial demo application created for educational purposes. It is not affiliated with or endorsed by Paytrail Oyj. 