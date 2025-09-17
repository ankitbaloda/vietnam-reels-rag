#!/bin/bash

# Vietnam Reels RAG - Production Deployment Script
# This script sets up continuous deployment for the entire system

set -e

echo "🚀 Vietnam Reels RAG - Production Deployment Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required tools are installed
check_dependencies() {
    print_step "Checking dependencies..."
    
    command -v git >/dev/null 2>&1 || { print_error "Git is required but not installed. Aborting."; exit 1; }
    command -v docker >/dev/null 2>&1 || { print_warning "Docker not found. Some features may not work locally."; }
    command -v curl >/dev/null 2>&1 || { print_error "curl is required but not installed. Aborting."; exit 1; }
    
    print_success "Dependencies check completed"
}

# Setup GitHub repository secrets
setup_github_secrets() {
    print_step "Setting up GitHub repository..."
    
    if [ ! -d ".git" ]; then
        print_error "Not a git repository. Initialize git first."
        exit 1
    fi
    
    echo "You need to add the following secrets to your GitHub repository:"
    echo "Go to: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/settings/secrets/actions"
    echo ""
    echo "Required secrets:"
    echo "- RAILWAY_TOKEN: Get from https://railway.app/account/tokens"
    echo "- VERCEL_TOKEN: Get from https://vercel.com/account/tokens"
    echo "- ORG_ID: Your Vercel organization ID"
    echo "- PROJECT_ID: Your Vercel project ID"
    echo "- OPENAI_API_KEY: Your OpenAI API key"
    echo "- OPENROUTER_API_KEY: Your OpenRouter API key"
    echo "- QDRANT_API_KEY: Your Qdrant Cloud API key (if using Qdrant Cloud)"
    
    print_warning "Please add these secrets before proceeding with deployment"
}

# Setup Railway backend
setup_railway() {
    print_step "Setting up Railway backend deployment..."
    
    echo "1. Install Railway CLI: https://docs.railway.app/develop/cli"
    echo "2. Login: railway login"
    echo "3. Create new project: railway new"
    echo "4. Add Qdrant service or connect external Qdrant Cloud"
    echo "5. Set environment variables in Railway dashboard"
    echo "6. Deploy: railway up"
    
    print_success "Railway setup instructions provided"
}

# Setup Vercel frontend
setup_vercel() {
    print_step "Setting up Vercel frontend deployment..."
    
    echo "1. Install Vercel CLI: npm i -g vercel"
    echo "2. Login: vercel login"
    echo "3. Deploy from web directory: cd web && vercel"
    echo "4. Set production environment variables in Vercel dashboard"
    echo "5. Connect GitHub repository for automatic deployments"
    
    print_success "Vercel setup instructions provided"
}

# Setup Qdrant Cloud
setup_qdrant() {
    print_step "Setting up Qdrant Cloud (recommended for production)..."
    
    echo "1. Sign up at https://cloud.qdrant.io"
    echo "2. Create a new cluster"
    echo "3. Get your cluster URL and API key"
    echo "4. Update environment variables with your Qdrant credentials"
    echo "5. Run the indexer to populate your vector database"
    
    print_success "Qdrant Cloud setup instructions provided"
}

# Create deployment checklist
create_checklist() {
    cat > DEPLOYMENT_CHECKLIST.md << EOF
# 🚀 Vietnam Reels RAG - Deployment Checklist

## Prerequisites
- [ ] GitHub repository with code
- [ ] OpenAI or OpenRouter API key
- [ ] Qdrant Cloud account (recommended) or self-hosted Qdrant

## Backend Deployment (Railway)
- [ ] Railway account created
- [ ] Railway CLI installed and logged in
- [ ] New Railway project created
- [ ] Environment variables set:
  - [ ] OPENAI_API_KEY or OPENROUTER_API_KEY
  - [ ] QDRANT_URL
  - [ ] QDRANT_API_KEY (if using Qdrant Cloud)
  - [ ] EMBEDDINGS_MODEL
  - [ ] QDRANT_COLLECTION
- [ ] Backend deployed and health check passing
- [ ] Vector database populated with documents

## Frontend Deployment (Vercel)
- [ ] Vercel account created
- [ ] Vercel CLI installed and logged in
- [ ] Project imported from GitHub
- [ ] Environment variables set:
  - [ ] NEXT_PUBLIC_API_URL (your Railway backend URL)
  - [ ] NEXT_PUBLIC_RAG_ENDPOINT (your Railway backend URL)
- [ ] Frontend deployed and accessible
- [ ] API calls working between frontend and backend

## Vector Database Setup
- [ ] Qdrant Cloud cluster created (or self-hosted Qdrant running)
- [ ] Collection 'flowise_reels' created
- [ ] Documents indexed using the indexer script
- [ ] Vector search working (test with API)

## GitHub Actions CI/CD
- [ ] GitHub repository secrets added:
  - [ ] RAILWAY_TOKEN
  - [ ] VERCEL_TOKEN
  - [ ] ORG_ID
  - [ ] PROJECT_ID
  - [ ] OPENAI_API_KEY or OPENROUTER_API_KEY
  - [ ] QDRANT_API_KEY
- [ ] GitHub Actions workflow enabled
- [ ] Test deployment by pushing to main branch

## Testing
- [ ] Frontend loads correctly
- [ ] Backend health check returns 200
- [ ] RAG system retrieves relevant documents
- [ ] Chat functionality works end-to-end
- [ ] Step-specific prompts are being used
- [ ] Cost calculation is accurate

## Monitoring
- [ ] Railway monitoring dashboard configured
- [ ] Vercel analytics enabled
- [ ] Error tracking set up (optional: Sentry)
- [ ] Log monitoring configured

## Post-Deployment
- [ ] Domain configured (optional)
- [ ] SSL certificates working
- [ ] Performance optimized
- [ ] Backup strategy in place
- [ ] Documentation updated

## Automatic Updates
✅ Once set up, your system will automatically deploy when you:
1. Push code to the main branch
2. Merge pull requests
3. Update environment variables

The GitHub Actions workflow will:
- Test your code
- Deploy backend to Railway
- Deploy frontend to Vercel
- Notify you of deployment status
EOF
    
    print_success "Deployment checklist created: DEPLOYMENT_CHECKLIST.md"
}

# Main execution
main() {
    check_dependencies
    setup_github_secrets
    setup_railway
    setup_vercel
    setup_qdrant
    create_checklist
    
    echo ""
    print_success "🎉 Deployment setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Follow the checklist in DEPLOYMENT_CHECKLIST.md"
    echo "2. Set up your cloud services (Railway, Vercel, Qdrant Cloud)"
    echo "3. Add GitHub secrets for automatic deployments"
    echo "4. Push to main branch to trigger first deployment"
    echo ""
    echo "Once deployed, your system will automatically update when you push code!"
}

# Run main function
main "$@"