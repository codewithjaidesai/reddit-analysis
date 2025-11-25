// Test if Reddit's public API works (no OAuth)
function testPublicRedditAPI() {
  console.log('Testing Reddit PUBLIC API (no authentication)...');

  const tests = [];

  // Test 1: Public JSON endpoint for a known post
  try {
    const url = 'https://www.reddit.com/r/AskReddit/comments/1234567.json?limit=5';
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'script:RedditAnalyzer:v1.0.0 (by /u/gamestopfan)'
      },
      muteHttpExceptions: true
    });

    tests.push({
      name: 'Public Post JSON',
      url: url,
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200 || response.getResponseCode() === 404,
      isHtml: response.getContentText().includes('<html'),
      preview: response.getContentText().substring(0, 200)
    });
  } catch (error) {
    tests.push({
      name: 'Public Post JSON',
      success: false,
      error: error.toString()
    });
  }

  // Test 2: Public search
  try {
    const url = 'https://www.reddit.com/search.json?q=python&limit=5';
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'script:RedditAnalyzer:v1.0.0 (by /u/gamestopfan)'
      },
      muteHttpExceptions: true
    });

    tests.push({
      name: 'Public Search JSON',
      url: url,
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200,
      isHtml: response.getContentText().includes('<html'),
      preview: response.getContentText().substring(0, 200)
    });
  } catch (error) {
    tests.push({
      name: 'Public Search JSON',
      success: false,
      error: error.toString()
    });
  }

  // Test 3: Subreddit top posts (public)
  try {
    const url = 'https://www.reddit.com/r/python/top.json?t=day&limit=5';
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'script:RedditAnalyzer:v1.0.0 (by /u/gamestopfan)'
      },
      muteHttpExceptions: true
    });

    tests.push({
      name: 'Public Subreddit Top',
      url: url,
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200,
      isHtml: response.getContentText().includes('<html'),
      preview: response.getContentText().substring(0, 200)
    });
  } catch (error) {
    tests.push({
      name: 'Public Subreddit Top',
      success: false,
      error: error.toString()
    });
  }

  console.log('=== PUBLIC API TEST RESULTS ===');
  console.log(JSON.stringify(tests, null, 2));

  return {
    timestamp: new Date().toISOString(),
    tests: tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.success).length,
      failed: tests.filter(t => !t.success).length
    }
  };
}
