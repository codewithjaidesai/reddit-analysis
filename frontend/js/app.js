// Main application logic

// State management
let topicSelectedPosts = new Set();
let subredditSelectedPosts = new Set();
let currentTopicResults = [];
let currentSubredditResults = [];

/**
 * Analyze single URL
 */
async function handleAnalyzeUrl() {
    const url = document.getElementById('redditUrl').value.trim();

    if (!url) {
        showError('Please enter a Reddit URL');
        return;
    }

    if (!url.includes('reddit.com/r/') || !url.includes('/comments/')) {
        showError('Please enter a valid Reddit post URL');
        return;
    }

    // Reset UI
    hideAll();
    setButtonLoading('analyzeBtn', true);
    showStatus('Extracting Reddit data...', 20);

    try {
        // Call the full analysis endpoint
        showStatus('Analyzing comments...', 40);
        const result = await fullAnalysis(url);

        if (!result.success) {
            throw new Error(result.error || 'Analysis failed');
        }

        showStatus('Generating AI insights...', 70);
        await sleep(500);

        showStatus('Complete!', 100);
        await sleep(500);

        // Display results
        hideAll();
        document.getElementById('resultsSection').style.display = 'block';

        if (result.extractedData) {
            // Store extracted data globally for export functions
            window.currentExtractedData = result.extractedData;
            displayExtractedData(result.extractedData);
        }

        if (result.insights && result.insights.aiAnalysis) {
            displayInsights(result.insights.aiAnalysis);
        }

    } catch (error) {
        console.error('Analysis error:', error);
        showError(error.message || 'An unexpected error occurred');
    } finally {
        setButtonLoading('analyzeBtn', false);
    }
}

/**
 * Search by topic
 */
async function handleSearchByTopic() {
    const topic = document.getElementById('topicQuery').value.trim();

    if (!topic) {
        showError('Please enter a topic to search');
        return;
    }

    const timeRange = document.getElementById('topicTimeRange').value;
    const limit = parseInt(document.getElementById('topicLimit').value);

    let subreddits = '';
    if (document.getElementById('topicSubredditFilter').checked) {
        subreddits = document.getElementById('topicSubreddits').value.trim();
    }

    // Reset
    hideAll();
    topicSelectedPosts.clear();
    showStatus('Searching Reddit...', 50);

    try {
        const result = await searchTopic(topic, timeRange, subreddits, limit);

        if (!result.success) {
            throw new Error(result.error || 'Search failed');
        }

        currentTopicResults = result.posts;

        // Display results
        hideAll();
        document.getElementById('topicResults').style.display = 'block';
        document.getElementById('topicResultsTitle').textContent = `Found ${result.afterFiltering} posts for "${topic}"`;
        document.getElementById('topicResultsSummary').textContent =
            `Filtered ${result.afterFiltering} high-engagement posts from ${result.totalFound} total results`;

        displayPostCards(result.posts, 'topicPostsList', topicSelectedPosts, 'toggleTopicPost');
        updateTopicSelectedCount();

    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Search failed');
    }
}

/**
 * Toggle topic post selection
 */
function toggleTopicPost(postId) {
    if (topicSelectedPosts.has(postId)) {
        topicSelectedPosts.delete(postId);
        document.getElementById(`post-${postId}`).classList.remove('selected');
        document.getElementById(`check-${postId}`).checked = false;
    } else {
        topicSelectedPosts.add(postId);
        document.getElementById(`post-${postId}`).classList.add('selected');
        document.getElementById(`check-${postId}`).checked = true;
    }
    updateTopicSelectedCount();
}

/**
 * Update topic selected count
 */
function updateTopicSelectedCount() {
    const count = topicSelectedPosts.size;
    document.getElementById('topicSelectedCount').textContent =
        `${count} post${count !== 1 ? 's' : ''} selected`;

    document.getElementById('topicSelectedActions').style.display =
        count > 0 ? 'block' : 'none';
}

/**
 * Analyze selected topic posts
 */
async function analyzeTopicSelectedPosts() {
    if (topicSelectedPosts.size === 0) {
        showError('Please select at least one post');
        return;
    }

    const selectedUrls = currentTopicResults
        .filter(post => topicSelectedPosts.has(post.id))
        .map(post => post.url);

    await analyzeMultiplePosts(selectedUrls);
}

/**
 * Search subreddit
 */
async function handleSearchSubreddit() {
    const subreddit = document.getElementById('subredditName').value.trim();

    if (!subreddit) {
        showError('Please enter a subreddit name');
        return;
    }

    const timeRange = document.getElementById('subredditTimeRange').value;
    const limit = parseInt(document.getElementById('subredditLimit').value);

    // Reset
    hideAll();
    subredditSelectedPosts.clear();
    showStatus('Getting top posts...', 50);

    try {
        const result = await searchSubreddit(subreddit, timeRange, limit);

        if (!result.success) {
            throw new Error(result.error || 'Search failed');
        }

        currentSubredditResults = result.posts;

        // Display results
        hideAll();
        document.getElementById('subredditResults').style.display = 'block';
        document.getElementById('subredditResultsTitle').textContent =
            `Top Posts from r/${subreddit}`;
        document.getElementById('subredditResultsSummary').textContent =
            `Found ${result.afterFiltering} high-engagement posts from ${result.totalFound} total`;

        displayPostCards(result.posts, 'subredditPostsList', subredditSelectedPosts, 'toggleSubredditPost');
        updateSubredditSelectedCount();

    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Search failed');
    }
}

/**
 * Toggle subreddit post selection
 */
