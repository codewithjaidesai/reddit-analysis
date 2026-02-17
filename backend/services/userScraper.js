const axios = require('axios');
const { getRedditAccessToken } = require('./reddit');
const config = require('../config');

/**
 * Parse a Reddit username from a profile URL or plain username string
 * @param {string} input - Reddit profile URL or username
 * @returns {string} Clean username without u/ prefix
 */
function parseUsername(input) {
  if (!input) throw new Error('Username or profile URL is required');

  const trimmed = input.trim();

  // Handle profile URLs like https://www.reddit.com/user/username or /u/username
  const urlMatch = trimmed.match(/(?:reddit\.com\/(?:user|u)\/|^\/u\/)([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  // Handle u/username format
  const prefixMatch = trimmed.match(/^u\/([A-Za-z0-9_-]+)$/);
  if (prefixMatch) return prefixMatch[1];

  // Handle plain username
  const plainMatch = trimmed.match(/^[A-Za-z0-9_-]+$/);
  if (plainMatch) return trimmed;

  throw new Error('Invalid username or profile URL format');
}

/**
 * Fetch a user's about/profile info
 * @param {string} username - Reddit username
 * @returns {Promise<object>} User profile data
 */
async function fetchUserProfile(username) {
  const accessToken = await getRedditAccessToken();

  try {
    const response = await axios.get(
      `https://oauth.reddit.com/user/${username}/about`,
      {
        headers: {
          'Authorization': `bearer ${accessToken}`,
          'User-Agent': config.reddit.userAgent,
          'Accept': 'application/json'
        },
        params: { raw_json: 1 }
      }
    );

    const data = response.data?.data;
    if (!data) throw new Error('No profile data returned');

    return {
      username: data.name,
      created_utc: data.created_utc,
      link_karma: data.link_karma || 0,
      comment_karma: data.comment_karma || 0,
      total_karma: (data.link_karma || 0) + (data.comment_karma || 0),
      is_gold: data.is_gold || false,
      icon_img: data.icon_img || null,
      accountAge: Math.floor((Date.now() / 1000 - data.created_utc) / (86400 * 365.25))
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`User "${username}" not found`);
    }
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
}

/**
 * Fetch paginated listing from Reddit (handles after-based pagination)
 * @param {string} endpoint - API endpoint
 * @param {number} maxItems - Maximum items to fetch
 * @returns {Promise<Array>} Array of items
 */
async function fetchPaginatedListing(endpoint, maxItems = 200) {
  const accessToken = await getRedditAccessToken();
  const items = [];
  let after = null;
  const perPage = 100; // Reddit max per request

  while (items.length < maxItems) {
    const params = {
      limit: perPage,
      raw_json: 1,
      sort: 'new'
    };
    if (after) params.after = after;

    try {
      const response = await axios.get(`https://oauth.reddit.com${endpoint}`, {
        headers: {
          'Authorization': `bearer ${accessToken}`,
          'User-Agent': config.reddit.userAgent,
          'Accept': 'application/json'
        },
        params
      });

      const listing = response.data?.data;
      if (!listing || !listing.children || listing.children.length === 0) break;

      items.push(...listing.children.map(c => c.data));

      after = listing.after;
      if (!after) break; // No more pages

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('Rate limited, waiting 2s...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      console.error(`Error fetching ${endpoint}:`, error.message);
      break;
    }
  }

  return items.slice(0, maxItems);
}

/**
 * Fetch all comments for a user
 * @param {string} username - Reddit username
 * @param {number} maxComments - Maximum comments to retrieve
 * @returns {Promise<Array>} Array of comment objects
 */
async function fetchUserComments(username, maxComments = 200) {
  console.log(`Fetching comments for u/${username} (max ${maxComments})...`);

  const rawComments = await fetchPaginatedListing(`/user/${username}/comments`, maxComments);

  const comments = rawComments
    .filter(c => c.body && c.body !== '[deleted]' && c.body !== '[removed]')
    .map(c => ({
      id: c.id,
      subreddit: c.subreddit,
      body: c.body,
      score: c.score || 0,
      created_utc: c.created_utc,
      link_title: c.link_title || '',
      link_id: c.link_id || '',
      permalink: c.permalink || '',
      awards: c.all_awardings ? c.all_awardings.length : 0
    }));

  console.log(`Fetched ${comments.length} valid comments for u/${username}`);
  return comments;
}

/**
 * Fetch all posts/submissions for a user
 * @param {string} username - Reddit username
 * @param {number} maxPosts - Maximum posts to retrieve
 * @returns {Promise<Array>} Array of post objects
 */
async function fetchUserPosts(username, maxPosts = 100) {
  console.log(`Fetching posts for u/${username} (max ${maxPosts})...`);

  const rawPosts = await fetchPaginatedListing(`/user/${username}/submitted`, maxPosts);

  const posts = rawPosts
    .filter(p => p.title)
    .map(p => ({
      id: p.id,
      subreddit: p.subreddit,
      title: p.title,
      selftext: p.selftext || '',
      score: p.score || 0,
      num_comments: p.num_comments || 0,
      created_utc: p.created_utc,
      permalink: p.permalink || '',
      url: p.url || '',
      is_self: p.is_self || false,
      awards: p.all_awardings ? p.all_awardings.length : 0
    }));

  console.log(`Fetched ${posts.length} valid posts for u/${username}`);
  return posts;
}

/**
 * Scrape all user data (profile + comments + posts) and build organized dataset
 * @param {string} usernameOrUrl - Reddit username or profile URL
 * @returns {Promise<object>} Complete user data
 */
async function scrapeUserData(usernameOrUrl) {
  const username = parseUsername(usernameOrUrl);
  console.log(`\n=== SCRAPING USER DATA: u/${username} ===`);

  // Fetch profile, comments, and posts in parallel
  const [profile, comments, posts] = await Promise.all([
    fetchUserProfile(username),
    fetchUserComments(username, 200),
    fetchUserPosts(username, 100)
  ]);

  // Build subreddit activity map
  const subredditMap = {};

  comments.forEach(c => {
    if (!subredditMap[c.subreddit]) {
      subredditMap[c.subreddit] = { comments: [], posts: [] };
    }
    subredditMap[c.subreddit].comments.push(c);
  });

  posts.forEach(p => {
    if (!subredditMap[p.subreddit]) {
      subredditMap[p.subreddit] = { comments: [], posts: [] };
    }
    subredditMap[p.subreddit].posts.push(p);
  });

  // Build subreddit summary sorted by activity
  const subredditActivity = Object.entries(subredditMap)
    .map(([name, data]) => ({
      subreddit: name,
      commentCount: data.comments.length,
      postCount: data.posts.length,
      totalActivity: data.comments.length + data.posts.length,
      avgCommentScore: data.comments.length > 0
        ? Math.round(data.comments.reduce((s, c) => s + c.score, 0) / data.comments.length)
        : 0,
      avgPostScore: data.posts.length > 0
        ? Math.round(data.posts.reduce((s, p) => s + p.score, 0) / data.posts.length)
        : 0
    }))
    .sort((a, b) => b.totalActivity - a.totalActivity);

  // Build timeline data (group by month)
  const allItems = [
    ...comments.map(c => ({ ...c, type: 'comment', date: new Date(c.created_utc * 1000) })),
    ...posts.map(p => ({ ...p, type: 'post', date: new Date(p.created_utc * 1000) }))
  ].sort((a, b) => b.created_utc - a.created_utc);

  const monthlyActivity = {};
  allItems.forEach(item => {
    const key = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyActivity[key]) {
      monthlyActivity[key] = { comments: 0, posts: 0, totalScore: 0 };
    }
    if (item.type === 'comment') {
      monthlyActivity[key].comments++;
    } else {
      monthlyActivity[key].posts++;
    }
    monthlyActivity[key].totalScore += item.score || 0;
  });

  return {
    profile,
    comments,
    posts,
    subredditActivity,
    monthlyActivity,
    stats: {
      totalComments: comments.length,
      totalPosts: posts.length,
      uniqueSubreddits: Object.keys(subredditMap).length,
      totalKarmaFromData: [...comments, ...posts].reduce((s, i) => s + (i.score || 0), 0),
      oldestActivity: allItems.length > 0
        ? new Date(allItems[allItems.length - 1].created_utc * 1000).toISOString()
        : null,
      newestActivity: allItems.length > 0
        ? new Date(allItems[0].created_utc * 1000).toISOString()
        : null
    }
  };
}

module.exports = {
  parseUsername,
  fetchUserProfile,
  fetchUserComments,
  fetchUserPosts,
  scrapeUserData
};
