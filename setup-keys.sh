#!/bin/bash

echo "🔑 Quick API Key Setup"
echo "====================="
echo
echo "Paste your API keys when prompted:"
echo

# Get OpenRouter key
echo "1. OpenRouter API Key (from https://openrouter.ai/):"
read -p "Enter key: " OPENROUTER_KEY

# Get Qdrant details  
echo
echo "2. Qdrant Cluster URL (from https://cloud.qdrant.io/):"
echo "   Example: https://abc123.europe-west3-0.gcp.cloud.qdrant.io:6333"
read -p "Enter URL: " QDRANT_URL

echo
echo "3. Qdrant API Key:"
read -p "Enter key: " QDRANT_KEY

# Update .env file
sed -i "s|OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$OPENROUTER_KEY|" .env
sed -i "s|QDRANT_URL=.*|QDRANT_URL=$QDRANT_URL|" .env  
sed -i "s|QDRANT_API_KEY=.*|QDRANT_API_KEY=$QDRANT_KEY|" .env

echo
echo "✅ API keys updated in .env file!"
echo
echo "🧪 Testing connection..."

# Test Qdrant connection
if curl -s --connect-timeout 10 -H "api-key: $QDRANT_KEY" "$QDRANT_URL/collections" >/dev/null 2>&1; then
    echo "✅ Qdrant connection successful!"
else
    echo "❌ Qdrant connection failed. Check your URL and API key."
    exit 1
fi

echo
echo "🚀 Ready for deployment!"
echo "Next: Run ./deploy.sh or follow manual steps below"
echo
echo "Manual Railway Deployment:"
echo "1. railway login"
echo "2. railway new"  
echo "3. railway up"
echo "4. Add environment variables in Railway dashboard"
echo
echo "Manual Vercel Deployment:"
echo "1. cd web"
echo "2. vercel login"
echo "3. vercel --prod"