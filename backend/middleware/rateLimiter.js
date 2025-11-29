const rateLimit = require('express-rate-limit');
const config = require('../config');

// Create rate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000 / 60) + ' minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = apiLimiter;
