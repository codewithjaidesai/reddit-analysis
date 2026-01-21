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

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
};
