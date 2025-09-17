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
