#!/bin/bash

# Vietnam Reels RAG - Production Configuration Checker
# This script validates your production setup before deployment

set -e

echo "🔍 Vietnam Reels RAG - Production Configuration Checker"
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Status tracking
ERRORS=0
WARNINGS=0

# Helper functions
check_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

check_error() {
    echo -e "${RED}❌ $1${NC}"
    ERRORS=$((ERRORS + 1))
}

check_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check environment file
check_env_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        check_success "$description exists"
        return 0
    else
        check_error "$description missing: $file"
        return 1
    fi
}

# Check environment variable
check_env_var() {
    local var_name=$1
    local file=$2
    
    if grep -q "^$var_name=" "$file" 2>/dev/null; then
        check_success "$var_name is set"
        return 0
    else
        check_error "$var_name not found in $file"
        return 1
    fi
}

echo
echo "📋 Checking Prerequisites..."
echo "----------------------------"

# Check required tools
if command_exists git; then
    check_success "Git is installed"
else
    check_error "Git not found - install git"
fi

if command_exists node; then
    NODE_VERSION=$(node --version)
    check_success "Node.js is installed ($NODE_VERSION)"
else
    check_error "Node.js not found - install Node.js"
fi

if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    check_success "Python is installed ($PYTHON_VERSION)"
else
    check_error "Python not found - install Python 3.8+"
fi

if command_exists docker; then
    check_success "Docker is installed"
else
    check_warning "Docker not found - needed for local development"
fi

echo
echo "📁 Checking Project Structure..."
echo "--------------------------------"

# Check key files exist
key_files=(
    "server/app.py"
    "web/package.json"
    "scripts/build_hierarchical_index.py"
    "data/source"
    "prompts"
    ".github/workflows/deploy.yml"
    "railway.json"
    "vercel.json"
    "Dockerfile"
)

for file in "${key_files[@]}"; do
    if [ -e "$file" ]; then
        check_success "$file exists"
    else
        check_error "$file missing"
    fi
done

echo
echo "⚙️  Checking Configuration Files..."
echo "-----------------------------------"

# Check backend environment
if check_env_file ".env" "Backend environment file"; then
    required_backend_vars=(
        "OPENROUTER_API_KEY"
        "QDRANT_URL"
        "QDRANT_API_KEY"
        "QDRANT_COLLECTION"
    )
    
    for var in "${required_backend_vars[@]}"; do
        check_env_var "$var" ".env"
    done
fi

# Check frontend environment
if check_env_file "web/.env.local" "Frontend environment file"; then
    required_frontend_vars=(
        "NEXT_PUBLIC_API_URL"
        "NEXT_PUBLIC_RAG_ENDPOINT"
    )
    
    for var in "${required_frontend_vars[@]}"; do
        check_env_var "$var" "web/.env.local"
    done
fi

# Check production example exists
if [ -f ".env.production.example" ]; then
    check_success "Production environment example exists"
else
    check_warning "Production environment example missing"
fi

echo
echo "🐳 Checking Docker Setup..."
echo "---------------------------"

if [ -f "docker-compose.yml" ]; then
    check_success "Docker Compose file exists"
    
    if command_exists docker-compose || command_exists docker; then
        if docker-compose config >/dev/null 2>&1 || docker compose config >/dev/null 2>&1; then
            check_success "Docker Compose configuration is valid"
        else
            check_warning "Docker Compose configuration has issues"
        fi
    fi
else
    check_error "Docker Compose file missing"
fi

echo
echo "📦 Checking Dependencies..."
echo "---------------------------"

# Check Python dependencies
if [ -f "requirements.txt" ]; then
    check_success "Python requirements.txt exists"
    
    # Check if virtual environment is recommended
    if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
        check_warning "No virtual environment detected (recommended: python -m venv venv)"
    fi
else
    check_error "requirements.txt missing"
fi

# Check Node.js dependencies
if [ -f "web/package.json" ]; then
    check_success "Frontend package.json exists"
    
    if [ -d "web/node_modules" ]; then
        check_success "Frontend dependencies installed"
    else
        check_warning "Frontend dependencies not installed (run: cd web && npm install)"
    fi
else
    check_error "Frontend package.json missing"
fi

echo
echo "☁️  Checking Cloud Deployment Setup..."
echo "--------------------------------------"

# Check GitHub Actions
if [ -f ".github/workflows/deploy.yml" ]; then
    check_success "GitHub Actions workflow exists"
else
    check_error "GitHub Actions workflow missing"
fi

# Check Railway config
if [ -f "railway.json" ]; then
    check_success "Railway configuration exists"
else
    check_warning "Railway configuration missing (if using Railway)"
fi

# Check Vercel config
if [ -f "vercel.json" ]; then
    check_success "Vercel configuration exists"
    
    if [ -f "web/vercel.json" ]; then
        check_success "Web-specific Vercel config exists"
    fi
else
    check_warning "Vercel configuration missing (if using Vercel)"
fi

echo
echo "🔒 Checking Security Setup..."
echo "-----------------------------"

# Check for exposed secrets
if grep -r "sk-[a-zA-Z0-9]" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=__pycache__ --exclude-dir=.venv --exclude-dir=venv --exclude="*.md" --exclude="*.example" --exclude="check-config.sh" --exclude="package-lock.json" --exclude="*.log" >/dev/null 2>&1; then
    check_error "Potential API keys found in code - check for exposed secrets"
else
    check_success "No obvious API keys found in code"
fi

# Check gitignore
if [ -f ".gitignore" ]; then
    if grep -q ".env" .gitignore && grep -q "node_modules" .gitignore; then
        check_success ".gitignore properly configured"
    else
        check_warning ".gitignore might be missing important entries"
    fi
else
    check_error ".gitignore missing"
fi

echo
echo "🔗 Testing Local Connectivity..."
echo "--------------------------------"

# Test if Qdrant is accessible (if URL is set)
if [ -f ".env" ] && grep -q "QDRANT_URL=" .env; then
    QDRANT_URL=$(grep "QDRANT_URL=" .env | cut -d'=' -f2-)
    if [ -n "$QDRANT_URL" ]; then
        # For local development, test localhost
        LOCAL_URL="http://localhost:6333/collections"
        if curl -s --connect-timeout 5 "$LOCAL_URL" >/dev/null 2>&1; then
            check_success "Qdrant database is accessible"
        else
            check_warning "Qdrant database not accessible (may need to start locally)"
        fi
    fi
fi

echo
echo "📊 Summary"
echo "----------"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 Perfect! Your configuration is ready for production.${NC}"
    echo
    echo "Next steps:"
    echo "1. Run ./deploy.sh to start deployment"
    echo "2. Set up your cloud services"
    echo "3. Add GitHub secrets"
    echo "4. Push to main branch"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration is mostly ready with $WARNINGS warnings.${NC}"
    echo
    echo "You can proceed with deployment, but consider addressing warnings."
    echo "Run ./deploy.sh when ready."
else
    echo -e "${RED}❌ Found $ERRORS errors and $WARNINGS warnings.${NC}"
    echo
    echo "Please fix the errors before deploying:"
    echo "- Check missing files and configurations"
    echo "- Install required dependencies"
    echo "- Set up environment variables"
    echo
    echo "Re-run this script after fixing issues."
fi

echo
echo "📚 For detailed setup instructions:"
echo "   cat PRODUCTION_GUIDE.md"
echo
echo "🚀 Ready to deploy?"
echo "   ./deploy.sh"

exit $ERRORS