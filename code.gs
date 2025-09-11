// Reddit API Configuration
const REDDIT_CONFIG = {
  clientId: 'FSkASxBHOGaYVZLWpQO9TA',
  clientSecret: 'AnNiJyAazf5-iW5s16ppCzXJbLNwEw',
  userAgent: 'web:RedditAnalyzer:v1.0.0 (by /u/gamestopfan)'
};

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

function doGet(e) {
  const output = ContentService.createTextOutput();
  
  try {
    const url = e.parameter.url;
    const mode = e.parameter.mode || 'deep'; // 'deep' for single post, 'overview' for subreddit
    const callback = e.parameter.callback;
    
    console.log('Processing request for:', url, 'Mode:', mode);
    
    let processedData;
    
    if (mode === 'overview') {
      // Subreddit overview mode
      const redditData = fetchSubredditOverview(url);
      processedData = processSubredditOverview(redditData, url);
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
  
  // Extract enhanced insights including new features
  const insights = extractEnhancedInsights(posts, validComments);
  // Add simplified insights
try {
  const simplifiedInsights = extractWhatMatters(posts, validComments);
  if (simplifiedInsights) {
    // Merge simplified insights with existing ones
    insights.consensus = simplifiedInsights.consensus || [];
    insights.problems = simplifiedInsights.problems || [];
    insights.solutions = simplifiedInsights.solutions || [];
    insights.discussions = simplifiedInsights.discussions || [];
    insights.hiddenGems = simplifiedInsights.hiddenGems || [];
    insights.patterns = simplifiedInsights.patterns || [];
  }
} catch (error) {
  console.error('Simplified extraction error:', error);
  // Continue with existing insights if simplified fails
}
  // Extract special comment categories
  const postScore = posts[0] ? posts[0].score : 0;
  const specialComments = extractSpecialComments(validComments, postScore);
  
  return {
    posts: posts.slice(0, 15),
    comments: validComments.slice(0, 50),
    insights: insights,
    specialComments: specialComments,
    stats: {
      totalPosts: posts.length,
      totalComments: validComments.length,
      totalScore: validComments.reduce((sum, c) => sum + (c.score || 0), 0),
      averageScore: validComments.length > 0 ? Math.round(validComments.reduce((sum, c) => sum + (c.score || 0), 0) / validComments.length) : 0,
      topScore: validComments.length > 0 ? Math.max(...validComments.map(c => c.score || 0)) : 0,
      postScore: postScore
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

function extractEnhancedInsights(posts, comments) {
  const allText = [
    ...posts.map(p => (p.title || '') + ' ' + (p.selftext || '')),
    ...comments.map(c => c.body || '')
  ].join(' ');
  
  return {
    // Keep existing basic insights
    moneyMentions: extractMoneyMentions(allText),
    links: extractLinksWithContext(posts, comments),
    sentiment: analyzeSentiment(allText),
    
    // Enhanced insights
    contentGoldmines: extractContentGoldmines(comments),
    entrepreneurialOpportunities: extractEntrepreneurialOpportunities(comments),
    funnyMoments: extractFunnyMoments(comments),
    deepRealizations: extractDeepRealizations(comments),
    trendingThemes: extractExpandedTrendingThemes(comments), // Enhanced version
    expertInsights: extractExpertInsights(comments)
  };
}

// Enhanced trending themes with more context
function extractExpandedTrendingThemes(comments) {
  const themeData = {};
  
  // Expanded theme keywords
  const themeKeywords = {
    'AI/Technology': {
      keywords: ['AI', 'artificial intelligence', 'machine learning', 'automation', 'robot', 'algorithm', 'software', 'tech', 'GPT', 'ChatGPT', 'coding', 'programming'],
      questions: [],
      topComments: [],
      sentiment: { positive: 0, negative: 0 }
    },
    'Money/Finance': {
      keywords: ['money', 'dollar', 'cost', 'price', 'expensive', 'cheap', 'invest', 'profit', 'salary', 'income', 'financial', 'economy', 'inflation'],
      questions: [],
      topComments: [],
      sentiment: { positive: 0, negative: 0 }
    },
    'Work/Career': {
      keywords: ['job', 'work', 'career', 'boss', 'employee', 'company', 'business', 'industry', 'hire', 'fired', 'remote', 'office', 'promotion'],
      questions: [],
      topComments: [],
      sentiment: { positive: 0, negative: 0 }
    },
    'Health/Wellness': {
      keywords: ['health', 'doctor', 'medical', 'hospital', 'disease', 'treatment', 'therapy', 'medicine', 'mental health', 'anxiety', 'depression', 'fitness'],
      questions: [],
      topComments: [],
      sentiment: { positive: 0, negative: 0 }
    },
    'Education': {
      keywords: ['school', 'university', 'college', 'student', 'teacher', 'education', 'learn', 'course', 'degree', 'study', 'exam', 'graduate'],
      questions: [],
      topComments: [],
      sentiment: { positive: 0, negative: 0 }
    }
  };
  
  // Initialize theme data
  Object.keys(themeKeywords).forEach(theme => {
    themeData[theme] = {
      count: 0,
      questions: [],
      topComments: [],
      sentiment: { positive: 0, negative: 0, neutral: 0 },
      keywords: themeKeywords[theme].keywords
    };
  });
  
  // Analyze comments
  comments.forEach(comment => {
    const body = (comment.body || '').toLowerCase();
    const isQuestion = body.includes('?');
    
    Object.keys(themeKeywords).forEach(theme => {
      const themeInfo = themeKeywords[theme];
      const hasKeyword = themeInfo.keywords.some(keyword => body.includes(keyword.toLowerCase()));
      
      if (hasKeyword) {
        themeData[theme].count++;
        
        // Collect questions
        if (isQuestion && themeData[theme].questions.length < 3) {
          themeData[theme].questions.push({
            text: comment.body.substring(0, 200) + (comment.body.length > 200 ? '...' : ''),
            score: comment.score,
            author: comment.author
          });
        }
        
        // Collect top comments
        if (comment.score > 50 && themeData[theme].topComments.length < 3) {
          themeData[theme].topComments.push({
            text: comment.body.substring(0, 200) + (comment.body.length > 200 ? '...' : ''),
            score: comment.score,
            author: comment.author,
            permalink: comment.permalink
          });
        }
        
        // Analyze sentiment
        const sentiment = analyzeSentiment(comment.body);
        if (sentiment.overall === 'positive') {
          themeData[theme].sentiment.positive++;
        } else if (sentiment.overall === 'negative') {
          themeData[theme].sentiment.negative++;
        } else {
          themeData[theme].sentiment.neutral++;
        }
      }
    });
  });
  
  // Convert to array and calculate percentages
  const themes = Object.entries(themeData)
    .filter(([theme, data]) => data.count > 0)
    .map(([theme, data]) => ({
      theme: theme,
      mentions: data.count,
      percentage: Math.round((data.count / comments.length) * 100),
      questions: data.questions.sort((a, b) => b.score - a.score).slice(0, 2),
      topComments: data.topComments.sort((a, b) => b.score - a.score).slice(0, 2),
      sentiment: {
        positive: Math.round((data.sentiment.positive / data.count) * 100),
        negative: Math.round((data.sentiment.negative / data.count) * 100),
        neutral: Math.round((data.sentiment.neutral / data.count) * 100)
      }
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);
  
  return themes;
}

// Keep all existing extraction functions below...
// (extractLinksWithContext, extractContentGoldmines, extractEntrepreneurialOpportunities, 
//  extractFunnyMoments, extractDeepRealizations, extractExpertInsights, 
//  extractMoneyMentions, analyzeSentiment)

// Enhanced link extraction with context
function extractLinksWithContext(posts, comments) {
  const urlRegex = /https?:\/\/[^\s\)\]\}\>\<\"\'\`]+/g;
  const linksWithContext = [];
  
  comments.forEach(comment => {
    if (comment.body && typeof comment.body === 'string') {
      const urls = comment.body.match(urlRegex) || [];
      urls.forEach(url => {
        const cleanUrl = url.replace(/[.,;!?)\]}\>\<\"\'\`]+$/, '');
        if (cleanUrl.length > 15 &&
            !cleanUrl.includes('reddit.com') && 
            !cleanUrl.includes('imgur.com') && 
            !cleanUrl.includes('i.redd.it') &&
            !cleanUrl.includes('v.redd.it')) {
          
          const linkIndex = comment.body.indexOf(url);
          const contextStart = Math.max(0, linkIndex - 50);
          const contextEnd = Math.min(comment.body.length, linkIndex + url.length + 50);
          const context = comment.body.substring(contextStart, contextEnd).replace(/\n/g, ' ').trim();
          
          linksWithContext.push({
            url: cleanUrl,
            author: comment.author,
            score: comment.score,
            context: context,
            permalink: comment.permalink
          });
        }
      });
    }
  });
  
  linksWithContext.sort((a, b) => b.score - a.score);
  return linksWithContext.slice(0, 10);
}

function extractContentGoldmines(comments) {
  const goldmines = [];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;
    
    if (score > 100 && body.length > 100 && body.length < 1000) {
      const hasStoryElements = /\b(I |we |my |our |happened|realized|learned|discovered|found out)\b/i.test(body);
      const hasInsightElements = /\b(actually|turns out|people don't realize|most people|the truth is|the key is|the secret is)\b/i.test(body);
      
      if (hasStoryElements || hasInsightElements) {
        goldmines.push({
          type: hasStoryElements ? 'story' : 'insight',
          content: body.substring(0, 500) + (body.length > 500 ? '...' : ''),
          author: comment.author,
          score: score,
          permalink: comment.permalink
        });
      }
    }
  });
  
  return goldmines.sort((a, b) => b.score - a.score).slice(0, 10);
}

function extractEntrepreneurialOpportunities(comments) {
  const opportunities = [];
  
  const opportunityPatterns = [
    /\b(nobody is|no one is|somebody should|someone should|wish there was|wish someone would|need[s]? to be|should exist)\b/i,
    /\b(gap in the market|underserved|overlooked|huge opportunity|untapped|gold mine)\b/i,
    /\b(would pay for|willing to pay|shut up and take my money|worth paying)\b/i,
    /\b(frustrat\w+|annoying|painful|sucks|broken|doesn't work|waste[s]? time)\b.*\b(solution|fix|solve|better way)\b/i
  ];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    
    opportunityPatterns.forEach(pattern => {
      if (pattern.test(body)) {
        const sentences = body.split(/[.!?]+/);
        sentences.forEach(sentence => {
          if (pattern.test(sentence) && sentence.length > 20) {
            opportunities.push({
              opportunity: sentence.trim(),
              fullContext: body.substring(0, 300) + (body.length > 300 ? '...' : ''),
              author: comment.author,
              score: comment.score || 0,
              permalink: comment.permalink
            });
          }
        });
      }
    });
  });
  
  const uniqueOpportunities = opportunities.reduce((acc, curr) => {
    const exists = acc.find(item => 
      item.opportunity.toLowerCase() === curr.opportunity.toLowerCase()
    );
    if (!exists) acc.push(curr);
    return acc;
  }, []);
  
  return uniqueOpportunities.sort((a, b) => b.score - a.score).slice(0, 10);
}

function extractFunnyMoments(comments) {
  const funnyMoments = [];
  
  const humorIndicators = [
    /\b(lol|lmao|lmfao|haha|😂|🤣|hilarious|comedy gold|spit out|lost it|dying|can't stop laughing)\b/i,
    /\b(plot twist|wait what|had us in the first half|unexpected|didn't see that coming)\b/i,
    /^(r\/[a-zA-Z]+)$/m
  ];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;
    
    if (score > 50) {
      let humorScore = 0;
      humorIndicators.forEach(pattern => {
        if (pattern.test(body)) humorScore++;
      });
      
      if (body.length < 200 && body.length > 10) humorScore++;
      if (body.includes('"') && body.split('"').length > 2) humorScore++;
      
      if (humorScore > 0) {
        funnyMoments.push({
          content: body,
          humorScore: humorScore,
          author: comment.author,
          score: score,
          permalink: comment.permalink
        });
      }
    }
  });
  
  return funnyMoments
    .sort((a, b) => (b.score * b.humorScore) - (a.score * a.humorScore))
    .slice(0, 10);
}

function extractDeepRealizations(comments) {
  const realizations = [];
  
  const deepPatterns = [
    /\b(realized|realize|revelation|epiphany|changed my perspective|opened my eyes|never thought about|made me think)\b/i,
    /\b(the real|the actual|the true|fundamentally|essentially|at its core|when you think about it)\b/i,
    /\b(life lesson|learned that|taught me|wisdom|profound|deep truth|universal truth)\b/i
  ];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;
    
    if (score > 50 && body.length > 150) {
      let depthScore = 0;
      deepPatterns.forEach(pattern => {
        if (pattern.test(body)) depthScore++;
      });
      
      if (depthScore > 0) {
        realizations.push({
          insight: body.substring(0, 500) + (body.length > 500 ? '...' : ''),
          depthScore: depthScore,
          author: comment.author,
          score: score,
          permalink: comment.permalink
        });
      }
    }
  });
  
  return realizations
    .sort((a, b) => (b.score * b.depthScore) - (a.score * a.depthScore))
    .slice(0, 10);
}

