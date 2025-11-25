// Test with browser-like headers to bypass Reddit's bot detection
function testWithBrowserHeaders() {
  console.log('Testing with browser-like headers...');

  const tests = [];

  // Test 1: With minimal headers (current approach)
  try {
    const url = 'https://www.reddit.com/r/python/top.json?t=day&limit=5';
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      muteHttpExceptions: true
    });

    const content = response.getContentText();
    tests.push({
      name: 'Browser User-Agent Only',
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200,
      isHtml: content.includes('<html'),
      isJson: content.startsWith('{') || content.startsWith('['),
      preview: content.substring(0, 200)
    });
  } catch (error) {
    tests.push({
      name: 'Browser User-Agent Only',
      success: false,
      error: error.toString()
    });
  }

  // Test 2: With full browser headers
  try {
    const url = 'https://www.reddit.com/r/python/top.json?t=day&limit=5';
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.reddit.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      muteHttpExceptions: true
    });

    const content = response.getContentText();
    tests.push({
      name: 'Full Browser Headers',
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200,
      isHtml: content.includes('<html'),
      isJson: content.startsWith('{') || content.startsWith('['),
      preview: content.substring(0, 200)
    });
  } catch (error) {
    tests.push({
      name: 'Full Browser Headers',
      success: false,
      error: error.toString()
    });
  }

  // Test 3: Try old.reddit.com
  try {
    const url = 'https://old.reddit.com/r/python/top.json?t=day&limit=5';
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'script:RedditAnalyzer:v1.0.0 (by /u/gamestopfan)'
      },
      muteHttpExceptions: true
    });

    const content = response.getContentText();
    tests.push({
      name: 'old.reddit.com with script UA',
      statusCode: response.getResponseCode(),
      success: response.getResponseCode() === 200,
      isHtml: content.includes('<html'),
      isJson: content.startsWith('{') || content.startsWith('['),
      preview: content.substring(0, 200)
    });
  } catch (error) {
    tests.push({
      name: 'old.reddit.com with script UA',
      success: false,
      error: error.toString()
    });
  }

  console.log('=== BROWSER HEADERS TEST RESULTS ===');
  console.log(JSON.stringify(tests, null, 2));

  return {
    timestamp: new Date().toISOString(),
    tests: tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.success).length,
      failed: tests.filter(t => !t.success).length,
      recommendation: tests.filter(t => t.success).length > 0
        ? 'One or more methods worked! Use that approach.'
        : 'All methods failed. Reddit may be blocking Google Apps Script IPs entirely.'
    }
  };
}
