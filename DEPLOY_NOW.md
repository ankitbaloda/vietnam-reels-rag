# 🚀 1-Click Deploy to Railway

Click this button to deploy your backend instantly:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/zOaqlR?referralCode=alphasec)

## Or Manual Railway Deploy:

```bash
# 1. Login to Railway
railway login

# 2. Create new project  
railway new

# 3. Deploy backend
railway up

# 4. Add environment variables in Railway dashboard:
OPENROUTER_API_KEY=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
QDRANT_URL=https://3955b1b4-5ade-484a-8e69-7f1cdc0d6c1c.eu-west-2-0.aws.cloud.qdrant.io  
QDRANT_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.twAEuqPlpH2V-yvpefmKWFQOeMsqJWfv1DU-ZwILVEg
QDRANT_COLLECTION=flowise_reels
EMBEDDINGS_MODEL=text-embedding-3-large
```

## Deploy Frontend to Vercel:

```bash
# 1. Login to Vercel
vercel login

# 2. Deploy from web directory
cd web
vercel --prod

# 3. Set environment variables in Vercel dashboard:
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_RAG_ENDPOINT=https://your-backend.railway.app
```

## After Deployment:

1. **Your Backend**: `https://your-app.railway.app`
2. **Your Frontend**: `https://your-app.vercel.app`  
3. **Health Check**: `https://your-app.railway.app/health`

## Add Your Travel Content:

This system works for **ANY destination**! To add new trips:

1. Create folders in `data/source/`:
   ```
   data/source/
   ├── vietnam/          # Current example
   ├── bali/            # Your next trip
   ├── japan/           # Another trip
   └── europe/          # Group trips
   ```

2. Add your content files:
   - `Travel_Files_Directory.csv` (video/photo inventory)
   - `Daywise_Narrations.txt` (trip story)
   - `Trip_Costs.csv` (budget data)
   - `Style_Documentation.txt` (creator preferences)

3. Re-index the content:
   ```bash
   python scripts/build_hierarchical_index.py \
     --source-dir data/source \
     --collection flowise_reels
   ```

## System Features:

✅ **Multi-Destination Support** - Vietnam, Bali, Japan, anywhere!
✅ **AI-Powered Content** - GPT-4, Claude, Gemini support
✅ **Professional UI** - Mobile-responsive, real-time chat  
✅ **Cost Tracking** - Know exactly what you spend
✅ **RAG Search** - Find relevant content from your trips
✅ **Step-by-Step Flow** - Ideation → Script → Edit handoff
✅ **Auto-Deploy** - Push code = instant updates

Your travel content creation system is ready to scale! 🌍✈️