function extractExpertInsights(comments) {
  const expertComments = [];
  
  const expertIndicators = [
    /\b(I work in|I'm a|I am a|as a|I've been|years of experience|professional|expert)\b/i,
    /\b(source:|actually|technically|specifically|to clarify|to be precise)\b/i,
    /\b(PhD|doctor|engineer|developer|analyst|researcher|scientist|professor)\b/i
  ];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;
    
    if (score > 30 && body.length > 200) {
      let expertScore = 0;
      let credentials = '';
      
      expertIndicators.forEach(pattern => {
        const match = body.match(pattern);
        if (match) {
          expertScore++;
          if (!credentials && match[0]) {
            const startIdx = Math.max(0, match.index - 20);
            const endIdx = Math.min(body.length, match.index + 100);
            credentials = body.substring(startIdx, endIdx).replace(/\n/g, ' ').trim();
          }
        }
      });
      
      if (/\n[-*•]|\n\d+\./.test(body)) expertScore++;
      
      if (expertScore > 0) {
        expertComments.push({
          content: body.substring(0, 500) + (body.length > 500 ? '...' : ''),
          credentials: credentials,
          expertScore: expertScore,
          author: comment.author,
          score: score,
          permalink: comment.permalink
        });
      }
    }
  });
  
  return expertComments
    .sort((a, b) => (b.score * b.expertScore) - (a.score * a.expertScore))
    .slice(0, 10);
}

