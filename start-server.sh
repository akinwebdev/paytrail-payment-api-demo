#!/bin/bash

# Kill any existing server processes
echo "Stopping any existing server processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
pkill -9 -f "node.*server.js" 2>/dev/null
sleep 1

# Navigate to project directory
cd "/Users/akin.toksan/Desktop/Coding/Paytrail Payment API"

# Ensure .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
# Paytrail API Configuration
PAYTRAIL_API_URL=https://services.paytrail.com
PAYTRAIL_MERCHANT_ID=1100830
PAYTRAIL_SECRET_KEY=49940e14fa2e814f39a4c69f7d798c01d14fba04f1fcae8cd985c2aa1585ebabd5575973ae26ab90

# Server Configuration
PORT=3000
NODE_ENV=development
EOF
fi

# Start the server
echo "Starting server..."
node server.js
