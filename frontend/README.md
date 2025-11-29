# Reddit Analyzer - Frontend

Simple, modern frontend for the Reddit Analyzer Node.js backend.

## 🚀 Quick Start

### Local Development

1. **Update API URL:**
   Edit `js/config.js` and update the backend URL:
   ```javascript
   baseUrl: 'http://localhost:3000'  // For local backend
   ```

2. **Open in browser:**
   Simply open `index.html` in your web browser. No build step required!

### Deploy to Vercel/Netlify (Static Hosting)

1. **Update API URL:**
   Edit `js/config.js` with your production backend URL:
   ```javascript
   baseUrl: 'https://your-backend.vercel.app'
   ```

2. **Deploy to Vercel:**
   ```bash
   cd frontend
   vercel
   ```

   Or **Deploy to Netlify:**
   - Drag and drop the `frontend` folder to [netlify.com/drop](https://app.netlify.com/drop)
   - Or use Netlify CLI:
     ```bash
     npm install -g netlify-cli
     netlify deploy --dir=. --prod
     ```

## 📁 Structure

```
frontend/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styles
└── js/
    ├── config.js       # API configuration
    └── app.js          # Main application logic
```

## 🔧 Configuration

Edit `js/config.js`:

```javascript
const API_CONFIG = {
    baseUrl: 'YOUR_BACKEND_URL_HERE',
    endpoints: {
        extract: '/api/analyze/extract',
        insights: '/api/analyze/insights',
        full: '/api/analyze/full'
    }
};
```

## 🎨 Features

- ✅ Clean, modern UI
- ✅ Real-time analysis progress
- ✅ Markdown formatting for insights
- ✅ Table rendering
- ✅ Error handling
- ✅ Mobile responsive
- ✅ No build step required

## 🌐 Hosting Options

| Platform | Free Tier | Custom Domain | Deploy Time |
|----------|-----------|---------------|-------------|
| **Vercel** | ✅ Yes | ✅ Yes | 30 seconds |
| **Netlify** | ✅ Yes | ✅ Yes | 30 seconds |
| **GitHub Pages** | ✅ Yes | ✅ Yes | 1 minute |
| **Cloudflare Pages** | ✅ Yes | ✅ Yes | 1 minute |

## 📝 Usage

1. Enter a Reddit post URL
2. Click "Analyze"
3. Wait for extraction and AI analysis
4. View insights!

## 🔗 Integration

This frontend works with the Node.js backend at `/backend`.

Make sure:
1. Backend is deployed and running
2. `GEMINI_API_KEY` is set in backend environment
3. CORS is enabled in backend (it is by default)
4. Frontend's `config.js` points to correct backend URL

## 🐛 Troubleshooting

### "Failed to fetch" error
- Check that backend URL in `config.js` is correct
- Verify backend is running and accessible
- Check browser console for CORS errors

### Blank insights
- Check backend logs
- Verify `GEMINI_API_KEY` is set in backend
- Try a different Reddit URL

### Slow analysis
- Large posts (500+ comments) take 30-60 seconds
- Gemini API may be slow during peak times
- Check backend logs for performance issues

## 🎯 Next Steps

1. ✅ Deploy backend first
2. ✅ Update `config.js` with backend URL
3. ✅ Deploy frontend
4. 🎨 Customize styles in `css/styles.css`
5. 🚀 Add custom domain

Enjoy analyzing Reddit! 🔍
