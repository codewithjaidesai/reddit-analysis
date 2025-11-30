const axios = require('axios');
const config = require('../config');
const { getRedditAccessToken } = require('./reddit');

/**
 * Search Reddit by topic across all or specific subreddits
 * @param {string} topic - Search query
 * @param {string} timeRange - Time filter (hour, day, week, month, year, all)
 * @param {string} subreddits - Comma-separated subreddit list (optional)
 * @param {number} limit - Number of results (default: 15)
 * @returns {Promise<object>} Search results
 */
async function searchRedditByTopic(topic, timeRange = 'week', subreddits = '', limit = 15) {
  console.log('Searching Reddit for:', topic, 'Time:', timeRange, 'Subreddits:', subreddits, 'Limit:', limit);

  try {
    // Use Reddit's public JSON API (no authentication required)
    let searchUrl = 'https://www.reddit.com/search.json';
    let params = {
      q: topic,
      t: timeRange,
      sort: 'relevance',
      limit: 100, // Get more to filter by engagement
      restrict_sr: false,
      type: 'link',
      raw_json: 1
    };

    // If specific subreddits requested
    if (subreddits && subreddits.trim()) {
      const subredditList = subreddits.split(',').map(s => s.trim()).filter(s => s);
      if (subredditList.length > 0) {
        params.q = `${topic} (subreddit:${subredditList.join(' OR subreddit:')})`;
      }
    }

    console.log('Fetching from Reddit search API...');
    const response = await axios.get(searchUrl, {
      params,
      headers: {
        'User-Agent': config.reddit.userAgent
      }
    });

    if (response.status !== 200) {
      throw new Error(`Reddit search API returned ${response.status}`);
    }

    const data = response.data;
    const posts = data.data.children.map(child => child.data);

    console.log(`Found ${posts.length} raw posts`);

    // Filter and score posts
    const scoredPosts = posts
      .filter(post => {
        return post.score >= 20 &&
               post.num_comments >= 10 &&
               post.upvote_ratio >= 0.7 &&
               !post.is_video &&
               !post.stickied;
      })
      .map(post => {
        const engagementScore = post.score + (post.num_comments * 2);
        const engagementRate = post.subreddit_subscribers > 0
          ? (post.score / post.subreddit_subscribers) * 10000
          : 0;

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
          engagementScore,
          engagementRate: Math.round(engagementRate * 10) / 10,
          engagementTier,
          engagementStars,
          ageText,
          ageHours: postAgeHours
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    console.log(`Found ${scoredPosts.length} high-engagement posts`);

    return {
      success: true,
      query: topic,
      timeRange,
      totalFound: posts.length,
      afterFiltering: scoredPosts.length,
      posts: scoredPosts
    };

  } catch (error) {
    console.error('Search error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to search Reddit: ' + error.message,
      posts: []
    };
  }
}

/**
 * Search top posts from a specific subreddit
 * @param {string} subreddit - Subreddit name (without r/)
 * @param {string} timeRange - Time filter (day, week, month, year)
 * @param {number} limit - Number of results (default: 15)
 * @returns {Promise<object>} Top posts
 */
async function searchSubredditTopPosts(subreddit, timeRange = 'week', limit = 15) {
  console.log('Searching subreddit:', subreddit, 'Time:', timeRange, 'Limit:', limit);

  try {
    const accessToken = await getRedditAccessToken();
    const url = `https://oauth.reddit.com/r/${subreddit}/top`;

    const response = await axios.get(url, {
      params: {
        t: timeRange,
        limit: 100,
        raw_json: 1
      },
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': config.reddit.userAgent
      }
    });

    if (response.status !== 200) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const data = response.data;
    const posts = data.data.children.map(child => child.data);

    console.log(`Found ${posts.length} posts from r/${subreddit}`);

    // Filter and score
    const scoredPosts = posts
      .filter(post => {
        return post.score >= 20 &&
               post.num_comments >= 10 &&
               post.upvote_ratio >= 0.7 &&
               !post.is_video &&
               !post.stickied;
      })
      .map(post => {
        const engagementScore = post.score + (post.num_comments * 2);
        const engagementRate = post.subreddit_subscribers > 0
          ? (post.score / post.subreddit_subscribers) * 10000
          : 0;

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
          engagementScore,
          engagementRate: Math.round(engagementRate * 10) / 10,
          engagementTier,
          engagementStars,
          ageText,
          ageHours: postAgeHours
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    console.log(`Found ${scoredPosts.length} high-engagement posts from r/${subreddit}`);

    return {
      success: true,
      subreddit,
      timeRange,
      totalFound: posts.length,
      afterFiltering: scoredPosts.length,
      posts: scoredPosts
    };

  } catch (error) {
    console.error('Subreddit search error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to search r/' + subreddit + ': ' + error.message,
      posts: []
    };
  }
}

module.exports = {
  searchRedditByTopic,
  searchSubredditTopPosts
};
