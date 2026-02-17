const axios = require('axios');
const config = require('../config');

/**
 * Extract video ID from various YouTube URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/v/
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null if not found
 */
function extractVideoId(url) {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Check if a URL is a YouTube URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isYouTubeUrl(url) {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

/**
 * Fetch video metadata from YouTube Data API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<object>} Video metadata
 */
async function fetchVideoMetadata(videoId) {
  const apiKey = config.youtube?.apiKey;
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found or is private');
    }

    const video = response.data.items[0];
    return {
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description || '',
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      viewCount: parseInt(video.statistics.viewCount) || 0,
      likeCount: parseInt(video.statistics.likeCount) || 0,
      commentCount: parseInt(video.statistics.commentCount) || 0
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 403) {
        const errorReason = error.response.data?.error?.errors?.[0]?.reason;
        if (errorReason === 'quotaExceeded') {
          throw new Error('YouTube API quota exceeded - try again tomorrow');
        }
        throw new Error('YouTube API access forbidden - check API key');
      } else if (status === 404) {
        throw new Error('Video not found');
      }
    }
    throw new Error(`Failed to fetch video metadata: ${error.message}`);
  }
}

/**
 * Fetch comments for a video with pagination
 * Fetches top-level comments and their replies
 * @param {string} videoId - YouTube video ID
 * @param {object} options - Fetch options
 * @returns {Promise<Array>} Array of comments
 */
async function fetchVideoComments(videoId, options = {}) {
  const apiKey = config.youtube?.apiKey;
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  const maxComments = options.maxComments || config.youtube?.maxComments || 200;
  const includeReplies = options.includeReplies !== false; // Default true
  const maxRepliesPerComment = options.maxRepliesPerComment || config.youtube?.maxRepliesPerComment || 10;

  const comments = [];
  let nextPageToken = null;
  let fetchedCount = 0;

  console.log(`Fetching YouTube comments for video ${videoId} (max: ${maxComments})`);

  try {
    // Fetch comment threads (top-level comments)
    while (fetchedCount < maxComments) {
      const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
      url.searchParams.set('part', 'snippet,replies');
      url.searchParams.set('videoId', videoId);
      url.searchParams.set('maxResults', Math.min(100, maxComments - fetchedCount).toString());
      url.searchParams.set('order', 'relevance'); // Top comments first
      url.searchParams.set('textFormat', 'plainText');
      url.searchParams.set('key', apiKey);

      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      }

      const response = await axios.get(url.toString());

      if (!response.data.items || response.data.items.length === 0) {
        break;
      }

      for (const thread of response.data.items) {
        const topLevelComment = thread.snippet.topLevelComment;
        const snippet = topLevelComment.snippet;

        // Add top-level comment
        comments.push({
          id: topLevelComment.id,
          author: snippet.authorDisplayName,
          authorChannelId: snippet.authorChannelId?.value,
          text: snippet.textDisplay,
          likeCount: snippet.likeCount || 0,
          replyCount: thread.snippet.totalReplyCount || 0,
          publishedAt: snippet.publishedAt,
          updatedAt: snippet.updatedAt,
          isReply: false,
          parentId: null
        });
        fetchedCount++;

        // Add replies if available and enabled
        if (includeReplies && thread.replies && thread.replies.comments) {
          const replies = thread.replies.comments.slice(0, maxRepliesPerComment);
          for (const reply of replies) {
            const replySnippet = reply.snippet;
            comments.push({
              id: reply.id,
              author: replySnippet.authorDisplayName,
              authorChannelId: replySnippet.authorChannelId?.value,
              text: replySnippet.textDisplay,
              likeCount: replySnippet.likeCount || 0,
              replyCount: 0,
              publishedAt: replySnippet.publishedAt,
              updatedAt: replySnippet.updatedAt,
              isReply: true,
              parentId: topLevelComment.id
            });
            fetchedCount++;
          }
        }

        if (fetchedCount >= maxComments) break;
      }

      nextPageToken = response.data.nextPageToken;
      if (!nextPageToken) break;

      // Small delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Fetched ${comments.length} comments (${comments.filter(c => !c.isReply).length} top-level)`);
    return comments;

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorReason = error.response.data?.error?.errors?.[0]?.reason;

      if (status === 403) {
        if (errorReason === 'commentsDisabled') {
          throw new Error('Comments are disabled for this video');
        } else if (errorReason === 'quotaExceeded') {
          throw new Error('YouTube API quota exceeded - try again tomorrow');
        }
        throw new Error('YouTube API access forbidden');
      } else if (status === 404) {
        throw new Error('Video not found');
      }
    }
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }
}

