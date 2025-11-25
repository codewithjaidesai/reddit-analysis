// Test if the OAuth app itself is banned vs IP blocking
// This will help us understand if we need new credentials or a different approach

function diagnoseOAuthAppStatus() {
  console.log('=== Diagnosing if OAuth app is banned vs IP blocked ===');

  const results = {
    timestamp: new Date().toISOString(),
    findings: []
  };

  // Test 1: Can we get a token at all?
  try {
    const token = getRedditAccessToken();
    results.findings.push({
      test: 'OAuth Token Generation',
      status: 'SUCCESS',
      note: 'Can get access token - app credentials are valid',
      tokenPreview: token.substring(0, 30) + '...'
    });

    // Test 2: Decode the token to see scopes (it's a JWT)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = Utilities.newBlob(
          Utilities.base64Decode(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        ).getDataAsString();
        const decoded = JSON.parse(payload);

        results.findings.push({
          test: 'Token Payload Inspection',
          status: 'SUCCESS',
          scopes: decoded.scopes || decoded.scope || 'No scopes found',
          expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'Unknown',
          clientId: decoded.client_id || 'Unknown'
        });
      }
    } catch (e) {
      results.findings.push({
        test: 'Token Payload Inspection',
        status: 'FAILED',
        error: e.toString(),
        note: 'Could not decode JWT token'
      });
    }

  } catch (error) {
    results.findings.push({
      test: 'OAuth Token Generation',
      status: 'FAILED',
      error: error.toString(),
      note: 'Cannot get token - credentials may be invalid or app is banned'
    });

    console.log(JSON.stringify(results, null, 2));
    return results;
  }

  // Test 3: Check if it's IP-based blocking by looking at response headers
  const token = getRedditAccessToken();
  try {
    const response = UrlFetchApp.fetch('https://oauth.reddit.com/api/v1/me', {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });

    const headers = response.getAllHeaders();
    const statusCode = response.getResponseCode();
    const content = response.getContentText();

    results.findings.push({
      test: 'OAuth API Call Analysis',
      statusCode: statusCode,
      headers: {
        'retry-after': headers['Retry-After'] || headers['retry-after'] || 'none',
        'x-ratelimit-remaining': headers['X-Ratelimit-Remaining'] || 'none',
        'server': headers['Server'] || headers['server'] || 'unknown'
      },
      isHtml: content.includes('<html') || content.includes('<body'),
      contentPreview: content.substring(0, 200),
      diagnosis: statusCode === 403 && content.includes('<html')
        ? 'IP-BASED BLOCKING: Reddit is returning HTML error page instead of JSON'
        : statusCode === 403
        ? 'OAUTH APP ISSUE: 403 but not HTML response'
        : statusCode === 401
        ? 'AUTHENTICATION ISSUE: Token is invalid or expired'
        : statusCode === 429
        ? 'RATE LIMIT: Too many requests'
        : 'UNKNOWN ISSUE'
    });

  } catch (error) {
    results.findings.push({
      test: 'OAuth API Call Analysis',
      status: 'FAILED',
      error: error.toString()
    });
  }

  console.log('=== DIAGNOSIS RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  return results;
}
