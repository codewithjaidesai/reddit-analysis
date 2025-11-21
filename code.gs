// Reddit API Configuration
const REDDIT_CONFIG = {
  clientId: 'FSkASxBHOGaYVZLWpQO9TA',
  clientSecret: 'AnNiJyAazf5-iW5s16ppCzXJbLNwEw',
  userAgent: 'web:RedditAnalyzer:v1.0.0 (by /u/gamestopfan)'
};

// Gemini AI Configuration
const GEMINI_CONFIG = {
  apiKey: PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),
  model: 'gemini-2.5-flash', // Verified: This model exists and is available for your API key
  // Fallback models in order of preference (if primary fails)
  fallbackModels: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest'],
  apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/'
};

// Test function to verify backend is working
function testBackendConnection() {
  return {
    success: true,
    message: 'Backend connection working!',
    timestamp: new Date().toISOString()
  };
}

// List all available Gemini models
function listGeminiModels() {
  console.log('Listing available Gemini models...');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_CONFIG.apiKey}`;

    const options = {
      method: 'GET',
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    console.log('Response code:', responseCode);

    if (responseCode !== 200) {
      const errorText = response.getContentText();
      console.error('API error:', errorText);
      return {
        success: false,
        error: errorText
      };
    }

    const result = JSON.parse(response.getContentText());

    console.log('Available models:', JSON.stringify(result, null, 2));

    // Extract model names that support generateContent
    const models = result.models || [];
    const generateContentModels = models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description
      }));

    return {
      success: true,
      totalModels: models.length,
      generateContentModels: generateContentModels,
      allModels: models.map(m => m.name)
    };

  } catch (error) {
    console.error('Error listing models:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Test function to verify Gemini API is working
function testGeminiAPI() {
  console.log('Testing Gemini API connection...');

  const testPrompt = "Say 'Hello! Gemini API is working correctly.' and nothing else.";

  try {
    const result = analyzeWithGemini(testPrompt);

    if (result.success) {
      return {
        success: true,
        message: 'Gemini API is working!',
        response: result.analysis,
        model: result.model
      };
    } else {
      return {
        success: false,
        message: 'Gemini API failed',
        error: result.error || result.message
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Gemini API test failed',
      error: error.toString()
    };
  }
}

// Test Reddit OAuth
function testRedditAuth() {
  try {
    const token = getRedditAccessToken();
    return {
      success: true,
      message: 'OAuth token obtained successfully',
      tokenLength: token ? token.length : 0
    };
  } catch (error) {
    return {
      success: false,
      message: 'OAuth failed: ' + error.message,
      error: error.toString()
    };
  }
}

// Cache Reddit access token in Script Properties
function getRedditAccessToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const cachedToken = scriptProperties.getProperty('reddit_token');
  const tokenExpiry = scriptProperties.getProperty('reddit_token_expiry');
  
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiry && new Date() < new Date(tokenExpiry)) {
    console.log('Using cached Reddit token');
    return cachedToken;
  }
  
  console.log('Fetching new Reddit token');
  
  // Get new token using client credentials flow
  const auth = Utilities.base64Encode(`${REDDIT_CONFIG.clientId}:${REDDIT_CONFIG.clientSecret}`);
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_CONFIG.userAgent
    },
    payload: 'grant_type=client_credentials',
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch('https://www.reddit.com/api/v1/access_token', options);
    const data = JSON.parse(response.getContentText());
    
    if (data.access_token) {
      // Cache token with expiry
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + (data.expires_in - 60)); // Expire 1 minute early
      
      scriptProperties.setProperty('reddit_token', data.access_token);
      scriptProperties.setProperty('reddit_token_expiry', expiryDate.toISOString());
      
      return data.access_token;
    } else {
      throw new Error('Failed to get Reddit access token');
    }
  } catch (error) {
    console.error('Token fetch error:', error);
    throw new Error('Failed to authenticate with Reddit API');
  }
}

// ============================================================================
// GEMINI AI ANALYSIS
// ============================================================================

/**
 * Call Gemini API to analyze Reddit content with AI
 * Now with retry logic and fallback models for reliability
 * @param {string} prompt - The analysis prompt with Reddit data
 * @returns {object} AI analysis result
 */
function analyzeWithGemini(prompt) {
  console.log('Calling Gemini API for AI analysis...');

  // Try primary model with retries
  const primaryResult = callGeminiWithRetry(GEMINI_CONFIG.model, prompt, 3);

  if (primaryResult.success) {
    return primaryResult;
  }

  // If primary model failed with 503 (overloaded) or 429 (quota), try fallbacks
  console.log('Primary model failed, trying fallback models...');

  for (const fallbackModel of GEMINI_CONFIG.fallbackModels) {
    console.log(`Trying fallback model: ${fallbackModel}`);
    const result = callGeminiWithRetry(fallbackModel, prompt, 2);

    if (result.success) {
      console.log(`✅ Fallback model ${fallbackModel} succeeded!`);
      return result;
    }
  }

  // All models failed
  return {
    success: false,
    error: 'All AI models failed. Google servers may be overloaded or quota exceeded.',
    message: 'AI analysis temporarily unavailable. Please try again in a few minutes, or check your API quota at https://console.cloud.google.com/apis/dashboard'
  };
}

/**
 * Call Gemini API with automatic retry on 503 errors
 * @param {string} modelName - The model to use
 * @param {string} prompt - The prompt text
 * @param {number} maxRetries - Maximum number of retries
 * @returns {object} Result object
 */
function callGeminiWithRetry(modelName, prompt, maxRetries = 3) {
  // High limits for complete, comprehensive analysis (not truncated)
  const maxOutputTokens = modelName.includes('2.5') || modelName.includes('pro') ? 65536 : 8192;
  const topK = modelName.includes('2.5') || modelName.includes('pro') ? 64 : 40;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `${GEMINI_CONFIG.apiUrl}${modelName}:generateContent?key=${GEMINI_CONFIG.apiKey}`;

      const payload = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: topK,
          topP: 0.95,
          maxOutputTokens: maxOutputTokens,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      };

      const options = {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      console.log(`Attempt ${attempt}/${maxRetries} for model: ${modelName}`);
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();

      console.log(`Response code: ${responseCode}`);

      // Handle different error codes
      if (responseCode === 503) {
        // Model overloaded - retry with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⚠️ Model overloaded (503). Waiting ${waitTime/1000}s before retry...`);

        if (attempt < maxRetries) {
          Utilities.sleep(waitTime);
          continue; // Retry
        } else {
          return {
            success: false,
            error: `Model ${modelName} is overloaded`,
            code: 503
          };
        }
      }

      if (responseCode === 429) {
        // Quota exceeded - don't retry, try different model
        console.log('❌ Quota exceeded (429)');
        return {
          success: false,
          error: 'API quota exceeded',
          code: 429
        };
      }

      if (responseCode === 404) {
        // Model not found - don't retry
        console.log(`❌ Model ${modelName} not found (404)`);
        return {
          success: false,
          error: `Model ${modelName} not available`,
          code: 404
        };
      }

      if (responseCode !== 200) {
        const errorText = response.getContentText();
        console.error(`Gemini API error (${responseCode}):`, errorText);
        return {
          success: false,
          error: errorText,
          code: responseCode
        };
      }

      // Success!
      const result = JSON.parse(response.getContentText());

      // Extract the AI-generated text
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {

        const aiAnalysis = result.candidates[0].content.parts[0].text;
        console.log(`✅ Success! Analysis received (${aiAnalysis.length} chars) from ${modelName}`);

        return {
          success: true,
          analysis: aiAnalysis,
          model: modelName
        };
      } else {
        throw new Error('Unexpected response format from Gemini API');
      }

    } catch (error) {
      console.error(`Exception on attempt ${attempt}:`, error.toString());

      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.toString(),
          message: 'AI analysis failed: ' + error.message
        };
      }

      // Wait before retry
      Utilities.sleep(2000);
    }
  }

  // Should never reach here, but just in case
  return {
    success: false,
    error: 'Max retries exceeded',
    message: 'AI analysis failed after multiple attempts'
  };
}

// ============================================================================
// REDDIT TOPIC SEARCH
// ============================================================================

/**
 * Search Reddit by topic and return high-engagement posts
 * @param {string} topic - Search query (e.g., "AI and machine learning")
 * @param {string} timeRange - Time filter: week, month, year (default: week)
 * @param {string} subreddits - Optional: comma-separated list (e.g., "MachineLearning,artificial")
 * @param {number} limit - Number of results to return (default: 15)
 */
