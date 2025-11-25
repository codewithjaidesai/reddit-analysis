// Comprehensive Reddit API diagnostic test
// This will test every endpoint and header combination to find what works

function testAllRedditEndpoints() {
  console.log('=== COMPREHENSIVE REDDIT API DIAGNOSTIC ===');

  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: OAuth token
  try {
    const token = getRedditAccessToken();
    results.tests.push({
      name: 'OAuth Token',
      success: true,
      token: token.substring(0, 20) + '...',
      message: 'Token obtained successfully'
    });
  } catch (error) {
    results.tests.push({
      name: 'OAuth Token',
      success: false,
      error: error.toString()
    });
    return results; // Can't continue without token
  }

  const token = getRedditAccessToken();

  // Test 2: Single post fetch (known working URL)
  try {
    const testPostUrl = 'https://oauth.reddit.com/comments/1234567?limit=10&raw_json=1';
    const response = UrlFetchApp.fetch(testPostUrl, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });

    results.tests.push({
      name: 'Single Post Fetch',
      url: testPostUrl,
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200 || response.getResponseCode() === 404,
      responsePreview: response.getContentText().substring(0, 200),
      headers: JSON.stringify(response.getAllHeaders())
    });
  } catch (error) {
    results.tests.push({
      name: 'Single Post Fetch',
      success: false,
      error: error.toString()
    });
  }

  // Test 3: Search endpoint (the failing one)
  try {
    const searchUrl = 'https://oauth.reddit.com/search?q=python&limit=5&raw_json=1';
    const response = UrlFetchApp.fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const content = response.getContentText();
    const isHtml = content.includes('<html') || content.includes('<body');

    results.tests.push({
      name: 'Search Endpoint',
      url: searchUrl,
      statusCode: statusCode,
      success: statusCode === 200,
      isHtml: isHtml,
      responsePreview: content.substring(0, 300),
      contentLength: content.length
    });
  } catch (error) {
    results.tests.push({
      name: 'Search Endpoint',
      success: false,
      error: error.toString()
    });
  }

  // Test 4: Subreddit top posts
  try {
    const topUrl = 'https://oauth.reddit.com/r/python/top?t=day&limit=5&raw_json=1';
    const response = UrlFetchApp.fetch(topUrl, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const content = response.getContentText();
    const isHtml = content.includes('<html') || content.includes('<body');

    results.tests.push({
      name: 'Subreddit Top Posts',
      url: topUrl,
      statusCode: statusCode,
      success: statusCode === 200,
      isHtml: isHtml,
      responsePreview: content.substring(0, 300)
    });
  } catch (error) {
    results.tests.push({
      name: 'Subreddit Top Posts',
      success: false,
      error: error.toString()
    });
  }

  // Test 5: Try without Accept header
  try {
    const searchUrl = 'https://oauth.reddit.com/search?q=python&limit=5&raw_json=1';
    const response = UrlFetchApp.fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent
      },
      muteHttpExceptions: true
    });

    results.tests.push({
      name: 'Search WITHOUT Accept Header',
      url: searchUrl,
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200,
      responsePreview: response.getContentText().substring(0, 200)
    });
  } catch (error) {
    results.tests.push({
      name: 'Search WITHOUT Accept Header',
      success: false,
      error: error.toString()
    });
  }

  // Test 6: Check OAuth app details from token
  try {
    const meUrl = 'https://oauth.reddit.com/api/v1/me';
    const response = UrlFetchApp.fetch(meUrl, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });

    results.tests.push({
      name: 'OAuth App Info (/api/v1/me)',
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200,
      responsePreview: response.getContentText().substring(0, 300)
    });
  } catch (error) {
    results.tests.push({
      name: 'OAuth App Info',
      success: false,
      error: error.toString()
    });
  }

  // Test 7: Check scopes
  try {
    const scopesUrl = 'https://oauth.reddit.com/api/v1/scopes';
    const response = UrlFetchApp.fetch(scopesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });

    results.tests.push({
      name: 'Check Scopes',
      statusCode: response.getResponseCode(),
      responsePreview: response.getContentText().substring(0, 300)
    });
  } catch (error) {
    results.tests.push({
      name: 'Check Scopes',
      success: false,
      error: error.toString()
    });
  }

  console.log('=== DIAGNOSTIC RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

// Quick test of current User-Agent
function testUserAgent() {
  const currentUA = REDDIT_CONFIG.userAgent;
  console.log('Current User-Agent:', currentUA);

  // Reddit User-Agent format should be: platform:app-name:version (by /u/username)
  // Examples:
  // - "script:myapp:v1.0 (by /u/username)"
  // - "web:myapp:v1.0 (by /u/username)"

  return {
    current: currentUA,
    recommendation: 'script:RedditAnalyzer:v1.0.0 (by /u/gamestopfan)',
    note: 'Platform should match Reddit app type (script, web, or installed)'
  };
}