function extractMoneyMentions(text) {
  if (!text || typeof text !== 'string') return [];
  
  const patterns = [
    /\$[\d,]+(?:\.\d{1,2})?(?:\s*(?:K|k|M|m|B|b|million|billion|thousand))?/g,
    /₹[\d,]+(?:\.\d{1,2})?(?:\s*(?:K|k|M|m|B|b|crore|lakh))?/g,
    /[\d,]+(?:\.\d{1,2})?\s*(?:dollars?|USD|usd|rupees?|INR)/g,
    /[\d,]+(?:\.\d{1,2})?\s*(?:K|M|B)\s*(?:revenue|profit|ARR|MRR|valuation|salary)/g,
    /\d+(?:,\d{3})*\s*(?:%|percent)/g
  ];
  
  let matches = [];
  patterns.forEach(pattern => {
    const found = text.match(pattern) || [];
    matches = matches.concat(found);
  });
  
  return [...new Set(matches)]
    .map(match => match.trim())
    .filter(match => match.length > 1)
    .slice(0, 15);
}

function analyzeSentiment(text) {
  if (!text || typeof text !== 'string') {
    return { positive: 0, negative: 0, overall: 'neutral', ratio: 50 };
  }
  
  const positiveWords = [
    'great', 'awesome', 'good', 'love', 'amazing', 'excellent', 'perfect', 'wonderful',
    'success', 'successful', 'profitable', 'booming', 'growing', 'opportunity', 'valuable',
    'incredible', 'fantastic', 'outstanding', 'impressive', 'brilliant', 'helpful',
    'useful', 'effective', 'efficient', 'innovative', 'revolutionary', 'game-changing'
  ];
  
  const negativeWords = [
    'bad', 'awful', 'terrible', 'hate', 'worst', 'horrible', 'disgusting', 'trash',
    'failed', 'failure', 'struggling', 'difficult', 'problem', 'challenging', 'impossible',
    'frustrating', 'annoying', 'disappointing', 'useless', 'broken', 'disaster',
    'nightmare', 'painful', 'expensive', 'overpriced', 'scam', 'waste'
  ];
  
  const words = text.toLowerCase().split(/\s+/);
  let positive = 0;
  let negative = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) positive++;
    if (negativeWords.includes(word)) negative++;
  });
  
  const total = positive + negative;
  const ratio = total > 0 ? Math.round((positive / total) * 100) : 50;
  
  return {
    positive,
    negative,
    overall: positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral',
    ratio: ratio
  };
}

