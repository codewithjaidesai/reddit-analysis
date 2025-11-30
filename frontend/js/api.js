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
 * Generate AI insights from extracted data
 */
async function generateInsights(contentData) {
    return await callAPI(API_CONFIG.endpoints.insights, { contentData });
}

/**
 * Full analysis (extract + insights)
 */
async function fullAnalysis(url) {
    return await callAPI(API_CONFIG.endpoints.full, { url });
}

/**
 * Search Reddit by topic
 */
async function searchTopic(topic, timeRange, subreddits, limit) {
    return await callAPI('/api/search/topic', {
        topic,
        timeRange,
        subreddits,
        limit
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
