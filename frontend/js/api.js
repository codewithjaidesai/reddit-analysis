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
 * Generate AI insights from extracted data with optional research context
 */
async function generateInsights(contentData, researchQuestion = null, template = null) {
    return await callAPI(API_CONFIG.endpoints.insights, {
        contentData,
        researchQuestion,
        template
    });
}

/**
 * Full analysis (extract + insights)
 */
async function fullAnalysis(url, researchQuestion = null, template = null) {
    return await callAPI(API_CONFIG.endpoints.full, {
        url,
        researchQuestion,
        template
    });
}

/**
 * Search Reddit by topic with optional research context
 */
async function searchTopic(topic, timeRange, subreddits, limit, template = 'all', researchQuestion = null, customKeywords = '') {
    return await callAPI('/api/search/topic', {
        topic,
        timeRange,
        subreddits,
        limit,
        template,
        researchQuestion,
        customKeywords
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