// Test function
function testRedditAuth() {
  try {
    const token = getRedditAccessToken();
    console.log('Successfully authenticated! Token:', token.substring(0, 10) + '...');
    return true;
  } catch (error) {
    console.error('Authentication failed:', error);
    return false;
  }
}

function testDirectFetch() {
  try {
    console.log('Test 1: Checking authentication...');
    const token = getRedditAccessToken();
    console.log('✓ Authentication successful');
    
    console.log('Test 2: Fetching Reddit data...');
    const testUrl = 'https://oauth.reddit.com/r/AskReddit/hot.json?limit=1';
    
    const response = UrlFetchApp.fetch(testUrl, {
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': REDDIT_CONFIG.userAgent
      },
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    console.log('Response code:', code);
    
    if (code === 200) {
      console.log('✓ Reddit API is accessible');
      const data = JSON.parse(response.getContentText());
      console.log('✓ Got data:', data.data.children.length, 'posts');
      return 'SUCCESS: Reddit API is working';
    } else {
      console.log('✗ Reddit returned error:', code);
      console.log('Response:', response.getContentText().substring(0, 200));
      return 'ERROR: Reddit API returned ' + code;
    }
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    return 'ERROR: ' + error.toString();
  }
}
// Add simplified insights
try {
  const simplifiedInsights = extractWhatMatters(posts, validComments);
  if (simplifiedInsights) {
    // Merge simplified insights with existing ones
    insights.consensus = simplifiedInsights.consensus || [];
    insights.problems = simplifiedInsights.problems || [];
    insights.solutions = simplifiedInsights.solutions || [];
    insights.discussions = simplifiedInsights.discussions || [];
    insights.hiddenGems = simplifiedInsights.hiddenGems || [];
    insights.patterns = simplifiedInsights.patterns || [];
  }
} catch (error) {
  console.error('Simplified extraction error:', error);
  // Continue with existing insights if simplified fails
}
// ========== NEW SIMPLIFIED EXTRACTION FUNCTIONS ==========

function extractWhatMatters(posts, comments) {
  return {
    consensus: extractConsensus(comments),
    problems: extractProblems(comments),
    solutions: extractVerifiedSolutions(comments),
    discussions: extractRealDiscussions(comments),
    hiddenGems: extractHiddenGems(comments),
    patterns: extractPatterns(comments)
  };
}

function extractConsensus(comments) {
  const statements = {};
  
  comments.forEach(comment => {
    const body = comment.body || '';
    const sentences = body.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      if (sentence.length > 20 && sentence.length < 200) {
        if (/\b(the best way|what works|always|never|everyone should)\b/i.test(sentence)) {
          const cleaned = sentence.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
          
          if (!statements[cleaned]) {
            statements[cleaned] = {
              text: sentence.trim(),
              mentions: 0,
              examples: []
            };
          }
          
          statements[cleaned].mentions++;
          if (statements[cleaned].examples.length < 3) {
            statements[cleaned].examples.push({
              author: comment.author,
              score: comment.score,
              permalink: comment.permalink
            });
          }
        }
      }
    });
  });
  
  return Object.values(statements)
    .filter(s => s.mentions >= 3)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);
}

