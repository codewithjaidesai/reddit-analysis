// API calls to backend

/**
 * Call API endpoint
 */
async function callAPI(endpoint, data) {
    const url = API_CONFIG.baseUrl + endpoint;

    console.log('Calling API:', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Extract Reddit data from URL
 */
async function extractRedditData(url) {
    return await callAPI(API_CONFIG.endpoints.extract, { url });
}

/**
 * Generate AI insights from extracted data with role/goal context
 */
async function generateInsights(contentData, role = null, goal = null) {
    return await callAPI(API_CONFIG.endpoints.insights, {
        contentData,
        role,
        goal
    });
}

/**
 * Full analysis (extract + insights)
 */
async function fullAnalysis(url, role = null, goal = null) {
    return await callAPI(API_CONFIG.endpoints.full, {
        url,
        role,
        goal
    });
}

/**
 * Search Reddit by topic with role/goal context
 */
async function searchTopic(topic, timeRange, subreddits, limit, role = null, goal = null, sources = 'both') {
    return await callAPI('/api/search/topic', {
        topic,
        timeRange,
        subreddits,
        limit,
        role,
        goal,
        sources
    });
}

/**
 * Search subreddit top posts
 */
async function searchSubreddit(subreddit, timeRange, limit) {
    return await callAPI('/api/search/subreddit', {
        subreddit,
        timeRange,
        limit
    });
}

/**
 * Combined analysis of multiple posts (one AI call)
 */
async function combinedAnalysis(urls, role = null, goal = null) {
    return await callAPI(API_CONFIG.endpoints.combined, {
        urls,
        role,
        goal
    });
}

/**
 * Re-analyze already-extracted posts with a different role/goal
 */
async function reanalyzePostsData(postsData, role = null, goal = null) {
    return await callAPI(API_CONFIG.endpoints.reanalyze, {
        postsData,
        role,
        goal
    });
}

/**
 * Pre-screen posts for relevance using AI
 */
async function preScreenPosts(posts, topic, role = null, goal = null) {
    return await callAPI(API_CONFIG.endpoints.prescreen, {
        posts,
        topic,
        role,
        goal
    });
}

/**
 * Auto-analyze: batched extraction + map-reduce analysis
 */
async function autoAnalysis(urls, role = null, goal = null) {
    return await callAPI(API_CONFIG.endpoints.auto, {
        urls,
        role,
        goal
    });
}

/**
 * Generate content (articles, threads, etc.) using insights + raw data
 */
async function generateContent(params) {
    return await callAPI(API_CONFIG.endpoints.generate, params);
}

/**
 * Analyze a Reddit user's complete activity
 */
async function analyzeUser(username) {
    return await callAPI(API_CONFIG.endpoints.userAnalysis, { username });
}

/**
 * Get subreddit info for activity detection (Community Pulse)
 */
async function getSubredditInfo(subreddit) {
    return await callAPI('/api/search/subreddit-info', { subreddit });
}

/**
 * Run full Community Pulse analysis
 */
async function analyzeCommunityPulse(subreddit, depth, role, customFocus = null) {
    return await callAPI('/api/analyze/community-pulse', {
        subreddit,
        depth,
        role,
        customFocus
    });
}
