# Reddit Analyzer - Node.js Version

> **Note:** This is the new Node.js version. The original Google Apps Script version is preserved in `code.gs` and `index.html`.

## 🚀 Quick Start

### Local Development

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Test the API:**
   ```bash
   curl http://localhost:3000/health
   ```

---

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Extract Reddit Data
```bash
POST /api/analyze/extract
Content-Type: application/json

{
  "url": "https://www.reddit.com/r/AskReddit/comments/xyz123/..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "post": { ... },
    "valuableComments": [ ... ],
    "extractionStats": { ... }
  }
}
```

### Generate AI Insights
```bash
POST /api/analyze/insights
Content-Type: application/json

{
  "contentData": {
    "post": { ... },
    "valuableComments": [ ... ],
    "extractionStats": { ... }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mode": "ai_analysis",
    "model": "gemini-2.5-flash",
    "aiAnalysis": "..."
  }
}
```

### Full Analysis (Extract + Insights)
```bash
POST /api/analyze/full
Content-Type: application/json

{
  "url": "https://www.reddit.com/r/AskReddit/comments/xyz123/..."
}
```

**Response:**
```json
{
  "success": true,
  "extractedData": { ... },
  "insights": { ... }
}
```

---

## 🌐 Deployment

### Deploy to Vercel (Recommended - Free)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy from backend directory:**
   ```bash
   cd backend
   vercel
   ```

4. **Add environment variables:**
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings → Environment Variables
   - Add `GEMINI_API_KEY` with your API key

5. **Redeploy:**
   ```bash
   vercel --prod
   ```

Your API will be live at: `https://your-project.vercel.app`

### Deploy to Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Initialize project:**
   ```bash
   cd backend
   railway init
   ```

4. **Add environment variables:**
   ```bash
   railway variables set GEMINI_API_KEY=your_api_key_here
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

Your API will be live at your Railway URL.

### Deploy to Render

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variables:
   - `GEMINI_API_KEY`
6. Click "Create Web Service"

---

## 🛠️ Project Structure

```
backend/
├── config/
│   └── index.js          # Configuration & environment variables
├── middleware/
│   └── rateLimiter.js    # API rate limiting
├── routes/
│   └── analyze.js        # API routes for analysis
├── services/
│   ├── gemini.js         # Gemini AI service
│   ├── reddit.js         # Reddit API service
│   └── insights.js       # Insight generation service
├── server.js             # Express server
├── package.json          # Dependencies
├── vercel.json           # Vercel configuration
└── .env.example          # Environment variables template
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | - | Gemini AI API key |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `REDDIT_CLIENT_ID` | No | Provided | Reddit OAuth client ID |
| `REDDIT_CLIENT_SECRET` | No | Provided | Reddit OAuth secret |
| `CORS_ORIGIN` | No | * | CORS allowed origins |

### Rate Limiting

- **Window:** 15 minutes
- **Max requests:** 100 per IP
- Applies to all `/api/*` endpoints

---

## 🧪 Testing

### Test locally:

```bash
# Health check
curl http://localhost:3000/health

# Extract Reddit data
curl -X POST http://localhost:3000/api/analyze/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.reddit.com/r/AskReddit/comments/xyz123/..."}'

# Full analysis
curl -X POST http://localhost:3000/api/analyze/full \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.reddit.com/r/AskReddit/comments/xyz123/..."}'
```

---

## 🔄 Workflow

```
User Request (Reddit URL)
    ↓
Frontend → POST /api/analyze/full
    ↓
Backend extracts Reddit data (OAuth)
    ↓
Backend generates AI insights (Gemini)
    ↓
Response with extracted data + insights
```

---

## 📊 Comparison: Apps Script vs Node.js

| Feature | Apps Script | Node.js |
|---------|------------|---------|
| **Setup** | Instant (clasp) | 5-10 minutes |
| **Hosting** | Free (Google) | Free (Vercel/Railway) |
| **Custom Domain** | ❌ No | ✅ Yes |
| **Performance** | Slower | Faster |
| **Scaling** | Limited | Better |
| **Development** | Browser-based | Local + IDE |
| **Claude Code Support** | ✅ Yes | ✅ Yes (easier!) |
| **API Standards** | Limited | Full REST API |

---

## 🐛 Troubleshooting

### "GEMINI_API_KEY is not defined"
- Make sure `.env` file exists in `backend/` directory
- Verify the API key is set correctly
- Restart the server after changing `.env`

### "Failed to authenticate with Reddit API"
- Reddit credentials are already provided
- Check if Reddit is rate limiting you (wait 60 seconds)
- Verify internet connection

### "Port already in use"
- Change `PORT` in `.env`
- Or kill the process using the port:
  ```bash
  lsof -ti:3000 | xargs kill
  ```

### CORS errors from frontend
- Update `CORS_ORIGIN` in `.env` to your frontend URL
- Or use `*` for development (not recommended for production)

---

## 📝 Development Notes

### Adding New Features

1. Create service in `services/` if needed
2. Add route in `routes/`
3. Update `server.js` if needed
4. Test locally
5. Commit and push (auto-deploys if connected to Vercel/Railway)

### Code Style

- Use async/await (not callbacks)
- Always use try/catch for async operations
- Log important events with `console.log`
- Return consistent response format: `{ success, data/error }`

---

## 🆘 Support

- **Apps Script Version (backup):** See `code.gs` and original `index.html`
- **Issues:** Open a GitHub issue
- **Documentation:** This README

---

## 🚀 Next Steps

1. ✅ Deploy backend to Vercel/Railway
2. 📱 Create frontend (or use existing HTML with API calls)
3. 🌐 Add custom domain
4. 📊 Add analytics
5. 💰 Consider monetization (if desired)

---

**Your Apps Script version is still available and working!** This Node.js version runs alongside it as a more professional alternative.