/**
 * Extract high-value comments using quality filtering
 * Similar dual-path approach as Reddit:
 * - Path A: Substance-based (length >= 50, likeCount >= threshold)
 * - Path B: Engagement-based (short but high engagement)
 *
 * @param {Array} comments - All comments from video
 * @param {object} video - Video metadata
 * @returns {object} Filtered comments with stats
 */
function extractValuableComments(comments, video) {
  console.log(`Starting YouTube extraction: ${comments.length} total comments`);

  // Filter out invalid/spam comments
  const validComments = comments.filter(comment => {
    if (!comment.text || !comment.author) return false;

    const text = comment.text.trim();

    // Minimum length
    if (text.length < 10) return false;

    // Filter out common spam patterns
    const spamPatterns = [
      /^first!?$/i,
      /^(sub|subscribe).*(back|me)/i,
      /check.*(my|out).*(channel|video)/i,
      /^\p{Emoji}+$/u, // Emoji-only comments
      /^(nice|cool|great|awesome|wow|lol|lmao)\.?$/i, // Single-word reactions
      /^\d+:\d+/, // Timestamp-only comments
      /who'?s? (here|watching).*(2024|2025|2026)/i // "Who's watching in 202X"
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(text)) return false;
    }

    return true;
  });

  console.log(`Valid comments after filtering: ${validComments.length}`);

  if (validComments.length === 0) {
    return {
      video: {
        id: video.id,
        title: video.title,
        channelTitle: video.channelTitle,
        channelId: video.channelId,
        description: video.description?.substring(0, 500) || '',
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        publishedAt: video.publishedAt
      },
      valuableComments: [],
      extractionStats: {
        total: comments.length,
        valid: 0,
        extracted: 0,
        percentageKept: 0,
        averageLikes: 0
      }
    };
  }

  // Calculate dynamic thresholds based on comment data
  const likeCounts = validComments.map(c => c.likeCount).sort((a, b) => b - a);
  const topLikes = likeCounts[0];
  const medianLikes = likeCounts[Math.floor(likeCounts.length / 2)];

  // Helper functions
  const getMedian = (arr) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const getPercentile = (arr, p) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  // Calculate engagement stats for dynamic thresholds
  const replyCounts = validComments.filter(c => !c.isReply).map(c => c.replyCount);
  const medianReplies = getMedian(replyCounts);

  // Dynamic thresholds (adapted for YouTube engagement patterns)
  const thresholds = {
    // Base like threshold - YouTube engagement is typically lower than Reddit
    likes: Math.max(Math.floor(medianLikes * 0.5), 1),

    // High likes for short comments (Path B) - 75th percentile
    highLikes: Math.max(getPercentile(likeCounts, 75), 5),

    // Reply count to be considered "discussion-sparking"
    replies: Math.max(Math.ceil(medianReplies * 1.5), 2)
  };

  console.log(`Quality thresholds: likes=${thresholds.likes}, highLikes=${thresholds.highLikes}, replies=${thresholds.replies}`);
  console.log(`Video stats: topLikes=${topLikes}, medianLikes=${medianLikes}`);

  // Dual-path quality filter
  const valuableComments = validComments
    .filter(comment => {
      const textLength = comment.text.length;

      // Path A: Substance-based
      // Comments with good length and like threshold
      if (textLength >= 50 && comment.likeCount >= thresholds.likes) {
        return true;
      }

      // Path B: Engagement-based
      // Short comments (20-49 chars) that are highly engaged
      if (textLength >= 20 && textLength < 50) {
        const hasEngagement =
          comment.replyCount >= thresholds.replies ||
          comment.likeCount >= thresholds.highLikes;

        if (hasEngagement) {
          return true;
        }
      }

      // Also include replies with good engagement (they provide conversation context)
      if (comment.isReply && comment.likeCount >= thresholds.highLikes) {
        return true;
      }

      return false;
    })
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 150); // Safety cap

  const avgLikes = valuableComments.length > 0
    ? Math.round(valuableComments.reduce((sum, c) => sum + c.likeCount, 0) / valuableComments.length)
    : 0;

  const percentageKept = validComments.length > 0
    ? Math.round((valuableComments.length / validComments.length) * 100)
    : 0;

  console.log(`Extracted ${valuableComments.length} valuable comments (${percentageKept}% of valid)`);

  // Transform to unified comment format for analysis
  const formattedComments = valuableComments.map(c => ({
    id: c.id,
    author: c.author,
    body: c.text, // Use 'body' to match Reddit format for analysis
    score: c.likeCount, // Use 'score' to match Reddit format
    created_utc: new Date(c.publishedAt).getTime() / 1000,
    replyCount: c.replyCount,
    isReply: c.isReply,
    parentId: c.parentId
  }));

  return {
    video: {
      id: video.id,
      title: video.title,
      channelTitle: video.channelTitle,
      channelId: video.channelId,
      description: video.description?.substring(0, 500) || '',
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      publishedAt: video.publishedAt
    },
    valuableComments: formattedComments,
    extractionStats: {
      total: comments.length,
      valid: validComments.length,
      extracted: valuableComments.length,
      percentageKept: percentageKept,
      averageLikes: avgLikes
    }
  };
}

