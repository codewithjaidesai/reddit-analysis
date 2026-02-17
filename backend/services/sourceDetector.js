/**
 * Source Detection Utility
 * Detects whether a URL is from Reddit, YouTube, or an unknown source
 */

const config = require('../config');

/**
 * Detect the source platform from a URL
 * @param {string} url - URL to analyze
 * @returns {object} { source: 'reddit'|'youtube'|'unknown', isSupported: boolean, error?: string }
 */
function detectSource(url) {
  if (!url || typeof url !== 'string') {
    return { source: 'unknown', isSupported: false, error: 'Invalid URL' };
  }

  const normalizedUrl = url.toLowerCase().trim();

  // Reddit patterns
  if (
    normalizedUrl.includes('reddit.com') ||
    normalizedUrl.includes('redd.it') ||
    normalizedUrl.match(/^https?:\/\/(www\.)?reddit\.com/) ||
    normalizedUrl.match(/^https?:\/\/redd\.it/)
  ) {
    return { source: 'reddit', isSupported: true };
  }

  // YouTube patterns
  if (
    normalizedUrl.includes('youtube.com') ||
    normalizedUrl.includes('youtu.be') ||
    normalizedUrl.match(/^https?:\/\/(www\.)?youtube\.com/) ||
    normalizedUrl.match(/^https?:\/\/youtu\.be/)
  ) {
    // Check if YouTube is enabled
    if (!config.features?.youtube) {
      return {
        source: 'youtube',
        isSupported: false,
        error: 'YouTube integration is not enabled. Please configure YOUTUBE_API_KEY and ENABLE_YOUTUBE.'
      };
    }
    return { source: 'youtube', isSupported: true };
  }

  return { source: 'unknown', isSupported: false, error: 'Unsupported URL. Please provide a Reddit or YouTube URL.' };
}

/**
 * Check if a URL is a Reddit URL
 * @param {string} url
 * @returns {boolean}
 */
function isRedditUrl(url) {
  return detectSource(url).source === 'reddit';
}

/**
 * Check if a URL is a YouTube URL
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeUrl(url) {
  return detectSource(url).source === 'youtube';
}

/**
 * Get the list of enabled features
 * @returns {object} Feature flags
 */
function getEnabledFeatures() {
  return {
    reddit: config.features?.reddit !== false, // Always true unless explicitly disabled
    youtube: config.features?.youtube === true,
    youtubeSearch: config.features?.youtube === true, // YouTube search requires YouTube to be enabled
    communityPulse: true, // Reddit community pulse
    userAnalysis: true // Reddit user analysis
  };
}

module.exports = {
  detectSource,
  isRedditUrl,
  isYouTubeUrl,
  getEnabledFeatures
};