function extractProblems(comments) {
  const problems = [];
  const problemPatterns = [
    /\b(can't|cannot|unable to|struggle with|hard to|difficult to)\b/i,
    /\b(my problem is|the problem is|doesn't work|not working)\b/i,
    /\b(too tired|too anxious|too depressed|too scared)\b/i
  ];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    
    problemPatterns.forEach(pattern => {
      if (pattern.test(body)) {
        const sentences = body.split(/[.!?]+/);
        sentences.forEach(sentence => {
          if (pattern.test(sentence) && sentence.length > 20) {
            problems.push({
              problem: sentence.trim(),
              author: comment.author,
              score: comment.score,
              permalink: comment.permalink
            });
          }
        });
      }
    });
  });
  
  // Group similar problems
  const grouped = {};
  problems.forEach(p => {
    const key = p.problem.toLowerCase().substring(0, 50);
    if (!grouped[key]) {
      grouped[key] = {
        problem: p.problem,
        count: 0,
        examples: []
      };
    }
    grouped[key].count++;
    if (grouped[key].examples.length < 3) {
      grouped[key].examples.push(p);
    }
  });
  
  return Object.values(grouped)
    .filter(p => p.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function extractVerifiedSolutions(comments) {
  const solutions = [];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;
    
    if (score > 20 && /\b(this works|worked for me|try this|the solution)\b/i.test(body)) {
      let confirmations = 0;
      
      // Check replies for confirmations
      if (comment.replies && comment.replies.data && comment.replies.data.children) {
        comment.replies.data.children.forEach(reply => {
          if (reply.data && reply.data.body) {
            if (/\b(works|confirm|thanks|helped)\b/i.test(reply.data.body)) {
              confirmations++;
            }
          }
        });
      }
      
      if (confirmations >= 2 || score > 100) {
        solutions.push({
          solution: body.substring(0, 300) + (body.length > 300 ? '...' : ''),
          author: comment.author,
          score: score,
          confirmations: confirmations,
          permalink: comment.permalink
        });
      }
    }
  });
  
  return solutions
    .sort((a, b) => (b.confirmations * 10 + b.score) - (a.confirmations * 10 + a.score))
    .slice(0, 5);
}

