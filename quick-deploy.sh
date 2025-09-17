#!/bin/bash

# Vietnam Reels RAG - Quick Deployment Guide
# This script helps you deploy step by step

echo "🚀 Travel Reels RAG - Quick Deployment Guide"
echo "=============================================="
echo
echo "This system can generate reels for ANY trip destination!"
echo "Vietnam is just the starting example. You can add more trips later."
echo
echo "📋 What you'll deploy:"
echo "✅ AI-powered travel reel generator"
echo "✅ Support for multiple destinations" 
echo "✅ RAG system with your travel content"
echo "✅ Professional web interface"
echo "✅ Automatic cost tracking"
echo
read -p "Ready to start deployment? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo
echo "🔑 Step 1: Get API Keys"
echo "----------------------"
echo "You need these API keys (get them from the websites):"
echo
echo "1. OpenRouter API Key (recommended)"
echo "   📍 Visit: https://openrouter.ai/"
echo "   📝 Sign up and create API key"
echo "   💰 Pay-per-use, supports GPT-4, Claude, etc."
echo
echo "2. Qdrant Cloud (Vector Database)"  
echo "   📍 Visit: https://cloud.qdrant.io/"
echo "   📝 Create free cluster (1GB free)"
echo "   🔑 Get cluster URL and API key"
echo
echo "3. Railway (Backend Hosting)"
echo "   📍 Visit: https://railway.app/"
echo "   📝 Connect your GitHub account"
echo "   🚂 Free $5/month credit"
echo
echo "4. Vercel (Frontend Hosting)"
echo "   📍 Visit: https://vercel.com/"
echo "   📝 Connect your GitHub account"
echo "   ⚡ Free tier with global CDN"
echo
read -p "Have you got your API keys? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "💡 Get your API keys first, then run this script again!"
    echo "📚 See PRODUCTION_GUIDE.md for detailed instructions"
    exit 0
fi

echo
echo "🔧 Step 2: Configure Local Environment"
echo "--------------------------------------"
echo "Let's set up your local .env file with your API keys:"
echo

# Function to prompt for API key
prompt_api_key() {
    local key_name=$1
    local description=$2
    local current_value=$3
    
    echo "Enter your $description:"
    echo "Current: $current_value"
    read -p "New value (press Enter to keep current): " new_value
    
    if [ -n "$new_value" ]; then
        echo "$new_value"
    else
        echo "$current_value"
    fi
}

# Read current .env
if [ -f ".env" ]; then
    echo "📄 Found existing .env file"
    
    # Extract current values
    OPENROUTER_KEY=$(grep "OPENROUTER_API_KEY=" .env | cut -d'=' -f2-)
    QDRANT_URL=$(grep "QDRANT_URL=" .env | cut -d'=' -f2-)
    QDRANT_KEY=$(grep "QDRANT_API_KEY=" .env | cut -d'=' -f2-)
    
    echo
    echo "🔑 Update your API keys:"
    NEW_OPENROUTER_KEY=$(prompt_api_key "OPENROUTER_API_KEY" "OpenRouter API Key" "$OPENROUTER_KEY")
    NEW_QDRANT_URL=$(prompt_api_key "QDRANT_URL" "Qdrant Cluster URL" "$QDRANT_URL")
    NEW_QDRANT_KEY=$(prompt_api_key "QDRANT_API_KEY" "Qdrant API Key" "$QDRANT_KEY")
    
    # Update .env file
    sed -i "s|OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$NEW_OPENROUTER_KEY|" .env
    sed -i "s|QDRANT_URL=.*|QDRANT_URL=$NEW_QDRANT_URL|" .env  
    sed -i "s|QDRANT_API_KEY=.*|QDRANT_API_KEY=$NEW_QDRANT_KEY|" .env
    
    echo "✅ Updated .env file"
else
    echo "❌ .env file not found!"
    exit 1
fi

echo
echo "🧪 Step 3: Test Local Setup"
echo "---------------------------"
echo "Let's test if everything works locally first..."

# Start Qdrant if needed
if ! curl -s --connect-timeout 5 http://localhost:6333/collections >/dev/null 2>&1; then
    echo "🐳 Starting Qdrant database..."
    docker-compose up qdrant -d
    sleep 3
fi

# Test configuration
echo "🔍 Running configuration check..."
if ./check-config.sh | grep -q "Perfect! Your configuration is ready"; then
    echo "✅ Configuration check passed!"
else
    echo "❌ Configuration check failed. Please fix issues first."
    exit 1
fi

echo
echo "📊 Step 4: Index Your Travel Content"
echo "------------------------------------"
echo "Now let's index your travel content for RAG search..."

if [ -d "data/source" ] && [ "$(ls -A data/source)" ]; then
    echo "📁 Found travel content in data/source/"
    ls -la data/source/
    echo
    read -p "Index this content? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Indexing content..."
        python scripts/build_hierarchical_index.py \
            --source-dir data/source \
            --collection flowise_reels \
            --qdrant-url http://localhost:6333
        echo "✅ Content indexed!"
    fi
else
    echo "⚠️  No content found in data/source/"
    echo "💡 You can add your travel content later and re-index"
fi

echo
echo "🌐 Step 5: Deploy to Cloud"
echo "--------------------------"
echo "Now let's deploy your system to the cloud!"
echo

echo "📋 Deployment options:"
echo "1. Railway + Vercel (Recommended)"
echo "2. Render + Netlify"  
echo "3. Manual setup"
echo
read -p "Choose option (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        echo "🚂 Setting up Railway + Vercel deployment..."
        echo
        echo "Next steps:"
        echo "1. Push your code to GitHub (with updated .env)"
        echo "2. Connect Railway to your GitHub repo"
        echo "3. Connect Vercel to your GitHub repo"
        echo "4. Set environment variables in both services"
        echo "5. Deploy!"
        echo
        echo "📚 See DEPLOYMENT_CHECKLIST.md for detailed steps"
        ;;
    2)
        echo "🎨 Setting up Render + Netlify deployment..."
        echo "Similar process to Railway + Vercel"
        echo "📚 See PRODUCTION_GUIDE.md for alternatives"
        ;;
    3)
        echo "⚙️ Manual setup chosen"
        echo "📚 See PRODUCTION_GUIDE.md for all options"
        ;;
    *)
        echo "Invalid option"
        ;;
esac

echo
echo "🎉 Setup Complete!"
echo "=================="
echo
echo "✅ Your travel reel RAG system is ready!"
echo "✅ Local environment configured"
echo "✅ Content indexed (if available)"
echo "✅ Ready for cloud deployment"
echo
echo "🔄 What's Next:"
echo "1. Deploy to cloud using the guides"
echo "2. Add more trip destinations to data/source/"
echo "3. Customize prompts for different travel styles"
echo "4. Scale the system for multiple creators"
echo
echo "💡 This system works for ANY travel destination!"
echo "   Vietnam → Bali → Japan → Europe → Your next trip!"
echo
echo "📚 Documentation:"
echo "   📖 PRODUCTION_GUIDE.md - Complete deployment guide"
echo "   📋 DEPLOYMENT_CHECKLIST.md - Step-by-step checklist"
echo "   🎯 DEPLOYMENT_READY.md - What you're deploying"
echo
echo "🚀 Happy travels and amazing reels!"