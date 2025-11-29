const axios = require('axios');
const config = require('../config');

// Token cache
let tokenCache = {
  token: null,
  expiry: null
};

/**
 * Get Reddit OAuth access token (with caching)
 * @returns {Promise<string>} Access token
 */
async function getRedditAccessToken() {
  // Check if we have a valid cached token
  if (tokenCache.token && tokenCache.expiry && new Date() < new Date(tokenCache.expiry)) {
    console.log('Using cached Reddit token');
    return tokenCache.token;
  }

  console.log('Fetching new Reddit token');

  // Get new token using client credentials flow
  const auth = Buffer.from(`${config.reddit.clientId}:${config.reddit.clientSecret}`).toString('base64');

  try {
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': config.reddit.userAgent
        }
      }
    );

    if (response.data.access_token) {
      // Cache token with expiry
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + (response.data.expires_in - 60)); // Expire 1 minute early

      tokenCache.token = response.data.access_token;
      tokenCache.expiry = expiryDate.toISOString();

      return response.data.access_token;
    } else {
      throw new Error('Failed to get Reddit access token');
    }
  } catch (error) {
    console.error('Token fetch error:', error.message);
    throw new Error('Failed to authenticate with Reddit API');
  }
}

/**
 * Fetch Reddit post and comments data using OAuth
 * @param {string} inputUrl - Reddit post URL
 * @returns {Promise<object>} Reddit API response data
 */
async function fetchAuthenticatedRedditData(inputUrl) {
  const accessToken = await getRedditAccessToken();
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
      throw new Error('Please provide a direct post URL');
    }
  } else {
    throw new Error('Please provide a valid Reddit URL');
  }

  console.log('Fetching from:', apiUrl);

  try {
    const startTime = Date.now();
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent,
        'Accept': 'application/json'
      }
    });
    const endTime = Date.now();

    console.log(`Fetch took ${endTime - startTime}ms`);
    console.log(`Response size: ${JSON.stringify(response.data).length} bytes`);

    return response.data;
  } catch (error) {
    if (error.response) {
      const statusCode = error.response.status;
      if (statusCode === 401) {
        // Clear token cache
        tokenCache.token = null;
        tokenCache.expiry = null;
        throw new Error('Authentication failed - token expired');
      } else if (statusCode === 429) {
        throw new Error('Reddit rate limit - please wait 60 seconds');
      } else {
        throw new Error(`Reddit API error ${statusCode}`);
      }
    }
    throw new Error(`Failed to fetch Reddit data: ${error.message}`);
  }
}

/**
 * Extract all comments recursively from Reddit API response
 * @param {Array} commentChildren - Reddit comments array
 * @returns {Array} Flat array of all comments
 */
function extractAllComments(commentChildren) {
  const comments = [];

  function processComment(commentObj) {
    if (!commentObj || !commentObj.data) return;

    const comment = commentObj.data;

    // Skip "more" comments objects
    if (commentObj.kind === 'more') return;

    // Add this comment if it has valid content
    if (comment.body && comment.author) {
      comments.push({
        id: comment.id,
        author: comment.author,
        body: comment.body,
        score: comment.score || 0,
        created_utc: comment.created_utc,
        parent_id: comment.parent_id,
        depth: comment.depth || 0,
        awards: comment.all_awardings ? comment.all_awardings.length : 0
      });
    }

    // Recursively process replies
    if (comment.replies && comment.replies.data && comment.replies.data.children) {
      comment.replies.data.children.forEach(reply => processComment(reply));
    }
  }

  commentChildren.forEach(child => processComment(child));

  return comments;
}

/**
 * Extract high-value comments using quality filtering
 * @param {Array} comments - All comments from post
 * @param {object} post - Post data
 * @returns {object} Extracted data with stats
 */