function searchRedditByTopic(topic, timeRange = 'week', subreddits = '', limit = 15) {
  console.log('Searching Reddit for:', topic, 'Time:', timeRange, 'Subreddits:', subreddits, 'Limit:', limit);

  try {
    // Use Reddit's public JSON API (no authentication required)
    // This avoids 403 errors from OAuth authentication issues
    let searchUrl = 'https://www.reddit.com/search.json';
    let params = {
      'q': topic,
      't': timeRange, // hour, day, week, month, year, all
      'sort': 'relevance', // Use Reddit's relevance algorithm for best keyword matching
      'limit': 100, // Get more posts to filter by engagement
      'restrict_sr': 'false',
      'type': 'link', // Only posts, not comments
      'raw_json': 1 // Prevent HTML entity encoding
    };

    // If specific subreddits requested, search within them
    if (subreddits && subreddits.trim()) {
      const subredditList = subreddits.split(',').map(s => s.trim()).filter(s => s);
      if (subredditList.length > 0) {
        // Add subreddit restriction to query with proper parentheses for OR grouping
        params.q = `${topic} (subreddit:${subredditList.join(' OR subreddit:')})`;
      }
    }

    // Build query string
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const fullUrl = `${searchUrl}?${queryString}`;

    const options = {
      method: 'GET',
      headers: {
        'User-Agent': REDDIT_CONFIG.userAgent
      },
      muteHttpExceptions: true
    };

    console.log('Fetching from URL:', fullUrl);
    const response = UrlFetchApp.fetch(fullUrl, options);
    const responseCode = response.getResponseCode();
    console.log('Response code:', responseCode);

    if (responseCode !== 200) {
      throw new Error(`Reddit API returned status ${responseCode}: ${response.getContentText().substring(0, 500)}`);
    }

    const data = JSON.parse(response.getContentText());
    console.log('Parsed response, found posts:', data.data?.children?.length || 0);

    if (!data || !data.data || !data.data.children) {
      throw new Error('Invalid response from Reddit API: ' + JSON.stringify(data).substring(0, 200));
    }

    const posts = data.data.children.map(child => child.data);
    console.log('Processing', posts.length, 'posts');

    // Filter and score posts
    const scoredPosts = posts
      .filter(post => {
        // Filter out low-quality posts
        return post.score >= 20 &&
               post.num_comments >= 10 &&
               post.upvote_ratio >= 0.7 &&
               !post.is_video && // Skip videos for now
               !post.stickied; // Skip stickied mod posts
      })
      .map(post => {
        // Calculate engagement score
        const engagementScore = post.score + (post.num_comments * 2);

        // Calculate relative engagement (per 10k subscribers)
        const engagementRate = post.subreddit_subscribers > 0
          ? (post.score / post.subreddit_subscribers) * 10000
          : 0;

        // Determine engagement tier
        let engagementTier = 'low';
        let engagementStars = 2;
        if (post.score >= 1000 || engagementRate >= 5) {
          engagementTier = 'viral';
          engagementStars = 5;
        } else if (post.score >= 500 || engagementRate >= 3) {
          engagementTier = 'high';
          engagementStars = 4;
        } else if (post.score >= 100 || engagementRate >= 1) {
          engagementTier = 'medium';
          engagementStars = 3;
        }

        // Calculate post age
        const postAgeHours = (Date.now() - (post.created_utc * 1000)) / (1000 * 60 * 60);
        let ageText = '';
        if (postAgeHours < 1) {
          ageText = Math.floor(postAgeHours * 60) + ' minutes ago';
        } else if (postAgeHours < 24) {
          ageText = Math.floor(postAgeHours) + ' hours ago';
        } else {
          ageText = Math.floor(postAgeHours / 24) + ' days ago';
        }

        return {
          id: post.id,
          title: post.title,
          subreddit: post.subreddit,
          subreddit_subscribers: post.subreddit_subscribers,
          score: post.score,
          num_comments: post.num_comments,
          upvote_ratio: post.upvote_ratio,
          created_utc: post.created_utc,
          url: 'https://www.reddit.com' + post.permalink,
          selftext: post.selftext ? post.selftext.substring(0, 200) : '',
          post_hint: post.post_hint || 'text',
          engagementScore: engagementScore,
          engagementRate: Math.round(engagementRate * 10) / 10,
          engagementTier: engagementTier,
          engagementStars: engagementStars,
          ageText: ageText,
          ageHours: postAgeHours
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    console.log(`Found ${scoredPosts.length} high-engagement posts`);

    return {
      success: true,
      query: topic,
      timeRange: timeRange,
      totalFound: posts.length,
      afterFiltering: scoredPosts.length,
      posts: scoredPosts
    };

  } catch (error) {
    console.error('Search error:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.toString(),
      message: 'Failed to search Reddit: ' + error.message,
      posts: []
    };
  }
}

/**
 * Search top posts from a specific subreddit
 * @param {string} subreddit - Subreddit name (without r/)
 * @param {string} timeRange - Time filter: day, week, month, year (default: week)
 * @param {number} limit - Number of results to return (default: 15)
 */
function searchSubredditTopPosts(subreddit, timeRange = 'week', limit = 15) {
  console.log('Searching subreddit:', subreddit, 'Time:', timeRange, 'Limit:', limit);

  try {
    // Use Reddit OAuth API to avoid 403 errors
    const accessToken = getRedditAccessToken();
    const searchUrl = `https://oauth.reddit.com/r/${subreddit}/top`;
    const params = {
      't': timeRange, // hour, day, week, month, year, all
      'limit': 50, // Get more than we need for filtering
      'raw_json': 1 // Prevent HTML entity encoding
    };

    // Build query string
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const fullUrl = `${searchUrl}?${queryString}`;

    const options = {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': REDDIT_CONFIG.userAgent
      },
      muteHttpExceptions: true
    };

    console.log('Fetching from URL:', fullUrl);
    const response = UrlFetchApp.fetch(fullUrl, options);
    const responseCode = response.getResponseCode();
    console.log('Response code:', responseCode);

    if (responseCode !== 200) {
      throw new Error(`Reddit API returned status ${responseCode}: ${response.getContentText().substring(0, 500)}`);
    }

    const data = JSON.parse(response.getContentText());
    console.log('Parsed response, found posts:', data.data?.children?.length || 0);

    if (!data || !data.data || !data.data.children) {
      throw new Error('Invalid response from Reddit API: ' + JSON.stringify(data).substring(0, 200));
    }

    const posts = data.data.children.map(child => child.data);
    console.log('Processing', posts.length, 'posts');

    // Filter and score posts (same logic as topic search)
    const scoredPosts = posts
      .filter(post => {
        // Filter out low-quality posts
        return post.score >= 20 &&
               post.num_comments >= 10 &&
               post.upvote_ratio >= 0.7 &&
               !post.is_video && // Skip videos for now
               !post.stickied; // Skip stickied mod posts
      })
      .map(post => {
        // Calculate engagement score
        const engagementScore = post.score + (post.num_comments * 2);

        // Calculate relative engagement (per 10k subscribers)
        const engagementRate = post.subreddit_subscribers > 0
          ? (post.score / post.subreddit_subscribers) * 10000
          : 0;

        // Determine engagement tier
        let engagementTier = 'low';
        let engagementStars = 2;
        if (post.score >= 1000 || engagementRate >= 5) {
          engagementTier = 'viral';
          engagementStars = 5;
        } else if (post.score >= 500 || engagementRate >= 3) {
          engagementTier = 'high';
          engagementStars = 4;
        } else if (post.score >= 100 || engagementRate >= 1) {
          engagementTier = 'medium';
          engagementStars = 3;
        }

        // Calculate post age
        const postAgeHours = (Date.now() - (post.created_utc * 1000)) / (1000 * 60 * 60);
        let ageText = '';
        if (postAgeHours < 1) {
          ageText = Math.floor(postAgeHours * 60) + ' minutes ago';
        } else if (postAgeHours < 24) {
          ageText = Math.floor(postAgeHours) + ' hours ago';
        } else {
          ageText = Math.floor(postAgeHours / 24) + ' days ago';
        }

        return {
          id: post.id,
          title: post.title,
          subreddit: post.subreddit,
          subreddit_subscribers: post.subreddit_subscribers,
          score: post.score,
          num_comments: post.num_comments,
          upvote_ratio: post.upvote_ratio,
          created_utc: post.created_utc,
          url: 'https://www.reddit.com' + post.permalink,
          selftext: post.selftext ? post.selftext.substring(0, 200) : '',
          post_hint: post.post_hint || 'text',
          engagementScore: engagementScore,
          engagementRate: Math.round(engagementRate * 10) / 10,
          engagementTier: engagementTier,
          engagementStars: engagementStars,
          ageText: ageText,
          ageHours: postAgeHours
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    console.log(`Found ${scoredPosts.length} high-engagement posts from r/${subreddit}`);

    return {
      success: true,
      subreddit: subreddit,
      timeRange: timeRange,
      totalFound: posts.length,
      afterFiltering: scoredPosts.length,
      posts: scoredPosts
    };

  } catch (error) {
    console.error('Subreddit search error:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.toString(),
      message: 'Failed to search r/' + subreddit + ': ' + error.message,
      posts: []
    };
  }
}

function doGet(e) {
  // If no URL parameter, serve the HTML interface
  if (!e.parameter.url) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Reddit Analyzer')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Otherwise, handle JSONP requests for URL extraction
  const output = ContentService.createTextOutput();

  try {
    const url = e.parameter.url;
    const mode = e.parameter.mode || 'deep'; // 'deep', 'overview', 'step1_extract', 'step2_recommend', 'step3_analyze'
    const callback = e.parameter.callback;

    console.log('Processing request for:', url, 'Mode:', mode);

    let processedData;

    if (mode === 'overview') {
      // Subreddit overview mode
      const redditData = fetchSubredditOverview(url);
      processedData = processSubredditOverview(redditData, url);
    } else if (mode === 'step1_extract') {
      // Step 1: Extract valuable content only
      const rawRedditData = fetchAuthenticatedRedditData(url);

      console.log('Step1: Raw Reddit data received, length:', rawRedditData ? rawRedditData.length : 'null');

      // Parse raw Reddit API data structure
      let post = null;
      let comments = [];

      if (Array.isArray(rawRedditData) && rawRedditData.length >= 1) {
        // Extract post data
        if (rawRedditData[0] && rawRedditData[0].data && rawRedditData[0].data.children) {
          post = rawRedditData[0].data.children[0].data;
          console.log('Step1: Extracted post:', post ? post.title : 'null');
        }

        // Extract comments data
        if (rawRedditData[1] && rawRedditData[1].data && rawRedditData[1].data.children) {
          const rawComments = rawRedditData[1].data.children;
          console.log('Step1: Raw comments found:', rawComments.length);
          comments = extractAllComments(rawComments);
          console.log('Step1: Extracted comments (recursive):', comments.length);
        } else {
          console.log('Step1: No comments data found in rawRedditData[1]');
        }
      } else {
        console.log('Step1: rawRedditData is not an array or empty');
      }

      // Filter valid comments
      const validComments = comments.filter(comment =>
        comment.body &&
        comment.body !== '[deleted]' &&
        comment.body !== '[removed]' &&
        comment.author &&
        comment.author !== '[deleted]' &&
        comment.body.trim().length > 10
      );

      console.log('Step1: Valid comments after filtering:', validComments.length);
      console.log('Step1: First 3 comment bodies:', validComments.slice(0, 3).map(c => c.body ? c.body.substring(0, 50) : 'no body'));

      // Pass structured data to extraction function
      processedData = extractValuableContentOnly({
        post: post,
        comments: validComments
      });
    } else if (mode === 'step2_recommend') {
      // Step 2: Analyze content and recommend analyses
      // Re-fetch and extract to avoid URL length issues
      console.log('Step2: Starting recommendation analysis');
      const rawRedditData = fetchAuthenticatedRedditData(url);
      console.log('Step2: Reddit data fetched');

      let post = null;
      let comments = [];

      if (Array.isArray(rawRedditData) && rawRedditData.length >= 1) {
        if (rawRedditData[0] && rawRedditData[0].data && rawRedditData[0].data.children) {
          post = rawRedditData[0].data.children[0].data;
        }
        if (rawRedditData[1] && rawRedditData[1].data && rawRedditData[1].data.children) {
          const rawComments = rawRedditData[1].data.children;
          comments = extractAllComments(rawComments);
        }
      }

      const validComments = comments.filter(comment =>
        comment.body &&
        comment.body !== '[deleted]' &&
        comment.body !== '[removed]' &&
        comment.author &&
        comment.author !== '[deleted]' &&
        comment.body.trim().length > 10
      );

      console.log('Step2: Valid comments:', validComments.length);

      const contentData = extractValuableContentOnly({
        post: post,
        comments: validComments
      });

      console.log('Step2: Content extracted, calling analyzeAndRecommend');
      processedData = analyzeAndRecommend(contentData);
      console.log('Step2: Recommendations generated:', processedData.totalRecommendations);
    } else if (mode === 'step3_analyze') {
      console.log('=== STEP 3 ANALYZE MODE TRIGGERED ===');
      console.log('Selected analyses:', e.parameter.selectedAnalyses);

      // Step 3: Generate AI-powered insights
      // Re-fetch to avoid URL length issues
      console.log('Fetching Reddit data for Step 3...');
      const rawRedditData = fetchAuthenticatedRedditData(url);
      const selectedAnalyses = JSON.parse(e.parameter.selectedAnalyses || '[]');
      console.log('Parsed selected analyses:', selectedAnalyses);

      let post = null;
      let comments = [];

      if (Array.isArray(rawRedditData) && rawRedditData.length >= 1) {
        if (rawRedditData[0] && rawRedditData[0].data && rawRedditData[0].data.children) {
          post = rawRedditData[0].data.children[0].data;
        }
        if (rawRedditData[1] && rawRedditData[1].data && rawRedditData[1].data.children) {
          const rawComments = rawRedditData[1].data.children;
          comments = extractAllComments(rawComments);
        }
      }

      console.log('Extracted post and', comments.length, 'comments');

      const validComments = comments.filter(comment =>
        comment.body &&
        comment.body !== '[deleted]' &&
        comment.body !== '[removed]' &&
        comment.author &&
        comment.author !== '[deleted]' &&
        comment.body.trim().length > 10
      );

      console.log('Filtered to', validComments.length, 'valid comments');

      const contentData = extractValuableContentOnly({
        post: post,
        comments: validComments
      });

      console.log('Content data prepared, calling generateAIInsights...');

      // Use AI-powered insights instead of regex-based analysis
      try {
        processedData = generateAIInsights(contentData);
        console.log('AI insights generated successfully!');
      } catch (error) {
        console.error('Failed to generate AI insights:', error);
        throw error; // Re-throw so user sees the error
      }
    } else {
      // Deep dive mode for single post
      const redditData = fetchAuthenticatedRedditData(url);
      processedData = processRealRedditData(redditData);
    }
    
    const responseData = {
      success: true,
      message: "Real Reddit data fetched successfully!",
      receivedUrl: url,
      mode: mode,
      timestamp: new Date().toISOString(),
      data: processedData,
      dataSource: "Reddit OAuth API"
    };
    
    if (callback) {
      output.setMimeType(ContentService.MimeType.JAVASCRIPT);
      return output.setContent(callback + '(' + JSON.stringify(responseData) + ');');
    } else {
      output.setMimeType(ContentService.MimeType.JSON);
      return output.setContent(JSON.stringify(responseData));
    }
    
  } catch (error) {
    console.error('Error:', error);
    
    const errorResponse = {
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
      dataSource: "Error"
    };
    
    if (e.parameter.callback) {
      output.setMimeType(ContentService.MimeType.JAVASCRIPT);
      return output.setContent(e.parameter.callback + '(' + JSON.stringify(errorResponse) + ');');
    } else {
      output.setMimeType(ContentService.MimeType.JSON);
      return output.setContent(JSON.stringify(errorResponse));
    }
  }
}

// Handle POST requests with extracted data (avoids re-fetching from Reddit)
function doPost(e) {
  const output = ContentService.createTextOutput();

  try {
    console.log('=== POST REQUEST RECEIVED ===');

    // Parse POST body
    const postData = JSON.parse(e.postData.contents);
    const mode = postData.mode;
    const contentData = postData.contentData;

    console.log('POST mode:', mode);
    console.log('ContentData received:', {
      hasPost: !!contentData.post,
      commentsCount: contentData.valuableComments?.length || 0,
      hasStats: !!contentData.extractionStats
    });

    let processedData;

    if (mode === 'step3_analyze') {
      console.log('=== STEP 3 ANALYZE MODE (POST) ===');
      console.log('Using provided contentData - NO Reddit API call!');

      // Use AI-powered insights with provided data
      try {
        processedData = generateAIInsights(contentData);
        console.log('AI insights generated successfully from provided data!');
      } catch (error) {
        console.error('Failed to generate AI insights:', error);
        throw error;
      }
    } else {
      throw new Error('Unsupported mode for POST request: ' + mode);
    }

    const responseData = {
      success: true,
      message: "Insights generated from provided data (no Reddit API call)",
      mode: mode,
      timestamp: new Date().toISOString(),
      data: processedData,
      dataSource: "Provided ContentData"
    };

    output.setMimeType(ContentService.MimeType.JSON);
    return output.setContent(JSON.stringify(responseData));

  } catch (error) {
    console.error('POST Error:', error);

    const errorResponse = {
      success: false,
      error: error.toString(),
      message: error.message || 'Unknown error in POST handler',
      timestamp: new Date().toISOString()
    };

    output.setMimeType(ContentService.MimeType.JSON);
    return output.setContent(JSON.stringify(errorResponse));
  }
}

// Generate insights from provided content data (called via google.script.run from client)
// This avoids CORS issues and eliminates redundant Reddit API calls
function generateInsightsFromData(contentData) {
  try {
    console.log('=== generateInsightsFromData called via google.script.run ===');
    console.log('ContentData received:', {
      hasPost: !!contentData.post,
      postTitle: contentData.post?.title?.substring(0, 50) || 'N/A',
      commentsCount: contentData.valuableComments?.length || 0,
      hasStats: !!contentData.extractionStats,
      statsExtracted: contentData.extractionStats?.extracted || 0
    });

    // Validate contentData
    if (!contentData || !contentData.post) {
      throw new Error('Invalid contentData: Missing post data');
    }
    if (!contentData.valuableComments || contentData.valuableComments.length === 0) {
      throw new Error('Invalid contentData: No valuable comments found');
    }

    console.log('✓ Data validation passed');
    console.log('Using provided contentData - NO Reddit API call!');

    // Use AI-powered insights with provided data
    console.log('Calling generateAIInsights...');
    const processedData = generateAIInsights(contentData);
    console.log('✓ AI insights generated successfully from provided data!');

    return {
      success: true,
      message: "Insights generated from provided data (no Reddit API call)",
      timestamp: new Date().toISOString(),
      data: processedData,
      dataSource: "Provided ContentData"
    };

  } catch (error) {
    console.error('❌ generateInsightsFromData Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return {
      success: false,
      error: error.toString(),
      message: error.message || 'Unknown error in generateInsightsFromData',
      timestamp: new Date().toISOString()
    };
  }
}

// Fetch subreddit overview (all posts, basic stats)
function fetchSubredditOverview(inputUrl) {
  const accessToken = getRedditAccessToken();
  
  // Extract subreddit name
  const subreddit = inputUrl.replace(/^r\//, '').replace(/^\/r\//, '').replace(/\/$/, '');
  
  // Get posts from the last 24 hours (hot, new, and top)
  const endpoints = [
    `https://oauth.reddit.com/r/${subreddit}/hot?limit=50&raw_json=1`,
    `https://oauth.reddit.com/r/${subreddit}/new?limit=50&raw_json=1`,
    `https://oauth.reddit.com/r/${subreddit}/top?t=day&limit=50&raw_json=1`
  ];
  
  const allPosts = [];
  const seenIds = new Set();
  
  endpoints.forEach(apiUrl => {
    console.log('Fetching from:', apiUrl);
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': REDDIT_CONFIG.userAgent,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(apiUrl, options);
      if (response.getResponseCode() === 200) {
        const data = JSON.parse(response.getContentText());
        if (data.data && data.data.children) {
          data.data.children.forEach(child => {
            if (!seenIds.has(child.data.id) && !child.data.stickied) {
              seenIds.add(child.data.id);
              allPosts.push(child.data);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching from endpoint:', apiUrl, error);
    }
  });
  
  return allPosts;
}

// Process subreddit overview data
function processSubredditOverview(posts, subreddit) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Filter posts from last 24 hours
  const recentPosts = posts.filter(post => {
    const postTime = new Date(post.created_utc * 1000);
    return postTime >= yesterday;
  });
  
  // Sort by score
  recentPosts.sort((a, b) => b.score - a.score);
  
  // Calculate overview stats
  const totalScore = recentPosts.reduce((sum, post) => sum + post.score, 0);
  const totalComments = recentPosts.reduce((sum, post) => sum + post.num_comments, 0);
  const avgScore = recentPosts.length > 0 ? Math.round(totalScore / recentPosts.length) : 0;
  const avgComments = recentPosts.length > 0 ? Math.round(totalComments / recentPosts.length) : 0;
  
  // Find posts with high engagement relative to average
  const highEngagementPosts = recentPosts.filter(post => 
    post.score > avgScore * 2 || post.num_comments > avgComments * 2
  );
  
  // Format posts for display
  const formattedPosts = recentPosts.map(post => ({
    id: post.id,
    title: post.title,
    score: post.score,
    num_comments: post.num_comments,
    author: post.author,
    created_utc: post.created_utc,
    permalink: post.permalink,
    url: post.url,
    is_self: post.is_self,
    upvote_ratio: post.upvote_ratio,
    awards: post.total_awards_received || 0,
    engagement_score: post.score + (post.num_comments * 10), // Custom engagement metric
    is_high_engagement: post.score > avgScore * 2 || post.num_comments > avgComments * 2
  }));
  
  return {
    subreddit: subreddit,
    timeframe: '24 hours',
    posts: formattedPosts,
    stats: {
      totalPosts: recentPosts.length,
      totalScore: totalScore,
      totalComments: totalComments,
      avgScore: avgScore,
      avgComments: avgComments,
      highEngagementCount: highEngagementPosts.length,
      topPost: recentPosts[0] ? {
        title: recentPosts[0].title,
        score: recentPosts[0].score,
        comments: recentPosts[0].num_comments,
        permalink: recentPosts[0].permalink
      } : null
    }
  };
}

function fetchAuthenticatedRedditData(inputUrl) {
  const accessToken = getRedditAccessToken();
  let apiUrl;
  
  if (inputUrl.includes('reddit.com')) {
    if (inputUrl.includes('/comments/')) {
      const postMatch = inputUrl.match(/comments\/([a-zA-Z0-9]+)/);
      if (postMatch) {
        // Increased limits for deep dive
        apiUrl = `https://oauth.reddit.com/comments/${postMatch[1]}?limit=200&depth=5&sort=top&raw_json=1`;
      } else {
        throw new Error('Invalid Reddit post URL format');
      }
    } else {
      throw new Error('Please provide a direct post URL or subreddit name');
    }
  } else {
    // For backward compatibility - treat as subreddit overview
    return fetchSubredditOverview(inputUrl);
  }
  
  console.log('Fetching from:', apiUrl);
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `bearer ${accessToken}`,
      'User-Agent': REDDIT_CONFIG.userAgent,
      'Accept': 'application/json'
    },
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: false
  };
  
  try {
    const startTime = new Date().getTime();
    const response = UrlFetchApp.fetch(apiUrl, options);
    const endTime = new Date().getTime();
    
    console.log(`Fetch took ${endTime - startTime}ms`);
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    console.log(`Response code: ${responseCode}, size: ${responseText.length} bytes`);
    
    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      console.log('Successfully got Reddit data');
      return data;
    } else if (responseCode === 401) {
      PropertiesService.getScriptProperties().deleteProperty('reddit_token');
      PropertiesService.getScriptProperties().deleteProperty('reddit_token_expiry');
      throw new Error('Authentication failed - token expired');
    } else if (responseCode === 429) {
      throw new Error('Reddit rate limit - please wait 60 seconds');
    } else {
      throw new Error(`Reddit API error ${responseCode}`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    throw new Error(`Failed to fetch Reddit data: ${error.message}`);
  }
}

function processRealRedditData(redditData) {
  let posts = [];
  let comments = [];

  console.log('Processing Reddit data structure...');

  if (Array.isArray(redditData) && redditData.length >= 1) {
    // Post data (always in first array element)
    if (redditData[0] && redditData[0].data && redditData[0].data.children) {
      const postData = redditData[0].data.children[0].data;
      posts.push(postData);
      console.log('Found post:', postData.title);
    }

    // Comments data (in second array element if it exists)
    if (redditData[1] && redditData[1].data && redditData[1].data.children) {
      const rawComments = redditData[1].data.children;
      console.log(`Found ${rawComments.length} top-level comment objects`);

      // Process comments recursively to get nested replies
      comments = extractAllComments(rawComments);
      console.log(`Extracted ${comments.length} total comments including replies`);
    }
  } else if (redditData.data && redditData.data.children) {
    // Subreddit listing - shouldn't happen in deep dive mode
    throw new Error('Got subreddit data instead of post data');
  }

  // Filter out deleted/removed comments
  const validComments = comments.filter(comment =>
    comment.body &&
    comment.body !== '[deleted]' &&
    comment.body !== '[removed]' &&
    comment.author &&
    comment.author !== '[deleted]' &&
    comment.body.trim().length > 10
  );

  console.log(`${validComments.length} valid comments after filtering`);

  // Sort comments by score (highest first)
  validComments.sort((a, b) => (b.score || 0) - (a.score || 0));

  // NEW: Analyze post context to determine what insights to extract
  const post = posts[0];
  const postContext = analyzePostContext(post, validComments);
  console.log('Post context:', postContext.type, 'Topics:', postContext.topics);

  // NEW: Extract dynamic insights based on post context
  const dynamicInsights = extractDynamicInsights(post, validComments, postContext);

  return {
    postContext: postContext,
    insights: dynamicInsights,
    stats: {
      totalComments: validComments.length,
      totalScore: validComments.reduce((sum, c) => sum + (c.score || 0), 0),
      averageScore: validComments.length > 0 ? Math.round(validComments.reduce((sum, c) => sum + (c.score || 0), 0) / validComments.length) : 0,
      topScore: validComments.length > 0 ? Math.max(...validComments.map(c => c.score || 0)) : 0,
      postScore: post ? post.score : 0
    }
  };
}

// Extract special categories of comments
function extractSpecialComments(comments, postScore) {
  const tenPercentThreshold = Math.round(postScore * 0.1);
  
  // Comments with awards
  const awardedComments = comments.filter(comment => 
    comment.total_awards_received && comment.total_awards_received > 0
  ).map(comment => ({
    body: comment.body.substring(0, 500) + (comment.body.length > 500 ? '...' : ''),
    author: comment.author,
    score: comment.score,
    awards: comment.total_awards_received,
    permalink: comment.permalink,
    depth: comment.depth || 0
  }));
  
  // High-ratio comments (10% of post score)
  const highRatioComments = comments.filter(comment => 
    comment.score >= tenPercentThreshold && tenPercentThreshold > 100
  ).map(comment => ({
    body: comment.body.substring(0, 500) + (comment.body.length > 500 ? '...' : ''),
    author: comment.author,
    score: comment.score,
    scoreRatio: Math.round((comment.score / postScore) * 100),
    permalink: comment.permalink,
    depth: comment.depth || 0
  }));
  
  // Comments with high reply activity
  const highReplyComments = [];
  const controversialComments = [];
  
  comments.forEach(comment => {
    // Count direct replies
    const replyCount = countReplies(comment);
    
    // High reply activity (20+ replies in thread)
    if (replyCount > 20) {
      highReplyComments.push({
        body: comment.body.substring(0, 500) + (comment.body.length > 500 ? '...' : ''),
        author: comment.author,
        score: comment.score,
        replyCount: replyCount,
        permalink: comment.permalink,
        depth: comment.depth || 0
      });
    }
    
    // Controversial (high activity but mixed reception)
    const controversyScore = calculateControversy(comment, replyCount);
    if (controversyScore > 0.5) {
      controversialComments.push({
        body: comment.body.substring(0, 500) + (comment.body.length > 500 ? '...' : ''),
        author: comment.author,
        score: comment.score,
        controversyScore: controversyScore,
        replyCount: replyCount,
        permalink: comment.permalink,
        depth: comment.depth || 0
      });
    }
  });
  
  return {
    awarded: awardedComments.slice(0, 10),
    highRatio: highRatioComments.slice(0, 10),
    highReply: highReplyComments.slice(0, 10),
    controversial: controversialComments.slice(0, 10)
  };
}

// Count total replies in a comment thread
function countReplies(comment) {
  let count = 0;
  
  if (comment.replies && comment.replies.data && comment.replies.data.children) {
    comment.replies.data.children.forEach(reply => {
      if (reply.data && reply.data.body) {
        count++;
        count += countReplies(reply.data);
      }
    });
  }
  
  return count;
}

// Calculate controversy score
function calculateControversy(comment, replyCount) {
  // Factors: high replies, moderate score, high engagement
  const score = comment.score || 0;
  const hasControversialFlag = comment.controversiality === 1;
  
  // Calculate based on reply-to-score ratio and other factors
  let controversyScore = 0;
  
  if (replyCount > 10 && score < 100) {
    controversyScore += 0.3;
  }
  
  if (replyCount > 20 && score < 500) {
    controversyScore += 0.3;
  }
  
  if (hasControversialFlag) {
    controversyScore += 0.4;
  }
  
  // High reply-to-score ratio indicates debate
  if (replyCount > 0 && score > 0) {
    const ratio = replyCount / score;
    if (ratio > 0.5) controversyScore += 0.3;
  }
  
  return Math.min(controversyScore, 1);
}

function extractAllComments(commentObjects) {
  const allComments = [];

  function processComment(commentObj, depth = 0) {
    if (commentObj && commentObj.kind !== 'more' && commentObj.data && commentObj.data.body) {
      const comment = commentObj.data;
      comment.depth = depth; // Add depth for context
      allComments.push(comment);

      // Process replies recursively
      if (comment.replies && comment.replies.data && comment.replies.data.children) {
        comment.replies.data.children.forEach(reply => {
          processComment(reply, depth + 1);
        });
      }
    }
  }

  commentObjects.forEach(commentObj => {
    processComment(commentObj, 0);
  });

  return allComments;
}

// ========== NEW: POST CONTEXT ANALYZER ==========

function analyzePostContext(post, comments) {
  if (!post) return { type: 'unknown', topics: [], title: '' };

  const title = (post.title || '').toLowerCase();
  const selftext = (post.selftext || '').toLowerCase();
  const combinedText = title + ' ' + selftext;

  // Detect post type based on title patterns
  let postType = 'discussion'; // default

  if (/\b(what|which|best|top|recommend|suggestion)\b.*\?/.test(title)) {
    if (/\b(improved|quality of life|wish|did sooner|changed|game changer)\b/.test(title)) {
      postType = 'life_advice_request';
    } else if (/\b(industry|business|trend|growing|booming)\b/.test(title)) {
      postType = 'trend_discovery';
    } else {
      postType = 'recommendation_request';
    }
  } else if (/\b(need to be told|should know|realize|understand|truth)\b/.test(title)) {
    postType = 'truth_seeking';
  } else if (/\b(tell your|say to|talk about|discuss with)\b/.test(title)) {
    postType = 'perspective_sharing';
  } else if (/\b(how|why|when|where)\b.*\?/.test(title)) {
    postType = 'question';
  } else if (/\b(problem|issue|help|fix|solve)\b/.test(title)) {
    postType = 'problem_solving';
  } else if (/\b(story|experience|time when)\b/.test(title)) {
    postType = 'story_sharing';
  }

  // Extract topics from title and top comments
  const topics = extractTopics(combinedText, comments);

  // Detect if gender-specific
  const isGenderSpecific = /\b(men|women|male|female|guy|girl|ladies|gentleman)\b/i.test(title);

  return {
    title: post.title,
    type: postType,
    topics: topics,
    isGenderSpecific: isGenderSpecific,
    subreddit: post.subreddit,
    postScore: post.score || 0,
    commentCount: post.num_comments || 0
  };
}

function extractTopics(text, comments) {
  const topics = [];

  // Topic keywords
  const topicMap = {
    'health_wellness': ['health', 'therapy', 'doctor', 'mental', 'fitness', 'exercise', 'sleep', 'meditation', 'anxiety', 'depression'],
    'money_finance': ['money', 'dollar', 'salary', 'invest', 'financial', 'budget', 'cost', 'price', 'expensive', 'save'],
    'work_career': ['job', 'work', 'career', 'boss', 'employee', 'business', 'company', 'office', 'remote'],
    'relationships': ['relationship', 'dating', 'marriage', 'girlfriend', 'boyfriend', 'partner', 'spouse', 'love'],
    'home_lifestyle': ['home', 'house', 'apartment', 'furniture', 'cleaning', 'organize', 'decor'],
    'technology': ['tech', 'software', 'app', 'phone', 'computer', 'internet', 'ai', 'code', 'programming'],
    'education': ['school', 'university', 'college', 'learn', 'study', 'course', 'degree', 'teacher'],
    'hobbies': ['hobby', 'gaming', 'music', 'art', 'reading', 'travel', 'cooking', 'sports'],
    'social': ['friend', 'people', 'social', 'conversation', 'communication', 'personality']
  };

  // Check which topics are present
  Object.keys(topicMap).forEach(topic => {
    const keywords = topicMap[topic];
    const hasKeyword = keywords.some(keyword => text.includes(keyword));
    if (hasKeyword) {
      topics.push(topic);
    }
  });

  return topics.slice(0, 5); // Top 5 topics
}

// ========== NEW: DYNAMIC INSIGHT EXTRACTION ==========

function extractDynamicInsights(post, comments, postContext) {
  const insights = [];

  console.log('Extracting insights for post type:', postContext.type);

  // Always extract top voices
  insights.push(extractTopVoices(comments));

  // Type-specific insights
  switch (postContext.type) {
    case 'recommendation_request':
    case 'life_advice_request':
      insights.push(extractRankedRecommendations(comments));
      insights.push(extractCategorizedRecommendations(comments));
      insights.push(extractQuickWinsVsLongTerm(comments));
      break;

    case 'truth_seeking':
      insights.push(extractConsensusPoints(comments));
      insights.push(extractControversialTruths(comments));
      insights.push(extractHarshRealities(comments));
      break;

    case 'perspective_sharing':
      insights.push(extractThematicPatterns(comments));
      insights.push(extractCategorizedPerspectives(comments));
      insights.push(extractNotablePerspectives(comments));
      break;

    case 'trend_discovery':
      insights.push(extractMentionRankings(comments));
      insights.push(extractGrowthIndicators(comments));
      insights.push(extractOpportunities(comments));
      break;

    case 'problem_solving':
      insights.push(extractProblemsReported(comments));
      insights.push(extractVerifiedSolutionsNew(comments));
      insights.push(extractRootCauses(comments));
      break;

    default:
      // Generic discussion insights
      insights.push(extractKeyThemes(comments));
      insights.push(extractActiveDiscussions(comments));
      insights.push(extractNotableQuotes(comments));
  }

  // Always try to find hidden gems
  insights.push(extractHiddenGemsNew(comments));

  // NEW: Add synthesized strategic insights
  const strategicInsights = synthesizeStrategicInsights(post, comments, postContext, insights);
  if (strategicInsights && strategicInsights.data && strategicInsights.data.length > 0) {
    insights.unshift(strategicInsights); // Add at the beginning
  }

  // Filter out empty insights
  return insights.filter(insight => insight && insight.data && insight.data.length > 0);
}

// ========== MODULAR INSIGHT EXTRACTORS ==========

function extractTopVoices(comments) {
  const topComments = comments
    .slice(0, 20)
    .map(c => ({
      content: c.body.substring(0, 500) + (c.body.length > 500 ? '...' : ''),
      author: c.author,
      score: c.score,
      awards: c.total_awards_received || 0,
      permalink: c.permalink
    }));

  return {
    id: 'top_voices',
    title: '🔥 Top Voices',
    description: 'Highest upvoted comments',
    type: 'quotes',
    data: topComments
  };
}

// === Recommendation/Life Advice Extractors ===

function extractRankedRecommendations(comments) {
  const recommendations = {};

  comments.forEach(comment => {
    const body = comment.body || '';
    const sentences = body.split(/[.!?\n]+/);

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 15 && trimmed.length < 300) {
        const normalized = trimmed.toLowerCase();

        if (!recommendations[normalized]) {
          recommendations[normalized] = {
            text: trimmed,
            mentions: 0,
            totalScore: 0,
            examples: []
          };
        }

        recommendations[normalized].mentions++;
        recommendations[normalized].totalScore += comment.score || 0;

        if (recommendations[normalized].examples.length < 3) {
          recommendations[normalized].examples.push({
            author: comment.author,
            score: comment.score,
            permalink: comment.permalink
          });
        }
      }
    });
  });

  const ranked = Object.values(recommendations)
    .filter(r => r.mentions >= 2 || r.totalScore > 100)
    .sort((a, b) => (b.mentions * 100 + b.totalScore) - (a.mentions * 100 + a.totalScore))
    .slice(0, 15)
    .map(r => ({
      recommendation: r.text,
      mentions: r.mentions,
      totalScore: r.totalScore,
      examples: r.examples
    }));

  return {
    id: 'ranked_recommendations',
    title: '📊 Top Recommendations (Ranked by Popularity)',
    description: 'Most mentioned and upvoted recommendations',
    type: 'ranking',
    data: ranked
  };
}

function extractCategorizedRecommendations(comments) {
  const categories = {
    'Health & Wellness': ['therapy', 'therapist', 'doctor', 'mental health', 'exercise', 'gym', 'meditation', 'yoga', 'sleep', 'diet', 'fitness'],
    'Home & Purchases': ['bidet', 'mattress', 'pillow', 'vacuum', 'bed', 'chair', 'desk', 'bought', 'purchase', 'product'],
    'Habits & Routines': ['routine', 'habit', 'daily', 'morning', 'evening', 'schedule', 'wake up', 'journaling', 'reading'],
    'Financial': ['budget', 'save', 'invest', 'money', 'financial', 'debt', 'credit', 'savings', 'retirement'],
    'Social & Boundaries': ['saying no', 'boundaries', 'friends', 'toxic', 'people', 'social', 'cut off', 'distance']
  };

  const categorized = {};

  Object.keys(categories).forEach(category => {
    categorized[category] = [];
  });

  comments.forEach(comment => {
    const body = (comment.body || '').toLowerCase();
    const score = comment.score || 0;

    if (score < 20) return; // Only high-quality comments

    Object.keys(categories).forEach(category => {
      const keywords = categories[category];
      const hasKeyword = keywords.some(keyword => body.includes(keyword));

      if (hasKeyword && categorized[category].length < 5) {
        categorized[category].push({
          content: comment.body.substring(0, 300) + (comment.body.length > 300 ? '...' : ''),
          author: comment.author,
          score: score,
          permalink: comment.permalink
        });
      }
    });
  });

  // Convert to array format
  const result = Object.entries(categorized)
    .filter(([cat, items]) => items.length > 0)
    .map(([category, items]) => ({
      category: category,
      items: items
    }));

  return {
    id: 'categorized_recommendations',
    title: '🗂️ Recommendations by Category',
    description: 'Grouped by topic area',
    type: 'categorized',
    data: result
  };
}

function extractQuickWinsVsLongTerm(comments) {
  const quickWins = [];
  const longTerm = [];

  const quickPatterns = /\b(immediately|instant|right away|overnight|same day|within days|quick|fast)\b/i;
  const longTermPatterns = /\b(years|months|took time|eventually|long term|patience|consistent|over time)\b/i;

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (score < 20) return;

    if (quickPatterns.test(body) && quickWins.length < 10) {
      quickWins.push({
        content: body.substring(0, 300) + (body.length > 300 ? '...' : ''),
        author: comment.author,
        score: score,
        permalink: comment.permalink
      });
    }

    if (longTermPatterns.test(body) && longTerm.length < 10) {
      longTerm.push({
        content: body.substring(0, 300) + (body.length > 300 ? '...' : ''),
        author: comment.author,
        score: score,
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'quick_vs_longterm',
    title: '⚡ Quick Wins vs Long-term Changes',
    description: 'Impact timeline',
    type: 'comparison',
    data: {
      quickWins: quickWins,
      longTerm: longTerm
    }
  };
}

// === Truth-Seeking Extractors ===

function extractConsensusPoints(comments) {
  const statements = {};

  comments.forEach(comment => {
    const body = comment.body || '';
    const sentences = body.split(/[.!?\n]+/);

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 250) {
        const normalized = trimmed.toLowerCase();

        if (!statements[normalized]) {
          statements[normalized] = {
            text: trimmed,
            totalScore: 0,
            count: 0,
            supportingReplies: 0
          };
        }

        statements[normalized].count++;
        statements[normalized].totalScore += comment.score || 0;

        // Check replies for agreement
        if (comment.replies && comment.replies.data && comment.replies.data.children) {
          comment.replies.data.children.forEach(reply => {
            if (reply.data && reply.data.body) {
              const replyBody = reply.data.body.toLowerCase();
              if (/\b(exactly|agree|true|this|yes|correct)\b/.test(replyBody)) {
                statements[normalized].supportingReplies++;
              }
            }
          });
        }
      }
    });
  });

  const consensus = Object.values(statements)
    .filter(s => s.count >= 3 || s.totalScore > 200)
    .sort((a, b) => (b.totalScore + b.supportingReplies * 50) - (a.totalScore + a.supportingReplies * 50))
    .slice(0, 10)
    .map(s => ({
      statement: s.text,
      agreementLevel: s.count + ' mentions, ' + s.supportingReplies + ' supporting replies',
      totalScore: s.totalScore
    }));

  return {
    id: 'consensus_points',
    title: '✅ Consensus Points',
    description: 'What most people agree on',
    type: 'list',
    data: consensus
  };
}

function extractControversialTruths(comments) {
  const controversial = [];

  comments.forEach(comment => {
    const replyCount = countReplies(comment);
    const score = comment.score || 0;

    if (replyCount > 15) {
      let debateScore = 0;
      let supportScore = 0;

      if (comment.replies && comment.replies.data && comment.replies.data.children) {
        comment.replies.data.children.forEach(reply => {
          if (reply.data && reply.data.body) {
            const replyBody = reply.data.body.toLowerCase();
            if (/\b(disagree|wrong|but|however|actually|not true)\b/.test(replyBody)) {
              debateScore++;
            }
            if (/\b(agree|exactly|true|this|yes)\b/.test(replyBody)) {
              supportScore++;
            }
          }
        });
      }

      if (debateScore >= 5) {
        controversial.push({
          content: comment.body.substring(0, 400) + (comment.body.length > 400 ? '...' : ''),
          author: comment.author,
          score: score,
          debateLevel: debateScore + ' counter-arguments, ' + supportScore + ' agreements',
          permalink: comment.permalink
        });
      }
    }
  });

  return {
    id: 'controversial_truths',
    title: '⚔️ Controversial Takes',
    description: 'High debate, mixed reactions',
    type: 'debates',
    data: controversial.slice(0, 8)
  };
}

function extractHarshRealities(comments) {
  const harsh = [];
  const negativeWords = ['harsh', 'truth', 'reality', 'unfortunately', 'sad fact', 'hard pill', 'unpopular opinion'];

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (score < 30) return;

    const hasNegativeSentiment = negativeWords.some(word => body.toLowerCase().includes(word));
    const isDirective = /\b(need to|should|must|have to|stop)\b/i.test(body);

    if ((hasNegativeSentiment || isDirective) && body.length > 50) {
      harsh.push({
        content: body.substring(0, 400) + (body.length > 400 ? '...' : ''),
        author: comment.author,
        score: score,
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'harsh_realities',
    title: '💊 Harsh But True',
    description: 'Difficult truths people need to hear',
    type: 'quotes',
    data: harsh.slice(0, 10)
  };
}

// === Perspective Sharing Extractors ===

function extractThematicPatterns(comments) {
  const themes = {};

  comments.forEach(comment => {
    const body = (comment.body || '').toLowerCase();

    // Extract key phrases (3-5 words)
    const words = body.split(/\s+/).filter(w => w.length > 3);

    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');

      if (phrase.length > 10 && phrase.length < 50) {
        if (!themes[phrase]) {
          themes[phrase] = { count: 0, users: new Set() };
        }
        themes[phrase].count++;
        themes[phrase].users.add(comment.author);
      }
    }
  });

  const patterns = Object.entries(themes)
    .filter(([phrase, data]) => data.users.size >= 3)
    .sort((a, b) => b[1].users.size - a[1].users.size)
    .slice(0, 15)
    .map(([phrase, data]) => ({
      pattern: phrase,
      mentionedBy: data.users.size + ' different people'
    }));

  return {
    id: 'thematic_patterns',
    title: '🔍 Common Patterns',
    description: 'Recurring themes across comments',
    type: 'patterns',
    data: patterns
  };
}

function extractCategorizedPerspectives(comments) {
  const categories = {
    'Emotional/Vulnerability': ['feel', 'emotion', 'scared', 'afraid', 'vulnerable', 'worry', 'anxious', 'comfortable'],
    'Practical Advice': ['tip', 'advice', 'recommend', 'should', 'try', 'works', 'helps', 'solution'],
    'Social Dynamics': ['people', 'society', 'friends', 'women', 'men', 'relationship', 'social'],
    'Personal Experiences': ['my', 'I', 'me', 'experience', 'happened', 'story', 'time when']
  };

  const categorized = {};

  Object.keys(categories).forEach(category => {
    categorized[category] = [];
  });

  comments.forEach(comment => {
    const body = (comment.body || '').toLowerCase();
    const score = comment.score || 0;

    if (score < 15) return;

    Object.keys(categories).forEach(category => {
      const keywords = categories[category];
      const matchCount = keywords.filter(keyword => body.includes(keyword)).length;

      if (matchCount >= 2 && categorized[category].length < 5) {
        categorized[category].push({
          content: comment.body.substring(0, 350) + (comment.body.length > 350 ? '...' : ''),
          author: comment.author,
          score: score,
          permalink: comment.permalink
        });
      }
    });
  });

  const result = Object.entries(categorized)
    .filter(([cat, items]) => items.length > 0)
    .map(([category, items]) => ({
      category: category,
      items: items
    }));

  return {
    id: 'categorized_perspectives',
    title: '📂 Perspectives by Type',
    description: 'Grouped by theme',
    type: 'categorized',
    data: result
  };
}

function extractNotablePerspectives(comments) {
  const notable = comments
    .filter(c => (c.score || 0) > 50)
    .slice(0, 15)
    .map(c => ({
      content: c.body.substring(0, 400) + (c.body.length > 400 ? '...' : ''),
      author: c.author,
      score: c.score,
      permalink: c.permalink
    }));

  return {
    id: 'notable_perspectives',
    title: '💎 Notable Perspectives',
    description: 'High-impact viewpoints',
    type: 'quotes',
    data: notable
  };
}

// === Trend Discovery Extractors ===

function extractMentionRankings(comments) {
  const mentions = {};

  // Comprehensive stopword list - common words that aren't entities
  const stopwords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'They', 'There', 'Their',
    'What', 'When', 'Where', 'Which', 'Who', 'Why', 'How',
    'Every', 'Each', 'Some', 'Many', 'More', 'Most', 'Much',
    'From', 'With', 'About', 'Into', 'Through', 'During', 'Before', 'After',
    'Just', 'Very', 'Really', 'Actually', 'Basically', 'Literally',
    'Reddit', 'Edit', 'Update', 'Source', 'Yeah', 'Also', 'Because',
    'People', 'Person', 'Someone', 'Anyone', 'Everyone', 'Nobody',
    'Thing', 'Things', 'Something', 'Anything', 'Everything', 'Nothing',
    'Good', 'Great', 'Best', 'Better', 'Worse', 'Worst',
    'First', 'Second', 'Third', 'Last', 'Next', 'Other', 'Another',
    'Data', 'Year', 'Years', 'Time', 'Times', 'Way', 'Ways',
    'Work', 'Working', 'Works', 'Worked', 'Does', 'Did', 'Done',
    'Make', 'Makes', 'Made', 'Making', 'Take', 'Takes', 'Took',
    'Even', 'Still', 'Always', 'Never', 'Often', 'Sometimes',
    'Here', 'There', 'Everywhere', 'Somewhere', 'Anywhere', 'Nowhere'
  ]);

  comments.forEach(comment => {
    const body = comment.body || '';

    // Extract multi-word capitalized phrases (up to 4 words)
    const capitalizedPhrases = body.match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\b/g) || [];

    capitalizedPhrases.forEach(phrase => {
      const trimmed = phrase.trim();

      // Filter out stopwords and very short words
      if (trimmed.length > 2 && !stopwords.has(trimmed)) {
        // Also filter if it's ONLY stopwords in a multi-word phrase
        const words = trimmed.split(/\s+/);
        const hasNonStopword = words.some(w => !stopwords.has(w));

        if (hasNonStopword) {
          if (!mentions[trimmed]) {
            mentions[trimmed] = {
              count: 0,
              totalScore: 0,
              examples: []
            };
          }
          mentions[trimmed].count++;
          mentions[trimmed].totalScore += comment.score || 0;

          if (mentions[trimmed].examples.length < 2) {
            const idx = body.indexOf(trimmed);
            const context = body.substring(Math.max(0, idx - 50), Math.min(body.length, idx + trimmed.length + 100));
            mentions[trimmed].examples.push({
              author: comment.author,
              score: comment.score,
              context: context
            });
          }
        }
      }
    });
  });

  const ranked = Object.entries(mentions)
    .filter(([word, data]) => data.count >= 3)
    .sort((a, b) => (b[1].count * 10 + b[1].totalScore) - (a[1].count * 10 + a[1].totalScore))
    .slice(0, 15)
    .map(([word, data]) => ({
      item: word,
      mentions: data.count,
      totalScore: data.totalScore,
      examples: data.examples
    }));

  return {
    id: 'mention_rankings',
    title: '📈 Industries & Topics',
    description: 'Most discussed entities',
    type: 'ranking',
    data: ranked
  };
}

function extractGrowthIndicators(comments) {
  const indicators = [];
  const growthPatterns = /\b(growing|booming|exploding|huge|massive|increasing|trending|hot|popular|demand)\b/i;

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (growthPatterns.test(body) && score > 20) {
      indicators.push({
        content: body.substring(0, 350) + (body.length > 350 ? '...' : ''),
        author: comment.author,
        score: score,
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'growth_indicators',
    title: '🚀 Growth Signals',
    description: 'Comments mentioning growth/trends',
    type: 'quotes',
    data: indicators.slice(0, 12)
  };
}

function extractOpportunities(comments) {
  const opportunities = [];
  const opportunityPatterns = /\b(opportunity|gap|need|demand|should exist|wish there was|nobody is|untapped)\b/i;

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (opportunityPatterns.test(body) && score > 15) {
      opportunities.push({
        content: body.substring(0, 350) + (body.length > 350 ? '...' : ''),
        author: comment.author,
        score: score,
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'opportunities',
    title: '💡 Opportunities Mentioned',
    description: 'Gaps and unmet needs',
    type: 'quotes',
    data: opportunities.slice(0, 10)
  };
}

// === Problem Solving Extractors ===

function extractProblemsReported(comments) {
  const problems = [];
  const problemPatterns = /\b(problem|issue|can't|cannot|struggle|difficult|hard to|doesn't work)\b/i;

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (problemPatterns.test(body)) {
      problems.push({
        content: body.substring(0, 350) + (body.length > 350 ? '...' : ''),
        author: comment.author,
        score: score,
        replyCount: countReplies(comment),
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'problems_reported',
    title: '⚠️ Problems Reported',
    description: 'Issues people are facing',
    type: 'problems',
    data: problems.slice(0, 15)
  };
}

function extractVerifiedSolutionsNew(comments) {
  const solutions = [];

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (score > 25 && /\b(solution|works|solved|fixed|helped|try this)\b/i.test(body)) {
      let confirmations = 0;

      if (comment.replies && comment.replies.data && comment.replies.data.children) {
        comment.replies.data.children.forEach(reply => {
          if (reply.data && reply.data.body) {
            if (/\b(worked|thanks|helped|confirmed)\b/i.test(reply.data.body)) {
              confirmations++;
            }
          }
        });
      }

      solutions.push({
        content: body.substring(0, 350) + (body.length > 350 ? '...' : ''),
        author: comment.author,
        score: score,
        confirmations: confirmations,
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'verified_solutions',
    title: '✅ Verified Solutions',
    description: 'Solutions with community confirmation',
    type: 'solutions',
    data: solutions.slice(0, 10)
  };
}

function extractRootCauses(comments) {
  const causes = [];
  const causePatterns = /\b(because|reason|root cause|caused by|due to|stems from)\b/i;

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (causePatterns.test(body) && score > 20) {
      causes.push({
        content: body.substring(0, 350) + (body.length > 350 ? '...' : ''),
        author: comment.author,
        score: score,
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'root_causes',
    title: '🔍 Root Causes Identified',
    description: 'Why problems happen',
    type: 'quotes',
    data: causes.slice(0, 8)
  };
}

// === Generic Discussion Extractors ===

function extractKeyThemes(comments) {
  const themes = {};

  const keywords = [
    'technology', 'health', 'money', 'work', 'relationship', 'family', 'education',
    'government', 'politics', 'society', 'environment', 'culture', 'business'
  ];

  comments.forEach(comment => {
    const body = (comment.body || '').toLowerCase();

    keywords.forEach(keyword => {
      if (body.includes(keyword)) {
        if (!themes[keyword]) {
          themes[keyword] = { count: 0, examples: [] };
        }
        themes[keyword].count++;

        if (themes[keyword].examples.length < 2) {
          themes[keyword].examples.push({
            content: comment.body.substring(0, 200),
            score: comment.score
          });
        }
      }
    });
  });

  const themeList = Object.entries(themes)
    .filter(([theme, data]) => data.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([theme, data]) => ({
      theme: theme,
      mentions: data.count,
      examples: data.examples
    }));

  return {
    id: 'key_themes',
    title: '🎯 Key Themes',
    description: 'Main discussion topics',
    type: 'themes',
    data: themeList
  };
}

function extractActiveDiscussions(comments) {
  const discussions = [];

  comments.forEach(comment => {
    const replyCount = countReplies(comment);
    const score = comment.score || 0;

    if (replyCount > 10) {
      discussions.push({
        content: comment.body.substring(0, 300) + (comment.body.length > 300 ? '...' : ''),
        author: comment.author,
        score: score,
        replyCount: replyCount,
        permalink: comment.permalink
      });
    }
  });

  return {
    id: 'active_discussions',
    title: '💬 Active Discussions',
    description: 'Comments with most replies',
    type: 'discussions',
    data: discussions.slice(0, 10)
  };
}

function extractNotableQuotes(comments) {
  const quotes = comments
    .filter(c => {
      const body = c.body || '';
      const score = c.score || 0;
      return score > 40 && body.length > 100 && body.length < 600;
    })
    .slice(0, 15)
    .map(c => ({
      content: c.body,
      author: c.author,
      score: c.score,
      permalink: c.permalink
    }));

  return {
    id: 'notable_quotes',
    title: '💬 Notable Quotes',
    description: 'High-quality comments',
    type: 'quotes',
    data: quotes
  };
}

// === Universal Extractors ===

function extractHiddenGemsNew(comments) {
  const gems = [];

  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;

    if (score > 10 && score < 100 && body.length > 150) {
      let valueScore = 0;

      if (/\b(source:|study|research|worked in|experience|years|professional)\b/i.test(body)) valueScore += 2;
      if (/https?:\/\//.test(body)) valueScore++;
      if (/\n[-*•]|\n\d+\./.test(body)) valueScore++;
      if (comment.total_awards_received > 0) valueScore++;

      if (valueScore >= 2) {
        gems.push({
          content: body.substring(0, 400) + (body.length > 400 ? '...' : ''),
          author: comment.author,
          score: score,
          valueScore: valueScore,
          reason: identifyGemReason(body),
          permalink: comment.permalink
        });
      }
    }
  });

  return {
    id: 'hidden_gems',
    title: '💎 Hidden Gems',
    description: 'High-value, low-score comments',
    type: 'gems',
    data: gems.slice(0, 5)
  };
}

// Helper function for extractHiddenGemsNew
function identifyGemReason(body) {
  if (/\b(source:|study shows|research shows)\b/i.test(body)) return 'Contains sources/research';
  if (/\b(former|used to be|worked in|years of experience)\b/i.test(body)) return 'Expert perspective';
  if (/\b(saved me|changed my life|wish I knew)\b/i.test(body)) return 'Life-changing advice';
  if (/\n[-*•]|\n\d+\./.test(body)) return 'Detailed breakdown';
  if (/https?:\/\//.test(body)) return 'Includes resources';
  return 'Valuable insight';
}

// ========== UNIVERSAL HUMAN-LIKE ANALYSIS SYSTEM ==========
// This system reads comments like a human analyst would - no predetermined patterns

function synthesizeStrategicInsights(post, comments, postContext, extractedInsights) {
  const insights = [];
  const totalComments = comments.length;

  console.log('=== HUMAN-LIKE ANALYSIS START ===');
  console.log('Reading', totalComments, 'comments for', postContext.type);

  // STEP 1: READ AND LEARN (like a human would)
  const learned = readAndLearnFromComments(comments);

  // STEP 2: FIND PATTERNS (what repeats, what stands out)
  const patterns = findNaturalPatterns(learned, comments, totalComments);

  // STEP 3: SYNTHESIZE INSIGHTS (connect the dots)
  const synthesized = synthesizeFromPatterns(patterns, learned, totalComments);

  return {
    id: 'strategic_insights',
    title: '🎯 Strategic Insights',
    description: 'Synthesized intelligence from reading all comments',
    type: 'strategic',
    data: synthesized
  };
}

// STEP 1: Read comments and extract everything we can learn
function readAndLearnFromComments(comments) {
  console.log('Step 1: Reading and learning from comments...');

  const learned = {
    // What's being discussed (entities)
    entities: {},

    // What phrases keep repeating
    phrases: {},

    // Sentiment vocabulary found in THIS discussion
    positiveWords: {},
    negativeWords: {},

    // Outcomes people report
    outcomes: {worked: [], failed: [], mixed: []},

    // Time-related mentions
    timeMentions: {},

    // Who's speaking (authority/experience)
    speakers: {expert: 0, experienced: 0, novice: 0, unknown: 0},

    // Personal vs reported
    experienceType: {firsthand: 0, secondhand: 0},

    // Numbers mentioned
    numbers: {percentages: [], prices: [], quantities: []},

    // Comparisons (X vs Y, better/worse)
    comparisons: [],

    // Questions being asked
    questions: [],

    // Emotional language
    emotions: {},

    // Geographic mentions
    locations: {},

    // Frequency words (always, never, sometimes, often)
    frequency: {}
  };

  // Stopwords to filter out common words that aren't entities
  const stopwords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'They', 'There', 'Their',
    'What', 'When', 'Where', 'Which', 'Who', 'Why', 'How',
    'Every', 'Each', 'Some', 'Many', 'More', 'Most', 'Much',
    'From', 'With', 'About', 'Into', 'Through', 'During', 'Before', 'After',
    'Just', 'Very', 'Really', 'Actually', 'Basically', 'Literally',
    'Reddit', 'Edit', 'Update', 'Source', 'Yeah', 'Also', 'Because',
    'People', 'Person', 'Someone', 'Anyone', 'Everyone', 'Nobody',
    'Thing', 'Things', 'Something', 'Anything', 'Everything', 'Nothing',
    'Good', 'Great', 'Best', 'Better', 'Worse', 'Worst',
    'First', 'Second', 'Third', 'Last', 'Next', 'Other', 'Another',
    'Data', 'Year', 'Years', 'Time', 'Times', 'Way', 'Ways',
    'Work', 'Working', 'Works', 'Worked', 'Does', 'Did', 'Done',
    'Make', 'Makes', 'Made', 'Making', 'Take', 'Takes', 'Took',
    'Even', 'Still', 'Always', 'Never', 'Often', 'Sometimes',
    'Here', 'There', 'Everywhere', 'Somewhere', 'Anywhere', 'Nowhere'
  ]);

  // Universal sentiment words (starting point)
  const basePosWords = ['good', 'great', 'love', 'best', 'worked', 'helped', 'success', 'amazing', 'excellent', 'booming', 'growing'];
  const baseNegWords = ['bad', 'terrible', 'hate', 'worst', 'failed', 'useless', 'awful', 'didn\'t work', 'dying', 'declining'];

  comments.forEach((comment, index) => {
    const body = comment.body || '';
    const bodyLower = body.toLowerCase();

    // Extract entities - multi-word capitalized phrases (up to 4 words)
    const properNouns = body.match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\b/g) || [];
    properNouns.forEach(entity => {
      const cleaned = entity.trim();

      // Filter out stopwords
      if (cleaned.length > 2 && !stopwords.has(cleaned)) {
        // If multi-word, ensure at least one word isn't a stopword
        const words = cleaned.split(/\s+/);
        const hasNonStopword = words.some(w => !stopwords.has(w));

        if (hasNonStopword) {
          if (!learned.entities[cleaned]) {
            learned.entities[cleaned] = {
              count: 0,
              contexts: [],
              coOccurs: {},
              sentiment: {pos: 0, neg: 0, neu: 0}
            };
          }
          learned.entities[cleaned].count++;

        // Context (60 chars before and after)
        const idx = body.indexOf(cleaned);
        const context = body.substring(Math.max(0, idx - 60), Math.min(body.length, idx + cleaned.length + 60));
        if (learned.entities[cleaned].contexts.length < 5) {
          learned.entities[cleaned].contexts.push({text: context, score: comment.score});
        }

        // Co-occurrence (what else is mentioned in same comment)
        properNouns.forEach(other => {
          if (other !== cleaned && other.length > 2) {
            learned.entities[cleaned].coOccurs[other] = (learned.entities[cleaned].coOccurs[other] || 0) + 1;
          }
        });

        // Sentiment from context
        const contextLower = context.toLowerCase();
        if (basePosWords.some(w => contextLower.includes(w))) {
          learned.entities[cleaned].sentiment.pos++;
        } else if (baseNegWords.some(w => contextLower.includes(w))) {
          learned.entities[cleaned].sentiment.neg++;
        } else {
          learned.entities[cleaned].sentiment.neu++;
        }
        }
      }
    });

    // Extract repeated phrases (3-4 words)
    const words = bodyLower.split(/\s+/).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (phrase.length >= 12 && phrase.length <= 60) {
        learned.phrases[phrase] = (learned.phrases[phrase] || 0) + 1;
      }
    }

    // Learn sentiment vocabulary from this dataset
    words.forEach(word => {
      if (basePosWords.includes(word)) {
        learned.positiveWords[word] = (learned.positiveWords[word] || 0) + 1;
      } else if (baseNegWords.includes(word)) {
        learned.negativeWords[word] = (learned.negativeWords[word] || 0) + 1;
      }
    });

    // Extract outcomes
    if (/\b(worked|helped|solved|fixed|cured|success)\b/i.test(body)) {
      learned.outcomes.worked.push({text: body.substring(0, 300), score: comment.score});
    }
    if (/\b(failed|didn't work|worse|useless|no help|waste)\b/i.test(body)) {
      learned.outcomes.failed.push({text: body.substring(0, 300), score: comment.score});
    }
    if (/\b(sometimes|depends|mixed|varies|hit or miss)\b/i.test(body)) {
      learned.outcomes.mixed.push({text: body.substring(0, 300), score: comment.score});
    }

    // Extract time mentions
    const timeMatches = body.match(/\b(immediately|instant|days?|weeks?|months?|years?|decades?|long.?term|short.?term)\b/gi) || [];
    timeMatches.forEach(match => {
      const normalized = match.toLowerCase();
      learned.timeMentions[normalized] = (learned.timeMentions[normalized] || 0) + 1;
    });

    // Determine speaker type
    if (/\b(I'm a|doctor|MD|PhD|professional|specialist|expert|work in)\b/i.test(body)) {
      learned.speakers.expert++;
    } else if (/\b(\d+\s*years?|experience|dealt with for)\b/i.test(body)) {
      learned.speakers.experienced++;
    } else if (/\b(new to|just started|beginner|first time)\b/i.test(body)) {
      learned.speakers.novice++;
    } else {
      learned.speakers.unknown++;
    }

    // Experience type
    if (/\b(I |my |me |I've|I'm)\b/.test(body)) {
      learned.experienceType.firsthand++;
    } else if (/\b(heard|read|told|people say|they say)\b/i.test(body)) {
      learned.experienceType.secondhand++;
    }

    // Extract numbers
    const percentages = body.match(/\d+%/g) || [];
    learned.numbers.percentages.push(...percentages.map(p => ({value: p, context: body.substring(0, 200)})));

    const prices = body.match(/\$\d+(?:,\d{3})*(?:\.\d{2})?/g) || [];
    learned.numbers.prices.push(...prices.map(p => ({value: p, context: body.substring(0, 200)})));

    const quantities = body.match(/\d+\s+(?:times|people|users|patients|months|years)/gi) || [];
    learned.numbers.quantities.push(...quantities);

    // Comparisons
    const compMatches = body.match(/.{0,40}\b(better|worse|more|less|prefer)\s+than\b.{0,40}/gi) || [];
    learned.comparisons.push(...compMatches);

    // Questions
    if (body.includes('?')) {
      const questionSents = body.split(/[.!]/);
      questionSents.forEach(sent => {
        if (sent.includes('?') && sent.trim().length > 15) {
          learned.questions.push(sent.trim());
        }
      });
    }

    // Emotions
    const emotionMatches = body.match(/\b(frustrated|angry|happy|sad|excited|scared|worried|hopeful|desperate|relieved)\b/gi) || [];
    emotionMatches.forEach(emotion => {
      const normalized = emotion.toLowerCase();
      learned.emotions[normalized] = (learned.emotions[normalized] || 0) + 1;
    });

    // Geographic mentions
    const locations = body.match(/\b(US|USA|UK|Canada|Europe|Asia|America|Britain|Australia|India|China|Iran|France|Germany)\b/g) || [];
    locations.forEach(loc => {
      learned.locations[loc] = (learned.locations[loc] || 0) + 1;
    });

    // Frequency words
    const freqMatches = body.match(/\b(always|never|sometimes|often|rarely|usually|frequently|occasionally)\b/gi) || [];
    freqMatches.forEach(freq => {
      const normalized = freq.toLowerCase();
      learned.frequency[normalized] = (learned.frequency[normalized] || 0) + 1;
    });
  });

  console.log('Learned:', Object.keys(learned.entities).length, 'entities');
  console.log('Found:', Object.keys(learned.phrases).length, 'unique phrases');

  return learned;
}

// STEP 2: Find natural patterns from what we learned
function findNaturalPatterns(learned, comments, totalComments) {
  console.log('Step 2: Finding natural patterns...');

  const patterns = {
    topEntities: [],
    repeatedPhrases: [],
    dominantSentiment: null,
    outcomeRatio: null,
    timelinePattern: null,
    speakerProfile: null,
    commonComparisons: [],
    emotionalTone: null,
    geographicPattern: null
  };

  // Top entities with full analysis
  patterns.topEntities = Object.entries(learned.entities)
    .filter(([_, data]) => data.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([entity, data]) => {
      const total = data.sentiment.pos + data.sentiment.neg + data.sentiment.neu;
      const posRate = total > 0 ? Math.round((data.sentiment.pos / total) * 100) : 0;

      // Find what co-occurs most
      const topCoOccur = Object.entries(data.coOccurs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([e, count]) => ({entity: e, count}));

      return {
        entity,
        count: data.count,
        percentage: Math.round((data.count / totalComments) * 100),
        sentiment: posRate,
        coOccurs: topCoOccur,
        contexts: data.contexts
      };
    });

  // Repeated phrases (what people actually say)
  patterns.repeatedPhrases = Object.entries(learned.phrases)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({phrase, count, percentage: Math.round((count / totalComments) * 100)}));

  // Outcome ratio
  const totalOutcomes = learned.outcomes.worked.length + learned.outcomes.failed.length;
  if (totalOutcomes >= 5) {
    patterns.outcomeRatio = {
      successRate: Math.round((learned.outcomes.worked.length / totalOutcomes) * 100),
      worked: learned.outcomes.worked.length,
      failed: learned.outcomes.failed.length,
      mixed: learned.outcomes.mixed.length
    };
  }

  // Timeline pattern
  const topTime = Object.entries(learned.timeMentions)
    .sort((a, b) => b[1] - a[1])[0];
  if (topTime && topTime[1] >= 3) {
    patterns.timelinePattern = {
      dominant: topTime[0],
      count: topTime[1],
      percentage: Math.round((topTime[1] / totalComments) * 100)
    };
  }

  // Speaker profile
  const totalSpeakers = Object.values(learned.speakers).reduce((a, b) => a + b, 0);
  patterns.speakerProfile = {
    expertPct: Math.round((learned.speakers.expert / totalSpeakers) * 100),
    experiencedPct: Math.round((learned.speakers.experienced / totalSpeakers) * 100),
    novicePct: Math.round((learned.speakers.novice / totalSpeakers) * 100),
    firsthandPct: Math.round((learned.experienceType.firsthand / totalComments) * 100)
  };

  // Common comparisons
  const compCounts = {};
  learned.comparisons.forEach(comp => {
    const normalized = comp.trim().toLowerCase();
    compCounts[normalized] = (compCounts[normalized] || 0) + 1;
  });
  patterns.commonComparisons = Object.entries(compCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([comp, count]) => ({comparison: comp, count}));

  // Emotional tone
  const topEmotions = Object.entries(learned.emotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topEmotions.length > 0 && topEmotions[0][1] >= 3) {
    patterns.emotionalTone = topEmotions.map(([emotion, count]) => ({emotion, count}));
  }

  // Geographic pattern
  const geoEntries = Object.entries(learned.locations);
  if (geoEntries.length >= 2) {
    patterns.geographicPattern = geoEntries
      .sort((a, b) => b[1] - a[1])
      .map(([location, count]) => ({location, count}));
  }

  return patterns;
}

// STEP 3: Synthesize insights from patterns (like a human would)
function synthesizeFromPatterns(patterns, learned, totalComments) {
  console.log('Step 3: Synthesizing insights...');

  const insights = [];

  // Insight: Top entities with context
  if (patterns.topEntities.length > 0) {
    patterns.topEntities.slice(0, 5).forEach(entity => {
      let insight = `"${entity.entity}" discussed in ${entity.percentage}% of comments (${entity.count} mentions)`;

      if (entity.sentiment >= 70) {
        insight += ` with ${entity.sentiment}% positive sentiment - highly favored`;
      } else if (entity.sentiment <= 30 && entity.sentiment > 0) {
        insight += ` with only ${entity.sentiment}% positive sentiment - significant concerns`;
      }

      if (entity.coOccurs.length > 0) {
        const topPair = entity.coOccurs[0];
        insight += `. Often mentioned with "${topPair.entity}" (${topPair.count} times)`;
      }

      insights.push({
        type: 'entity_analysis',
        insight: insight,
        entity: entity.entity,
        data: entity
      });
    });
  }

  // Insight: Repeated phrases
  if (patterns.repeatedPhrases.length > 0) {
    patterns.repeatedPhrases.slice(0, 3).forEach(item => {
      insights.push({
        type: 'repeated_language',
        insight: `"${item.phrase}" repeated ${item.count} times (${item.percentage}% of comments) - common shared experience`,
        phrase: item.phrase,
        count: item.count,
        percentage: item.percentage
      });
    });
  }

  // Insight: Outcome ratio
  if (patterns.outcomeRatio) {
    const ratio = patterns.outcomeRatio;
    let interpretation = '';
    if (ratio.successRate >= 70) {
      interpretation = 'highly effective';
    } else if (ratio.successRate >= 50) {
      interpretation = 'moderately effective';
    } else if (ratio.successRate >= 30) {
      interpretation = 'mixed results';
    } else {
      interpretation = 'low success rate - caution advised';
    }

    insights.push({
      type: 'outcome_analysis',
      insight: `${ratio.successRate}% success rate across reported attempts (${ratio.worked} worked vs ${ratio.failed} failed) - ${interpretation}`,
      successRate: ratio.successRate,
      data: ratio
    });
  }

  // Insight: Timeline
  if (patterns.timelinePattern) {
    insights.push({
      type: 'timeline',
      insight: `"${patterns.timelinePattern.dominant}" mentioned in ${patterns.timelinePattern.percentage}% of comments - sets realistic timeline expectations`,
      timeline: patterns.timelinePattern.dominant,
      percentage: patterns.timelinePattern.percentage
    });
  }

  // Insight: Speaker profile
  if (patterns.speakerProfile) {
    const prof = patterns.speakerProfile;
    let insight = '';

    if (prof.expertPct >= 20) {
      insight = `${prof.expertPct}% expert/professional input, ${prof.firsthandPct}% firsthand experiences - balanced authoritative and personal perspectives`;
    } else if (prof.firsthandPct >= 70) {
      insight = `${prof.firsthandPct}% firsthand personal experiences - highly authentic, lived-experience based discussion`;
    } else {
      insight = `Community-driven discussion with ${prof.firsthandPct}% firsthand experiences`;
    }

    insights.push({
      type: 'speaker_analysis',
      insight: insight,
      data: prof
    });
  }

  // Insight: Comparisons
  if (patterns.commonComparisons.length > 0) {
    patterns.commonComparisons.forEach(comp => {
      insights.push({
        type: 'comparison',
        insight: `Common comparison: "${comp.comparison}" (${comp.count} mentions) - indicates active evaluation`,
        comparison: comp.comparison,
        count: comp.count
      });
    });
  }

  // Insight: Emotional tone
  if (patterns.emotionalTone) {
    const emotions = patterns.emotionalTone.map(e => `${e.emotion} (${e.count})`).join(', ');
    insights.push({
      type: 'emotional_tone',
      insight: `Dominant emotions: ${emotions} - high emotional engagement in discussion`,
      emotions: patterns.emotionalTone
    });
  }

  // Insight: Geographic
  if (patterns.geographicPattern && patterns.geographicPattern.length >= 2) {
    const locations = patterns.geographicPattern.map(g => `${g.location} (${g.count})`).join(', ');
    insights.push({
      type: 'geographic_variance',
      insight: `Geographic differences noted: ${locations} - treatment/experience varies by location`,
      locations: patterns.geographicPattern
    });
  }

  console.log('=== GENERATED', insights.length, 'INSIGHTS ===');

  return insights;
}
// ========== 3-STEP INTERACTIVE ANALYSIS SYSTEM ==========

// STEP 1: Extract valuable content only (no analysis yet)
function extractValuableContentOnly(redditData) {
  console.log('STEP 1: Received redditData:', redditData);

  if (!redditData || !redditData.post) {
    throw new Error('Invalid data: Missing post data. RedditData structure: ' + JSON.stringify(Object.keys(redditData || {})));
  }

  const post = redditData.post;
  const allComments = redditData.comments || [];

  console.log('STEP 1: Extracting valuable content from', allComments.length, 'comments');

  // Filter for high-value comments based on multiple criteria
  const valuableComments = allComments.filter(comment => {
    const score = comment.score || 0;
    const body = comment.body || '';
    const length = body.length;

    // Criteria for "valuable" content:
    // 1. High score (> 50)
    // 2. Long detailed content (> 200 chars)
    // 3. Has links/sources
    // 4. Has awards
    // 5. Expert indicators (professional language, experience mentions)

    let valueScore = 0;

    if (score > 100) valueScore += 3;
    else if (score > 50) valueScore += 2;
    else if (score > 20) valueScore += 1;

    if (length > 500) valueScore += 2;
    else if (length > 200) valueScore += 1;

    if (/https?:\/\//.test(body)) valueScore += 1;
    if (comment.total_awards_received > 0) valueScore += 2;
    if (/\b(I work|professional|experience|expert|years|specialist|doctor|engineer|developer)\b/i.test(body)) valueScore += 1;
    if (/\n[-*•]|\n\d+\./.test(body)) valueScore += 1; // Has lists

    return valueScore >= 2; // Keep if value score is 2 or higher
  });

  // Sort by score descending
  const sorted = valuableComments.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Return valuable content with metadata
  return {
    post: {
      title: post.title,
      author: post.author,
      subreddit: post.subreddit,
      score: post.score,
      url: post.url,
      selftext: post.selftext,
      created: post.created_utc,
      num_comments: post.num_comments
    },
    totalComments: allComments.length,
    valuableComments: sorted.slice(0, 100).map(c => ({ // Top 100 valuable comments
      body: c.body,
      author: c.author,
      score: c.score,
      awards: c.total_awards_received || 0,
      created: c.created_utc,
      permalink: c.permalink
    })),
    extractionStats: {
      total: allComments.length,
      extracted: sorted.length,
      percentageKept: Math.round((sorted.length / allComments.length) * 100),
      averageScore: Math.round(sorted.reduce((sum, c) => sum + (c.score || 0), 0) / sorted.length)
    }
  };
}

// STEP 2: Analyze content and recommend possible analyses
function analyzeAndRecommend(contentData) {
  console.log('STEP 2: Analyzing content to recommend analyses');

  const comments = contentData.valuableComments || [];
  const recommendations = [];

  // Analyze what types of insights are possible based on content

  // 1. Entity & Topic Analysis
  const entities = {};
  comments.forEach(c => {
    const matches = (c.body || '').match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\b/g) || [];
    matches.forEach(e => {
      if (e.length > 3) entities[e] = (entities[e] || 0) + 1;
    });
  });
  const topEntities = Object.entries(entities).filter(([_, count]) => count >= 3).length;
  if (topEntities > 0) {
    recommendations.push({
      id: 'entity_analysis',
      name: 'Entity & Topic Analysis',
      description: `Identify most discussed industries, products, or topics with sentiment`,
      available: true,
      dataFound: `${topEntities} entities mentioned 3+ times`,
      estimatedInsights: Math.min(topEntities, 10)
    });
  }

  // 2. Success/Failure Rate Analysis
  const outcomeWords = {
    success: /\b(worked|success|helped|fixed|cured|solved|great|amazing)\b/i,
    failure: /\b(failed|didn't work|worse|useless|no help|terrible|awful)\b/i
  };
  const successCount = comments.filter(c => outcomeWords.success.test(c.body)).length;
  const failureCount = comments.filter(c => outcomeWords.failure.test(c.body)).length;
  if (successCount + failureCount >= 10) {
    recommendations.push({
      id: 'outcome_analysis',
      name: 'Success/Failure Rate Analysis',
      description: `Calculate success rates and effectiveness of solutions discussed`,
      available: true,
      dataFound: `${successCount} success + ${failureCount} failure mentions`,
      estimatedInsights: 3
    });
  }

  // 3. Expert vs Experience Mix
  const expertCount = comments.filter(c => /\b(I work|professional|doctor|engineer|specialist|expert)\b/i.test(c.body)).length;
  const experienceCount = comments.filter(c => /\b(I |my |me |I've|I'm|personally)\b/i.test(c.body)).length;
  if (expertCount >= 5 || experienceCount >= 20) {
    recommendations.push({
      id: 'speaker_analysis',
      name: 'Expert vs Personal Experience Mix',
      description: `Analyze the balance between professional advice and lived experiences`,
      available: true,
      dataFound: `${expertCount} expert comments, ${experienceCount} personal experiences`,
      estimatedInsights: 2
    });
  }

  // 4. Geographic Patterns
  const locations = ['US', 'UK', 'Canada', 'Australia', 'Europe', 'Asia', 'India', 'China', 'California', 'Texas', 'New York'];
  const geoMentions = {};
  comments.forEach(c => {
    locations.forEach(loc => {
      if ((c.body || '').includes(loc)) {
        geoMentions[loc] = (geoMentions[loc] || 0) + 1;
      }
    });
  });
  const geoCount = Object.keys(geoMentions).length;
  if (geoCount >= 2) {
    recommendations.push({
      id: 'geographic_analysis',
      name: 'Geographic Patterns',
      description: `Identify location-based differences in experiences or availability`,
      available: true,
      dataFound: `${geoCount} locations mentioned`,
      estimatedInsights: Math.min(geoCount, 3)
    });
  }

  // 5. Pricing/Cost Analysis
  const pricePatterns = /\$[\d,]+|\bcost\b|\bprice\b|\bexpensive\b|\bcheap\b|\baffordable\b/gi;
  const priceCount = comments.filter(c => pricePatterns.test(c.body)).length;
  if (priceCount >= 10) {
    recommendations.push({
      id: 'pricing_analysis',
      name: 'Pricing & Cost Analysis',
      description: `Analyze price sensitivity, cost mentions, and value perception`,
      available: true,
      dataFound: `${priceCount} comments mention pricing/cost`,
      estimatedInsights: 3
    });
  }

  // 6. Timeline Expectations
  const timePatterns = /\b(immediate|instant|days?|weeks?|months?|years?|long.?term|short.?term)\b/i;
  const timeCount = comments.filter(c => timePatterns.test(c.body)).length;
  if (timeCount >= 10) {
    recommendations.push({
      id: 'timeline_analysis',
      name: 'Timeline Expectations',
      description: `Understand how long things take based on community experiences`,
      available: true,
      dataFound: `${timeCount} comments mention timeframes`,
      estimatedInsights: 2
    });
  }

  // 7. Repeated Phrases (Common Language)
  const phrases = {};
  comments.forEach(c => {
    const words = (c.body || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (phrase.length >= 12 && phrase.length <= 60) {
        phrases[phrase] = (phrases[phrase] || 0) + 1;
      }
    }
  });
  const commonPhrases = Object.entries(phrases).filter(([_, count]) => count >= 3).length;
  if (commonPhrases >= 3) {
    recommendations.push({
      id: 'phrase_analysis',
      name: 'Common Language & Phrases',
      description: `Identify repeated phrases that reveal shared experiences`,
      available: true,
      dataFound: `${commonPhrases} phrases repeated 3+ times`,
      estimatedInsights: Math.min(commonPhrases, 5)
    });
  }

  // 8. Comparison Analysis
  const comparisonPatterns = /\b(vs|versus|compared to|better than|worse than|instead of)\b/i;
  const compCount = comments.filter(c => comparisonPatterns.test(c.body)).length;
  if (compCount >= 5) {
    recommendations.push({
      id: 'comparison_analysis',
      name: 'Comparison Analysis',
      description: `Identify what people are comparing and their preferences`,
      available: true,
      dataFound: `${compCount} comments with comparisons`,
      estimatedInsights: Math.min(compCount, 5)
    });
  } else {
    recommendations.push({
      id: 'comparison_analysis',
      name: 'Comparison Analysis',
      description: `Identify what people are comparing and their preferences`,
      available: false,
      dataFound: `Only ${compCount} comparison mentions (need 5+)`,
      estimatedInsights: 0
    });
  }

  // 9. Emotional Tone Analysis
  const emotionWords = {
    frustrated: /\b(frustrat|annoying|impossible|can't|won't)\b/i,
    excited: /\b(excited|amazing|love|incredible|fantastic)\b/i,
    worried: /\b(worry|concern|anxious|afraid|nervous)\b/i
  };
  let emotionCount = 0;
  Object.values(emotionWords).forEach(pattern => {
    emotionCount += comments.filter(c => pattern.test(c.body)).length;
  });
  if (emotionCount >= 10) {
    recommendations.push({
      id: 'emotion_analysis',
      name: 'Emotional Tone Analysis',
      description: `Understand the emotional landscape of the discussion`,
      available: true,
      dataFound: `${emotionCount} emotional indicators detected`,
      estimatedInsights: 3
    });
  }

  return {
    totalRecommendations: recommendations.length,
    availableAnalyses: recommendations.filter(r => r.available).length,
    recommendations: recommendations.sort((a, b) => (b.available ? 1 : 0) - (a.available ? 1 : 0))
  };
}

// STEP 3: Generate only selected insights
function generateSelectedInsights(contentData, selectedAnalyses) {
  console.log('STEP 3: Generating insights for', selectedAnalyses.length, 'selected analyses');

  const comments = contentData.valuableComments || [];
  const post = contentData.post || {};
  const insights = [];

  // Stopwords for entity extraction
  const stopwords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'They', 'There', 'Their',
    'What', 'When', 'Where', 'Which', 'Who', 'Why', 'How',
    'Every', 'Each', 'Some', 'Many', 'More', 'Most', 'Much',
    'From', 'With', 'About', 'Into', 'Through', 'During', 'Before', 'After',
    'Just', 'Very', 'Really', 'Actually', 'Basically', 'Literally',
    'Reddit', 'Edit', 'Update', 'Source', 'Yeah', 'Also', 'Because',
    'People', 'Person', 'Someone', 'Anyone', 'Everyone', 'Nobody',
    'Thing', 'Things', 'Something', 'Anything', 'Everything', 'Nothing'
  ]);

  selectedAnalyses.forEach(analysisId => {

    if (analysisId === 'entity_analysis') {
      // Entity & Topic Analysis
      const entities = {};
      const basePosWords = ['good', 'great', 'love', 'best', 'worked', 'helped', 'success', 'amazing', 'booming', 'growing'];
      const baseNegWords = ['bad', 'terrible', 'hate', 'worst', 'failed', 'useless', 'awful', 'dying', 'declining'];

      comments.forEach(c => {
        const body = c.body || '';
        const matches = body.match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\b/g) || [];
        matches.forEach(entity => {
          if (entity.length > 3 && !stopwords.has(entity)) {
            if (!entities[entity]) {
              entities[entity] = {count: 0, pos: 0, neg: 0, neu: 0};
            }
            entities[entity].count++;

            const idx = body.indexOf(entity);
            const context = body.substring(Math.max(0, idx - 60), Math.min(body.length, idx + entity.length + 60)).toLowerCase();
            if (basePosWords.some(w => context.includes(w))) {
              entities[entity].pos++;
            } else if (baseNegWords.some(w => context.includes(w))) {
              entities[entity].neg++;
            } else {
              entities[entity].neu++;
            }
          }
        });
      });

      const topEntities = Object.entries(entities)
        .filter(([_, data]) => data.count >= 3)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

      topEntities.forEach(([entity, data]) => {
        const total = data.pos + data.neg + data.neu;
        const sentiment = total > 0 ? Math.round((data.pos / total) * 100) : 0;
        const percentage = Math.round((data.count / comments.length) * 100);

        let sentimentText = '';
        if (sentiment >= 70) sentimentText = ` with ${sentiment}% positive sentiment - highly favored`;
        else if (sentiment <= 30 && sentiment > 0) sentimentText = ` with only ${sentiment}% positive sentiment - concerns noted`;

        insights.push({
          type: 'entity_analysis',
          insight: `"${entity}" discussed in ${percentage}% of comments (${data.count} mentions)${sentimentText}`,
          entity: entity,
          mentions: data.count,
          percentage: percentage,
          sentiment: sentiment
        });
      });
    }

    if (analysisId === 'outcome_analysis') {
      // Success/Failure Rate Analysis
      const worked = comments.filter(c => /\b(worked|success|helped|fixed|cured|solved)\b/i.test(c.body)).length;
      const failed = comments.filter(c => /\b(failed|didn't work|worse|useless|no help)\b/i.test(c.body)).length;
      const total = worked + failed;

      if (total >= 10) {
        const successRate = Math.round((worked / total) * 100);
        let interpretation = '';
        if (successRate >= 70) interpretation = 'highly effective';
        else if (successRate >= 50) interpretation = 'moderately effective';
        else if (successRate >= 30) interpretation = 'mixed results';
        else interpretation = 'low success rate - caution advised';

        insights.push({
          type: 'outcome_analysis',
          insight: `${successRate}% success rate across reported attempts (${worked} worked vs ${failed} failed) - ${interpretation}`,
          successRate: successRate,
          worked: worked,
          failed: failed
        });
      }
    }

    if (analysisId === 'speaker_analysis') {
      // Expert vs Experience Mix
      const expertCount = comments.filter(c => /\b(I work|professional|doctor|engineer|specialist|expert)\b/i.test(c.body)).length;
      const experienceCount = comments.filter(c => /\b(I |my |me |I've|I'm|personally)\b/i.test(c.body)).length;
      const expertPct = Math.round((expertCount / comments.length) * 100);
      const experiencePct = Math.round((experienceCount / comments.length) * 100);

      let insight = '';
      if (expertPct >= 20) {
        insight = `${expertPct}% expert/professional input, ${experiencePct}% firsthand experiences - balanced authoritative and personal perspectives`;
      } else if (experiencePct >= 70) {
        insight = `${experiencePct}% firsthand personal experiences - highly authentic, lived-experience based discussion`;
      } else {
        insight = `Community-driven discussion with ${experiencePct}% firsthand experiences`;
      }

      insights.push({
        type: 'speaker_analysis',
        insight: insight,
        expertPct: expertPct,
        experiencePct: experiencePct
      });
    }

    if (analysisId === 'geographic_analysis') {
      // Geographic Patterns
      const locations = ['US', 'UK', 'Canada', 'Australia', 'Europe', 'Asia', 'India', 'China', 'California', 'Texas', 'New York'];
      const geoMentions = {};
      comments.forEach(c => {
        locations.forEach(loc => {
          if ((c.body || '').includes(loc)) {
            geoMentions[loc] = (geoMentions[loc] || 0) + 1;
          }
        });
      });

      const mentioned = Object.entries(geoMentions).filter(([_, count]) => count >= 2);
      if (mentioned.length >= 2) {
        const locationList = mentioned.map(([loc, count]) => `${loc} (${count})`).join(', ');
        insights.push({
          type: 'geographic_analysis',
          insight: `Geographic differences noted: ${locationList} - treatment/experience varies by location`,
          locations: mentioned.length
        });
      }
    }

    if (analysisId === 'pricing_analysis') {
      // Pricing/Cost Analysis
      const priceComments = comments.filter(c => /\$[\d,]+|\bcost\b|\bprice\b|\bexpensive\b|\bcheap\b|\baffordable\b/i.test(c.body));
      const expensiveMentions = priceComments.filter(c => /\bexpensive\b|\bpricey\b|\bcost\b|\$[\d,]{3,}/i.test(c.body)).length;
      const cheapMentions = priceComments.filter(c => /\bcheap\b|\baffordable\b|\bbudget\b/i.test(c.body)).length;
      const pricePct = Math.round((priceComments.length / comments.length) * 100);

      insights.push({
        type: 'pricing_analysis',
        insight: `Price discussed in ${pricePct}% of comments - ${expensiveMentions > cheapMentions ? 'Quality over price' : 'Budget-conscious'} audience`,
        pricePct: pricePct,
        expensiveMentions: expensiveMentions,
        cheapMentions: cheapMentions
      });
    }

    if (analysisId === 'timeline_analysis') {
      // Timeline Expectations
      const timeMentions = {};
      const timePatterns = {
        'immediate': /\b(immediately|instant|right away|same day)\b/i,
        'days': /\b(days?|few days|couple days)\b/i,
        'weeks': /\b(weeks?|few weeks)\b/i,
        'months': /\b(months?|several months)\b/i,
        'years': /\b(years?|long time|forever)\b/i
      };

      comments.forEach(c => {
        Object.entries(timePatterns).forEach(([timeline, pattern]) => {
          if (pattern.test(c.body)) {
            timeMentions[timeline] = (timeMentions[timeline] || 0) + 1;
          }
        });
      });

      const dominant = Object.entries(timeMentions).sort((a, b) => b[1] - a[1])[0];
      if (dominant && dominant[1] >= 3) {
        const pct = Math.round((dominant[1] / comments.length) * 100);
        insights.push({
          type: 'timeline_analysis',
          insight: `Most common timeline: "${dominant[0]}" (${pct}% of comments) - sets realistic expectations`,
          timeline: dominant[0],
          percentage: pct
        });
      }
    }

    if (analysisId === 'phrase_analysis') {
      // Common Language & Phrases
      const phrases = {};
      comments.forEach(c => {
        const words = (c.body || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (let i = 0; i < words.length - 2; i++) {
          const phrase = words.slice(i, i + 3).join(' ');
          if (phrase.length >= 12 && phrase.length <= 60) {
            phrases[phrase] = (phrases[phrase] || 0) + 1;
          }
        }
      });

      const common = Object.entries(phrases)
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      common.forEach(([phrase, count]) => {
        const pct = Math.round((count / comments.length) * 100);
        insights.push({
          type: 'phrase_analysis',
          insight: `"${phrase}" repeated ${count} times (${pct}% of comments) - common shared experience`,
          phrase: phrase,
          count: count
        });
      });
    }

    if (analysisId === 'comparison_analysis') {
      // Comparison Analysis
      const comparisons = [];
      comments.forEach(c => {
        const matches = (c.body || '').match(/([A-Za-z\s]+)\s+(vs|versus|compared to|better than|worse than|instead of)\s+([A-Za-z\s]+)/gi);
        if (matches) {
          matches.forEach(m => comparisons.push(m));
        }
      });

      if (comparisons.length >= 5) {
        insights.push({
          type: 'comparison_analysis',
          insight: `${comparisons.length} comparisons found - active evaluation and decision-making in discussion`,
          count: comparisons.length,
          examples: comparisons.slice(0, 3)
        });
      }
    }

    if (analysisId === 'emotion_analysis') {
      // Emotional Tone Analysis
      const emotions = {
        'frustrated': 0,
        'excited': 0,
        'worried': 0
      };

      comments.forEach(c => {
        const body = c.body || '';
        if (/\b(frustrat|annoying|impossible|can't|won't)\b/i.test(body)) emotions.frustrated++;
        if (/\b(excited|amazing|love|incredible|fantastic)\b/i.test(body)) emotions.excited++;
        if (/\b(worry|concern|anxious|afraid|nervous)\b/i.test(body)) emotions.worried++;
      });

      const dominant = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0];
      if (dominant && dominant[1] >= 5) {
        const pct = Math.round((dominant[1] / comments.length) * 100);
        insights.push({
          type: 'emotion_analysis',
          insight: `Dominant emotion: ${dominant[0]} (${pct}% of comments) - shapes discussion tone`,
          emotion: dominant[0],
          percentage: pct
        });
      }
    }

  });

  return {
    selectedAnalyses: selectedAnalyses,
    totalInsights: insights.length,
    insights: insights
  };
}

// ============================================================================
// AI-POWERED INSIGHTS GENERATION
// ============================================================================

/**
 * Generate AI-powered insights using Gemini
 * Replaces regex-based analysis with intelligent AI analysis
 */
function generateAIInsights(contentData) {
  console.log('STEP 3: Generating AI-powered insights with Gemini');
  console.log('Content data received:', {
    hasPost: !!contentData.post,
    commentsCount: contentData.valuableComments?.length || 0,
    hasStats: !!contentData.extractionStats
  });

  try {
    // Use the existing comprehensive prompt
    console.log('Building analysis prompt...');
    const prompt = formatForClaudeAnalysis(contentData);
    console.log('Prompt length:', prompt.length, 'characters');

    // Call Gemini API
    console.log('Calling Gemini API...');
    const aiResult = analyzeWithGemini(prompt);

    console.log('Gemini API result:', {
      success: aiResult.success,
      hasAnalysis: !!aiResult.analysis,
      analysisLength: aiResult.analysis?.length || 0,
      error: aiResult.error || 'none'
    });

    if (!aiResult.success) {
      const errorMsg = `Gemini API failed: ${aiResult.error || aiResult.message || 'Unknown error'}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Return AI analysis in compatible format
    console.log('Returning AI analysis successfully');
    return {
      mode: 'ai_analysis',
      model: aiResult.model,
      totalInsights: 1,
      aiAnalysis: aiResult.analysis,
      insights: [{
        type: 'ai_comprehensive',
        insight: 'AI-powered comprehensive analysis',
        fullAnalysis: aiResult.analysis
      }]
    };

  } catch (error) {
    console.error('AI insights generation error:', error);
    console.error('Error stack:', error.stack);
    throw new Error('AI analysis failed: ' + error.message);
  }
}

// ============================================================================
// EXPORT TO GOOGLE DRIVE & CLAUDE PRO ANALYSIS
// ============================================================================

/**
 * Format extracted data for Claude Pro analysis
 * Includes universal analysis prompt at the top
 */
function formatForClaudeAnalysis(extractedData) {
  const post = extractedData.post;
  const comments = extractedData.valuableComments;
  const stats = extractedData.extractionStats;

  // Universal analysis prompt
  const prompt = `═══════════════════════════════════════════════════════════════════════════
REDDIT CONTENT ANALYSIS REQUEST
═══════════════════════════════════════════════════════════════════════════

You are an expert Reddit content analyst. Below is a Reddit post with extracted high-value comments. Provide deep, actionable insights that go beyond surface-level observations.

═══════════════════════════════════════════════════════════════════════════
ANALYSIS FRAMEWORK
═══════════════════════════════════════════════════════════════════════════

1. CONTENT INTELLIGENCE
   • What type of discussion is this? (Don't force categories - describe what you observe)
   • What makes this content engaging to this audience?
   • What patterns emerge that might not be immediately obvious?

2. ENGAGEMENT DYNAMICS
   • Why did certain comments get high upvotes? What resonated?
   • Is there consensus, controversy, or something else driving engagement?
   • What's the upvote distribution telling us?

3. HIDDEN PATTERNS
   Look for non-obvious patterns:
   • Cognitive biases (confirmation bias, survivorship bias, etc.)
   • Emotional triggers (fear, hope, identity, validation)
   • Social dynamics (expertise vs experience, contrarian vs conformist)
   • Temporal patterns (immediate vs long-term thinking)
   • Economic factors (price sensitivity, value perception)

4. AUDIENCE INSIGHTS
   • Who is participating? (experts, enthusiasts, beginners, skeptics)
   • What do they care about? (practical advice, validation, entertainment, learning)
   • What assumptions do they share?
   • What questions are they really asking (vs what they explicitly say)?

5. CONTENT STRATEGY INTELLIGENCE
   If someone wanted to create similar engaging content:
   • What elements should they replicate?
   • What format works best? (question, story, controversy, education)
   • What tone resonates?
   • What timing/context matters?

6. SURPRISING FINDINGS
   • What's unexpected or counter-intuitive?
   • What would most people miss on first read?
   • What does this reveal about the community/topic/culture?

7. ACTIONABLE RECOMMENDATIONS
   Provide 3-5 specific, actionable takeaways for:
   • Content creators (how to replicate engagement)
   • Marketers (audience insights for targeting)
   • Researchers (cultural/social patterns)
   • The original poster (what they can learn)

8. DATA ANALYSIS WITH TABLES
   Generate data-driven tables that are RELEVANT to this specific content type.
   Choose 5-8 tables from the options below based on what makes sense for THIS discussion:

   UNIVERSAL TABLES (apply to most posts):
   ┌─────────────────────────────────────────────────────────────────┐
   │ Table 1: Upvote Performance Tiers                                │
   │ Columns: Tier | Range | # Comments | Avg Position | Patterns    │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ Table 2: Top 10-20 Comments Breakdown                            │
   │ Columns: Rank | Author | Upvotes | Theme | Key Factor          │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ Table 3: Theme Distribution & Engagement                         │
   │ Columns: Theme | # Comments | Avg Upvotes | % of Discussion    │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ Table 4: Word Count vs Engagement                                │
   │ Columns: Range | # Comments | Avg Upvotes | Optimal?           │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ Table 5: Sentiment Distribution                                  │
   │ Columns: Sentiment | # Comments | Avg Upvotes | Characteristics│
   └─────────────────────────────────────────────────────────────────┘

   CONTENT-SPECIFIC TABLES (choose relevant ones):

   For FACTUAL/TIL content:
   • Cognitive Violation Types (Type | Definition | Avg Upvotes | Examples)
   • "Feels Fake" Intensity Spectrum (Level | Description | # Comments | Avg Upvotes)
   • Fact Verifiability Matrix (Type | # Comments | Trust Level | Examples)
   • Temporal Reference Distribution (Time Period | # Comments | Patterns)

   For PRODUCT/REVIEW content:
   • Product Feature Sentiment (Feature | Positive | Negative | Net Score)
   • Price Sensitivity Analysis (Price Tier | # Mentions | Sentiment | Willingness)
   • Comparison Matrix (Product A vs B | Mentions | Preference | Reasons)
   • Purchase Intent Signals (Signal Type | Frequency | Confidence Level)

   For OPINION/DEBATE content:
   • Viewpoint Distribution (Position | % Support | Avg Upvotes | Key Arguments)
   • Argument Quality Matrix (Type | Frequency | Evidence Level | Effectiveness)
   • Polarization Metrics (Metric | Score | Interpretation)
   • Logical Fallacies Detected (Fallacy | Occurrences | Impact on Discussion)

   For ADVICE/HOW-TO content:
   • Solution Success Rates (Approach | Worked | Failed | Success % | Sample Size)
   • Expert vs Experience Split (Source Type | # Comments | Credibility | Agreement)
   • Timeline Expectations (Duration | # Mentions | Success Correlation)
   • Common Mistakes Mentioned (Mistake | Frequency | Impact | How to Avoid)

   For STORY/EXPERIENCE content:
   • Emotional Response Distribution (Emotion | % of Comments | Typical Phrasing)
   • Advice vs Empathy Ratio (Type | Count | % of Total | Upvote Performance)
   • Support Tone Analysis (Tone | Frequency | Effectiveness | Examples)
   • Similar Experience Clusters (Experience Type | # Sharing | Common Patterns)

   ANALYSIS-SPECIFIC TABLES (if data supports):
   • Response Chain Analysis (Parent Topic | Upvotes | # Replies | Chain Depth | Total Engagement)
   • Missing Topics Analysis (Expected Topic | Presence | Possible Reasons)
   • Humor vs Serious Performance (Tone | # Comments | Avg Upvotes | Engagement Quality)
   • Time-of-Response Impact (Posted When | # Comments | Avg Performance)
   • Author Activity Patterns (Repeat Commenters | # Comments | Total Upvotes)

   TABLE GENERATION RULES:
   • Use markdown table format for easy reading
   • Include column headers and clear data
   • Add brief interpretation after each table
   • Only include tables that have sufficient data (minimum 5-10 data points)
   • Prioritize tables that reveal non-obvious insights
   • Calculate percentages, averages, and ratios where meaningful

IMPORTANT ANALYSIS GUIDELINES:
• Don't just summarize - analyze WHY things are the way they are
• Look for patterns across multiple comments, not just individual standouts
• Consider context: subreddit culture, current events, audience demographics
• Be honest if something is unclear or if the data is too limited
• Cite specific examples from the comments to support your insights
• Generate tables in markdown format for clarity
• Choose 5-8 most relevant tables based on content type - don't force irrelevant tables

═══════════════════════════════════════════════════════════════════════════
POST DATA
═══════════════════════════════════════════════════════════════════════════

TITLE: ${post.title}

METADATA:
• Posted by: u/${post.author}
• Subreddit: r/${post.subreddit || 'unknown'}
• Post Score: ${post.score} upvotes
• Total Comments: ${post.num_comments}

EXTRACTION STATISTICS:
• Total Comments Processed: ${stats.total}
• High-Value Comments Extracted: ${stats.extracted} (${stats.percentageKept}% kept)
• Average Comment Score: ${stats.averageScore}
• Extraction Quality: ${stats.percentageKept}% retention indicates ${stats.percentageKept > 50 ? 'diverse quality' : 'highly selective filtering'}

POST BODY:
${post.selftext ? post.selftext : '[No body text - link or image post]'}

═══════════════════════════════════════════════════════════════════════════
HIGH-VALUE COMMENTS (${comments.length} comments)
═══════════════════════════════════════════════════════════════════════════

${comments.map((comment, index) => {
  return `
────────────────────────────────────────────────────────────────────────────
COMMENT #${index + 1}
────────────────────────────────────────────────────────────────────────────
Author: u/${comment.author}
Score: ${comment.score} upvotes${comment.awards > 0 ? ` | Awards: ${comment.awards}` : ''}
Engagement Rank: #${index + 1} of ${comments.length}

${comment.body}
`;
}).join('\n')}

═══════════════════════════════════════════════════════════════════════════
END OF DATA
═══════════════════════════════════════════════════════════════════════════

Exported: ${new Date().toISOString()}
Analysis Tool: Reddit Analyzer v1.0

Now please provide your comprehensive analysis following the framework above.
`;

  return prompt;
}

/**
 * Save formatted content to Google Drive
 * Returns file URL for user to access
 */
function saveToGoogleDrive(extractedData) {
  try {
    // Format content for Claude Pro
    const content = formatForClaudeAnalysis(extractedData);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const postTitle = extractedData.post.title.substring(0, 50).replace(/[^a-z0-9]/gi, '_');
    const fileName = `Reddit_Analysis_${postTitle}_${timestamp}.txt`;

    // Create file in user's Google Drive root
    const file = DriveApp.createFile(fileName, content, MimeType.PLAIN_TEXT);

    // Get file URL
    const fileUrl = file.getUrl();
    const fileId = file.getId();

    console.log('File saved to Drive:', fileName);

    return {
      success: true,
      fileName: fileName,
      fileUrl: fileUrl,
      fileId: fileId,
      message: 'File saved to Google Drive successfully!'
    };

  } catch (error) {
    console.error('Error saving to Drive:', error);
    return {
      success: false,
      error: error.toString(),
      message: 'Failed to save to Google Drive. Make sure the script has Drive permissions.'
    };
  }
}
