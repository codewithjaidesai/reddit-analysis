require('dotenv').config();

module.exports = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Reddit API Configuration
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID || 'FSkASxBHOGaYVZLWpQO9TA',
    clientSecret: process.env.REDDIT_CLIENT_SECRET || 'AnNiJyAazf5-iW5s16ppCzXJbLNwEw',
    userAgent: process.env.REDDIT_USER_AGENT || 'web:RedditAnalyzer:v2.0.0 (by /u/gamestopfan)'
  },

  // Gemini AI Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-3-pro-preview',
    fallbackModels: ['gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
    maxOutputTokens: 65536,
    temperature: 0.7,
    topK: 64,
    topP: 0.95
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },

  // Map-Reduce Analysis Configuration
  mapReduce: {
    chunkSize: parseInt(process.env.MAP_REDUCE_CHUNK_SIZE) || 2,       // Posts per chunk for map step
    mapModel: process.env.MAP_MODEL || 'gemini-2.5-flash',             // Fast model for map steps + pre-screening
    reduceModel: process.env.REDUCE_MODEL || null,                     // null = use primary gemini.model for reduce
    commentCapPerPost: parseInt(process.env.COMMENT_CAP_PER_POST) || 100, // Max comments per post in map-reduce
    extractionBatchSize: parseInt(process.env.EXTRACTION_BATCH_SIZE) || 30, // Concurrent Reddit API calls per batch
    extractionBatchDelay: parseInt(process.env.EXTRACTION_BATCH_DELAY) || 0, // ms between batches (0 = no delay)
    preScreenThreshold: parseFloat(process.env.PRESCREEN_THRESHOLD) || 3  // Min relevance score (1-5) to keep a post
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },

  // YouTube API Configuration
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
    enabled: process.env.ENABLE_YOUTUBE !== 'false', // Enabled by default if key exists
    maxComments: parseInt(process.env.YOUTUBE_MAX_COMMENTS) || 200,
    maxRepliesPerComment: parseInt(process.env.YOUTUBE_MAX_REPLIES) || 10,
    searchMaxResults: parseInt(process.env.YOUTUBE_SEARCH_MAX_RESULTS) || 10
  },

  // Feature Flags
  features: {
    youtube: process.env.ENABLE_YOUTUBE !== 'false' && !!process.env.YOUTUBE_API_KEY,
    reddit: true // Always enabled
  }
};
