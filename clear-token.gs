// Clear cached Reddit OAuth token
// Run this after changing User-Agent to force token refresh
function clearRedditToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty('reddit_token');
  scriptProperties.deleteProperty('reddit_token_expiry');

  console.log('✅ Reddit OAuth token cache cleared');
  console.log('Next API call will fetch a new token with updated User-Agent');

  return {
    success: true,
    message: 'Token cache cleared. Next request will use new User-Agent: script:RedditAnalyzer:v1.0.0'
  };
}