function toggleSubredditPost(postId) {
    if (subredditSelectedPosts.has(postId)) {
        subredditSelectedPosts.delete(postId);
        document.getElementById(`post-${postId}`).classList.remove('selected');
        document.getElementById(`check-${postId}`).checked = false;
    } else {
        subredditSelectedPosts.add(postId);
        document.getElementById(`post-${postId}`).classList.add('selected');
        document.getElementById(`check-${postId}`).checked = true;
    }
    updateSubredditSelectedCount();
}

/**
 * Update subreddit selected count
 */
function updateSubredditSelectedCount() {
    const count = subredditSelectedPosts.size;
    document.getElementById('subredditSelectedCount').textContent =
        `${count} post${count !== 1 ? 's' : ''} selected`;

    document.getElementById('subredditSelectedActions').style.display =
        count > 0 ? 'block' : 'none';
}

/**
 * Analyze selected subreddit posts
 */
async function analyzeSubredditSelectedPosts() {
    if (subredditSelectedPosts.size === 0) {
        showError('Please select at least one post');
        return;
    }

    const selectedUrls = currentSubredditResults
        .filter(post => subredditSelectedPosts.has(post.id))
        .map(post => post.url);

    await analyzeMultiplePosts(selectedUrls);
}

/**
 * Analyze multiple posts
 */
async function analyzeMultiplePosts(urls) {
    hideAll();
    showStatus(`Analyzing ${urls.length} posts...`, 0);

    const results = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const progress = ((i + 1) / urls.length) * 100;

        showStatus(`Analyzing post ${i + 1} of ${urls.length}...`, progress);

        try {
            const result = await fullAnalysis(url);
            results.push({
                url,
                success: result.success,
                data: result
            });
        } catch (error) {
            results.push({
                url,
                success: false,
                error: error.message
            });
        }
    }

    // Display multi-post results
    displayMultiPostResults(results);
}

/**
 * Display multi-post results
 */
// Store multi-post results globally for export
window.multiPostResults = [];

function displayMultiPostResults(results) {
    hideAll();
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('multiPostResults').style.display = 'block';

    // Store results globally
    window.multiPostResults = results;

    const html = results.map((result, index) => {
        if (!result.success) {
            return `
                <div class="result-card" style="background: #fff5f5; border-color: #f56565;">
                    <h3 style="color: #f56565;">Post ${index + 1} - Failed</h3>
                    <p>${result.error || 'Analysis failed'}</p>
                </div>
            `;
        }

        const data = result.data;
        let content = `<div class="result-card">`;

        content += `<h3 style="color: var(--primary); margin-bottom: 20px;">Post ${index + 1}</h3>`;

        if (data.extractedData) {
            const post = data.extractedData.post;
            const stats = data.extractedData.extractionStats;

            content += `
                <div class="data-summary">
                    <h4>${escapeHtml(post.title)}</h4>
                    <div class="meta">
                        <span>r/${post.subreddit}</span> •
                        <span>${formatNumber(post.score)} upvotes</span> •
                        <span>${stats.extracted} high-value comments</span>
                    </div>
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button onclick="exportMultiPostPDF(${index})" style="background: #ed8936; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                            📄 Export PDF
                        </button>
                        <button onclick="copyMultiPostForAI(${index})" style="background: #9f7aea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                            📋 Copy for AI
                        </button>
                        <button onclick="copyMultiPostAsText(${index})" style="background: #48bb78; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                            📝 Copy Text
                        </button>
                    </div>
                </div>
            `;
        }

        if (data.insights && data.insights.aiAnalysis) {
            content += `
                <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">
                        <h3 style="margin: 0; color: #2d3748;">🤖 AI-Powered Insights</h3>
                        <button onclick="exportMultiPostInsightsPDF(${index})" style="background: #ed8936; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                            📄 Export PDF
                        </button>
                    </div>
                    ${formatMarkdown(data.insights.aiAnalysis)}
                </div>
            `;
        }

        content += `</div>`;
        return content;
    }).join('');

    document.getElementById('multiPostResults').innerHTML = html;
}

// Export functions for multi-post results
function exportMultiPostPDF(index) {
    if (window.multiPostResults[index] && window.multiPostResults[index].data.extractedData) {
        window.currentExtractedData = window.multiPostResults[index].data.extractedData;
        exportToPDF();
    }
}

function copyMultiPostForAI(index) {
    if (window.multiPostResults[index] && window.multiPostResults[index].data.extractedData) {
        window.currentExtractedData = window.multiPostResults[index].data.extractedData;
        copyToClipboard();
    }
}

function copyMultiPostAsText(index) {
    if (window.multiPostResults[index] && window.multiPostResults[index].data.extractedData) {
        window.currentExtractedData = window.multiPostResults[index].data.extractedData;
        copyAsText();
    }
}

function exportMultiPostInsightsPDF(index) {
    if (window.multiPostResults[index]) {
        const result = window.multiPostResults[index];
        // Set the current insights and extracted data for export
        if (result.data.insights && result.data.insights.aiAnalysis) {
            window.currentAIInsights = result.data.insights.aiAnalysis;
            if (result.data.extractedData) {
                window.currentExtractedData = result.data.extractedData;
            }
            exportInsightsPDF();
        } else {
            alert('No insights available for this post');
        }
    }
}

// Keyboard shortcuts
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target.id === 'redditUrl') {
        handleAnalyzeUrl();
    }
    if (e.key === 'Enter' && e.target.id === 'topicQuery') {
        handleSearchByTopic();
    }
    if (e.key === 'Enter' && e.target.id === 'subredditName') {
        handleSearchSubreddit();
    }
});