function extractRealDiscussions(comments) {
  const discussions = [];
  
  comments.forEach(comment => {
    const replyCount = countReplies(comment);
    const score = comment.score || 0;
    
    if (replyCount > 10) {
      let debateScore = 0;
      let supportScore = 0;
      
      if (comment.replies && comment.replies.data && comment.replies.data.children) {
        comment.replies.data.children.forEach(reply => {
          if (reply.data && reply.data.body) {
            const replyBody = reply.data.body.toLowerCase();
            if (/\b(disagree|wrong|actually|but|however)\b/.test(replyBody)) {
              debateScore++;
            }
            if (/\b(agree|exactly|this|yes|true)\b/.test(replyBody)) {
              supportScore++;
            }
          }
        });
      }
      
      const discussionType = debateScore > supportScore ? 'debate' : 'agreement';
      
      discussions.push({
        comment: comment.body.substring(0, 200) + (comment.body.length > 200 ? '...' : ''),
        author: comment.author,
        score: score,
        replyCount: replyCount,
        discussionType: discussionType,
        permalink: comment.permalink
      });
    }
  });
  
  return discussions.sort((a, b) => b.replyCount - a.replyCount).slice(0, 5);
}

function extractHiddenGems(comments) {
  const gems = [];
  
  comments.forEach(comment => {
    const body = comment.body || '';
    const score = comment.score || 0;
    
    // Low score but high value
    if (score < 100 && score > 10 && body.length > 150) {
      let valueScore = 0;
      
      if (/\b(pro tip|important|please read|source:|study shows|worked in|years of experience)\b/i.test(body)) {
        valueScore += 2;
      }
      if (/https?:\/\//.test(body)) valueScore++;
      if (/\n[-*•]|\n\d+\./.test(body)) valueScore++;
      
      if (valueScore >= 2) {
        gems.push({
          content: body.substring(0, 400) + (body.length > 400 ? '...' : ''),
          author: comment.author,
          score: score,
          valueScore: valueScore,
          permalink: comment.permalink,
          reason: identifyGemReason(body)
        });
      }
    }
  });
  
  return gems.sort((a, b) => b.valueScore - a.valueScore).slice(0, 3);
}

function extractPatterns(comments) {
  const phrases = {};
  
  comments.forEach(comment => {
    const body = (comment.body || '').toLowerCase();
    const words = body.split(/\s+/).filter(w => w.length > 3);
    
    // Look for 3-4 word phrases
    for (let i = 0; i < words.length - 3; i++) {
      const phrase = words.slice(i, i + 4).join(' ');
      if (!phrases[phrase]) {
        phrases[phrase] = { count: 0, users: new Set() };
      }
      phrases[phrase].count++;
      phrases[phrase].users.add(comment.author);
    }
  });
  
  return Object.entries(phrases)
    .filter(([phrase, data]) => data.users.size >= 3)
    .map(([phrase, data]) => ({
      pattern: phrase,
      mentionedBy: data.users.size + ' different users'
    }))
    .slice(0, 10);
}

// Helper function
function identifyGemReason(body) {
  if (/\b(source:|study shows|research shows)\b/i.test(body)) return 'Contains sources/research';
  if (/\b(former|used to be|worked in|years of experience)\b/i.test(body)) return 'Expert perspective';
  if (/\b(saved me|changed my life|wish I knew)\b/i.test(body)) return 'Life-changing advice';
  if (/\n[-*•]|\n\d+\./.test(body)) return 'Detailed breakdown';
  if (/https?:\/\//.test(body)) return 'Includes resources';
  return 'Valuable insight';
}
