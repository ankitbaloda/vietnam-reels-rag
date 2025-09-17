# 🚀 Vietnam Reels RAG - Production Deployment Guide

This guide will help you deploy the Vietnam Reels RAG system to production with continuous deployment capabilities.

## 🎯 Quick Start (5 Minutes to Production)

### 1. Prerequisites
- GitHub repository with this code
- OpenAI or OpenRouter API key
- Basic familiarity with cloud deployments

### 2. One-Command Setup
```bash
./deploy.sh
```

This script will guide you through the entire deployment process.

### 3. Choose Your Deployment Stack

#### Option A: Recommended Stack (Easiest)
- **Frontend**: Vercel (free tier available)
- **Backend**: Railway (free tier available)  
- **Vector DB**: Qdrant Cloud (free tier available)

#### Option B: Alternative Stack
- **Frontend**: Netlify or Vercel
- **Backend**: Render or Heroku
- **Vector DB**: Self-hosted Qdrant or PostgreSQL with pgvector

## 🔧 Detailed Setup

### Backend Deployment (Railway)

1. **Create Railway Account**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   ```

2. **Deploy Backend**
   ```bash
   # Create new project
   railway new
   
   # Deploy
   railway up
   ```

3. **Set Environment Variables** in Railway dashboard:
   ```env
   OPENROUTER_API_KEY=your_key_here
   QDRANT_URL=https://your-cluster.qdrant.tech:6333
   QDRANT_API_KEY=your_qdrant_key
   EMBEDDINGS_MODEL=text-embedding-3-large
   QDRANT_COLLECTION=flowise_reels
   ```

### Frontend Deployment (Vercel)

1. **Create Vercel Account**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login
   vercel login
   ```

2. **Deploy Frontend**
   ```bash
   cd web
   vercel --prod
   ```

3. **Set Environment Variables** in Vercel dashboard:
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_RAG_ENDPOINT=https://your-backend.railway.app
   ```

### Vector Database Setup (Qdrant Cloud)

1. **Create Qdrant Cloud Account**
   - Go to https://cloud.qdrant.io
   - Create a free cluster
   - Get your cluster URL and API key

2. **Index Your Documents**
   ```bash
   # Set environment variables
   export QDRANT_URL=https://your-cluster.qdrant.tech:6333
   export QDRANT_API_KEY=your_api_key
   export OPENAI_API_KEY=your_openai_key
   
   # Run indexer
   python scripts/build_hierarchical_index.py \\
     --source-dir data/source \\
     --collection flowise_reels \\
     --qdrant-url $QDRANT_URL
   ```

## 🔄 Continuous Deployment

Once set up, your system will automatically deploy when you:

1. **Push to main branch** → Triggers GitHub Actions
2. **Merge pull requests** → Automatic deployment
3. **Update environment variables** → Restart services

### GitHub Actions Workflow

The included `.github/workflows/deploy.yml` will:
- ✅ Test your code
- ✅ Deploy backend to Railway
- ✅ Deploy frontend to Vercel
- ✅ Send notifications

### Required GitHub Secrets

Add these to your repository settings:
```
RAILWAY_TOKEN=your_railway_token
VERCEL_TOKEN=your_vercel_token
ORG_ID=your_vercel_org_id
PROJECT_ID=your_vercel_project_id
OPENROUTER_API_KEY=your_api_key
QDRANT_API_KEY=your_qdrant_key
```

## 🧪 Testing Your Deployment

### 1. Health Check
```bash
curl https://your-backend.railway.app/health
```

### 2. Test RAG API
```bash
curl -X POST https://your-backend.railway.app/rag/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Create a Vietnam food reel idea",
    "model": "openai/gpt-4o-mini",
    "step": "ideation"
  }'
```

### 3. Frontend Test
- Visit your Vercel URL
- Try sending a message
- Verify RAG toggle works
- Check cost calculation

## 🔧 Configuration Options

### Environment Variables

#### Backend (.env)
```env
# API Keys
OPENROUTER_API_KEY=your_key
OPENAI_API_KEY=your_key  # Alternative to OpenRouter

# Vector Database
QDRANT_URL=https://your-cluster.qdrant.tech:6333
QDRANT_API_KEY=your_key
QDRANT_COLLECTION=flowise_reels

# Embeddings
EMBEDDINGS_MODEL=text-embedding-3-large
MAX_TOKENS_PER_CHUNK=800
OVERLAP_TOKENS=100

# Server
PORT=8000
SQLITE_PATH=/tmp/database.sqlite
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_RAG_ENDPOINT=https://your-backend.railway.app
```

## 📊 Monitoring & Maintenance

### Health Monitoring
- Railway provides built-in monitoring
- Vercel has analytics dashboard
- Set up uptime monitoring (optional)

### Logs
```bash
# Railway logs
railway logs

# Vercel logs (via dashboard)
```

### Database Maintenance
- Qdrant Cloud: Automatic backups
- Self-hosted: Regular backups recommended

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `NEXT_PUBLIC_API_URL` is set correctly
   - Verify backend CORS settings

2. **Vector Search Not Working**
   - Verify Qdrant connection
   - Check if documents are indexed
   - Test with direct API call

3. **Deployment Failures**
   - Check GitHub Actions logs
   - Verify all secrets are set
   - Check service health endpoints

### Debug Commands
```bash
# Test backend locally
uvicorn server.app:app --reload

# Test frontend locally
cd web && npm run dev

# Test vector search
python scripts/test_indexer.py
```

## 💰 Cost Estimation

### Free Tier Limits
- **Vercel**: 100GB bandwidth/month
- **Railway**: $5 free credit/month
- **Qdrant Cloud**: 1GB storage free
- **OpenRouter**: Pay per use

### Typical Monthly Costs
- **Hobby Project**: $0-10/month
- **Small Business**: $20-50/month
- **Production Scale**: $50-200/month

## 🔐 Security Best Practices

1. **API Keys**: Store in environment variables only
2. **HTTPS**: Always use SSL in production
3. **Rate Limiting**: Configure appropriately
4. **CORS**: Restrict to your domains
5. **Updates**: Keep dependencies updated

## 🎯 Performance Optimization

### Backend
- Enable response caching
- Use connection pooling
- Monitor response times

### Frontend
- Enable Vercel Edge Network
- Optimize bundle size
- Use service workers for caching

### Database
- Monitor query performance
- Optimize vector dimensions
- Use appropriate top_k values

## 📈 Scaling Strategies

### When to Scale

1. **Response times > 2s**: Upgrade backend
2. **High error rates**: Add redundancy
3. **Storage limits**: Upgrade database
4. **Bandwidth limits**: Upgrade CDN

### Scaling Options

1. **Vertical**: Upgrade plan tiers
2. **Horizontal**: Add load balancers
3. **Database**: Read replicas
4. **CDN**: Global distribution

## 🤝 Contributing to Production

1. **Development Flow**:
   ```bash
   git checkout -b feature/new-feature
   # Make changes
   git push origin feature/new-feature
   # Create pull request
   ```

2. **Testing Before Deploy**:
   - Test locally first
   - Use preview deployments
   - Review GitHub Actions results

3. **Production Releases**:
   - Merge to main triggers deployment
   - Monitor deployment status
   - Verify functionality post-deploy

---

## 🎉 You're Ready for Production!

With this setup, you have:
- ✅ **Automatic deployments** on code push
- ✅ **Scalable infrastructure** that grows with you
- ✅ **Professional monitoring** and logging
- ✅ **Cost-effective** free tier start
- ✅ **Security best practices** built-in

**Your system will now automatically update whenever you push code changes!**