/**
 * Main function to extract YouTube data from URL
 * @param {string} url - YouTube video URL
 * @returns {Promise<object>} Extracted data
 */
async function extractYouTubeData(url) {
  try {
    // Check if YouTube is enabled
    if (!config.youtube?.enabled) {
      return {
        success: false,
        error: 'YouTube integration is disabled'
      };
    }

    console.log('Extracting YouTube data from:', url);

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return {
        success: false,
        error: 'Invalid YouTube URL - could not extract video ID'
      };
    }

    console.log('Video ID:', videoId);

    // Fetch video metadata
    const video = await fetchVideoMetadata(videoId);
    console.log('Video:', video.title, 'by', video.channelTitle);

    // Check if video has comments
    if (video.commentCount === 0) {
      return {
        success: true,
        data: {
          source: 'youtube',
          video: video,
          valuableComments: [],
          extractionStats: {
            total: 0,
            valid: 0,
            extracted: 0,
            percentageKept: 0,
            averageLikes: 0
          }
        }
      };
    }

    // Fetch comments
    const comments = await fetchVideoComments(videoId, {
      maxComments: config.youtube?.maxComments || 200,
      includeReplies: true,
      maxRepliesPerComment: config.youtube?.maxRepliesPerComment || 10
    });

    // Extract valuable content
    const extractedData = extractValuableComments(comments, video);

    return {
      success: true,
      data: {
        source: 'youtube',
        ...extractedData
      }
    };
  } catch (error) {
    console.error('YouTube extraction error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search YouTube videos by query
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object>} Search results
 */
async function searchVideos(query, options = {}) {
  const apiKey = config.youtube?.apiKey;
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  if (!config.youtube?.enabled) {
    throw new Error('YouTube integration is disabled');
  }

  const maxResults = Math.min(options.maxResults || 10, 25); // Cap at 25 to save quota
  const publishedAfter = options.publishedAfter; // ISO 8601 date string

  console.log(`Searching YouTube for: "${query}" (max: ${maxResults})`);

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('safeSearch', 'none');
    url.searchParams.set('key', apiKey);

    if (publishedAfter) {
      url.searchParams.set('publishedAfter', publishedAfter);
    }

    const response = await axios.get(url.toString());

    if (!response.data.items) {
      return { success: true, videos: [], totalResults: 0 };
    }

    // Get video IDs for fetching statistics
    const videoIds = response.data.items.map(item => item.id.videoId).join(',');

    // Fetch statistics for all videos in one call
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`;
    const statsResponse = await axios.get(statsUrl);

    const statsMap = {};
    for (const item of statsResponse.data.items || []) {
      statsMap[item.id] = item.statistics;
    }

    // Combine search results with statistics
    const videos = response.data.items.map(item => {
      const stats = statsMap[item.id.videoId] || {};
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url,
        viewCount: parseInt(stats.viewCount) || 0,
        likeCount: parseInt(stats.likeCount) || 0,
        commentCount: parseInt(stats.commentCount) || 0,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      };
    });

    // Filter out videos with no comments (can't analyze them)
    const videosWithComments = videos.filter(v => v.commentCount > 0);

    console.log(`Found ${videos.length} videos, ${videosWithComments.length} with comments enabled`);

    return {
      success: true,
      videos: videosWithComments,
      totalResults: response.data.pageInfo?.totalResults || videos.length,
      query: query
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorReason = error.response.data?.error?.errors?.[0]?.reason;

      if (status === 403 && errorReason === 'quotaExceeded') {
        throw new Error('YouTube API quota exceeded - try again tomorrow');
      }
    }
    throw new Error(`YouTube search failed: ${error.message}`);
  }
}

module.exports = {
  extractVideoId,
  isYouTubeUrl,
  fetchVideoMetadata,
  fetchVideoComments,
  extractValuableComments,
  extractYouTubeData,
  searchVideos
};
