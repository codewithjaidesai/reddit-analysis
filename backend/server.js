const express = require('express');
const cors = require('cors');
const config = require('./config');
const apiLimiter = require('./middleware/rateLimiter');
const analyzeRoutes = require('./routes/analyze');
const searchRoutes = require('./routes/search');
const radarRoutes = require('./routes/radar');

const app = express();

// Trust proxy for Vercel/cloud deployments (needed for rate limiting)
app.set('trust proxy', 1);

// Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Reddit Analyzer API',
    version: '2.0.0',
    endpoints: {
      health: 'GET /health',
      analyze_extract: 'POST /api/analyze/extract',
      analyze_insights: 'POST /api/analyze/insights',
      analyze_full: 'POST /api/analyze/full',
      analyze_auto: 'POST /api/analyze/auto',
      search_topic: 'POST /api/search/topic',
      search_subreddit: 'POST /api/search/subreddit',
      search_prescreen: 'POST /api/search/prescreen',
      radar_subscribe: 'POST /api/radar/subscribe',
      radar_subscriptions: 'GET /api/radar/subscriptions',
      radar_unsubscribe: 'POST /api/radar/unsubscribe',
      radar_subreddit: 'GET /api/radar/subreddit/:name',
      radar_digest: 'GET /api/radar/digest/:subreddit/latest'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// API routes with rate limiting
app.use('/api/analyze', apiLimiter, analyzeRoutes);
app.use('/api/search', apiLimiter, searchRoutes);
app.use('/api/radar', apiLimiter, radarRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Reddit Analyzer API v2.0.0`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════════════════');
});

module.exports = app;
