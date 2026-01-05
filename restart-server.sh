#!/bin/bash

cd "/Users/akin.toksan/Desktop/Coding/Paytrail Payment API"

echo "🛑 Stopping existing server..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
pkill -9 -f "node.*server.js" 2>/dev/null
sleep 1

echo "🚀 Starting server..."
nohup node server.js > server.log 2>&1 &
sleep 2

echo "✅ Server restarted!"
echo "📍 Server running at http://localhost:3000"
echo "📚 Documentation available at http://localhost:3000/documentation"
echo ""
echo "To view server logs: tail -f server.log"