function extractValuableContent(comments, post) {
  console.log(`Starting extraction: ${comments.length} total comments`);

  // Filter out invalid comments
  const validComments = comments.filter(comment =>
    comment.body &&
    comment.body !== '[deleted]' &&
    comment.body !== '[removed]' &&
    comment.author &&
    comment.author !== '[deleted]' &&
    comment.body.trim().length > 10
  );

  console.log(`Valid comments after filtering: ${validComments.length}`);

  if (validComments.length === 0) {
    return {
      post: {
        title: post.title,
        selftext: post.selftext || '',
        author: post.author,
        subreddit: post.subreddit,
        score: post.score,
        num_comments: post.num_comments,
        created_utc: post.created_utc
      },
      valuableComments: [],
      extractionStats: {
        total: comments.length,
        valid: 0,
        extracted: 0,
        percentageKept: 0,
        averageScore: 0
      }
    };
  }

  // Calculate quality threshold
  const scores = validComments.map(c => c.score).sort((a, b) => b - a);
  const topScore = scores[0];
  const medianScore = scores[Math.floor(scores.length / 2)];

  // Dynamic threshold based on post engagement
  const qualityThreshold = Math.max(
    Math.floor(medianScore * 0.5),
    3
  );

  console.log(`Quality threshold: ${qualityThreshold} (top: ${topScore}, median: ${medianScore})`);

  // Filter high-value comments
  const valuableComments = validComments
    .filter(comment => {
      const meetsScoreThreshold = comment.score >= qualityThreshold;
      const hasSubstance = comment.body.length >= 50;
      const notAutoMod = !comment.author.toLowerCase().includes('automoderator');

      return meetsScoreThreshold && hasSubstance && notAutoMod;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // Limit to top 50 comments

  const avgScore = Math.round(
    valuableComments.reduce((sum, c) => sum + c.score, 0) / valuableComments.length
  );

  const percentageKept = Math.round((valuableComments.length / validComments.length) * 100);

  console.log(`Extracted ${valuableComments.length} valuable comments (${percentageKept}% of valid)`);

  return {
    post: {
      title: post.title,
      selftext: post.selftext || '',
      author: post.author,
      subreddit: post.subreddit,
      score: post.score,
      num_comments: post.num_comments,
      created_utc: post.created_utc
    },
    valuableComments: valuableComments,
    extractionStats: {
      total: comments.length,
      valid: validComments.length,
      extracted: valuableComments.length,
      percentageKept: percentageKept,
      averageScore: avgScore
    }
  };
}

/**
 * Main function to extract Reddit data from URL
 * @param {string} url - Reddit post URL
 * @returns {Promise<object>} Extracted data
 */
async function extractRedditData(url) {
  try {
    console.log('Extracting Reddit data from:', url);

    // Fetch raw Reddit data
    const rawRedditData = await fetchAuthenticatedRedditData(url);

    // Parse Reddit API response structure
    let post = null;
    let comments = [];

    if (Array.isArray(rawRedditData) && rawRedditData.length >= 1) {
      // Extract post data
      if (rawRedditData[0] && rawRedditData[0].data && rawRedditData[0].data.children) {
        post = rawRedditData[0].data.children[0].data;
        console.log('Extracted post:', post.title);
      }

      // Extract comments data
      if (rawRedditData[1] && rawRedditData[1].data && rawRedditData[1].data.children) {
        const rawComments = rawRedditData[1].data.children;
        console.log('Raw comments found:', rawComments.length);
        comments = extractAllComments(rawComments);
        console.log('Extracted comments (recursive):', comments.length);
      }
    }

    if (!post) {
      throw new Error('Failed to extract post data from Reddit response');
    }

    // Extract valuable content
    const extractedData = extractValuableContent(comments, post);

    return {
      success: true,
      data: extractedData
    };
  } catch (error) {
    console.error('Reddit extraction error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getRedditAccessToken,
  fetchAuthenticatedRedditData,
  extractAllComments,
  extractValuableContent,
  extractRedditData
};
