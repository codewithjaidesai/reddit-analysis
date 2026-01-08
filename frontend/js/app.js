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
 * Toggle search method input visibility
 */
function toggleSearchMethod() {
    const selectedMethod = document.querySelector('input[name="searchMethod"]:checked').value;

    // Hide all method-specific inputs
    document.getElementById('subredditMethodInput').style.display = 'none';
    document.getElementById('urlMethodInput').style.display = 'none';

    // Show relevant input based on selection
    if (selectedMethod === 'subreddits') {
        document.getElementById('subredditMethodInput').style.display = 'block';
    } else if (selectedMethod === 'urls') {
        document.getElementById('urlMethodInput').style.display = 'block';
    }
}

/**
 * Search by topic with role/goal context (redesigned)
 */
async function handleSearchByTopic() {
    const researchQuestion = document.getElementById('researchQuestion').value.trim();

    if (!researchQuestion) {
        showError('Please enter what you are researching');
        return;
    }

    const role = document.getElementById('userRole').value.trim();
    const goal = document.getElementById('userGoal').value.trim();
    const searchMethod = document.querySelector('input[name="searchMethod"]:checked').value;
    const timeRange = document.getElementById('topicTimeRange').value;
    const limit = parseInt(document.getElementById('topicLimit').value);

    // Store research context globally for later use
    window.currentResearchContext = {
        researchQuestion,
        role,
        goal
    };

    // Handle different search methods
    if (searchMethod === 'urls') {
        // Direct URL analysis
        const urlsText = document.getElementById('topicUrls').value.trim();
        if (!urlsText) {
            showError('Please enter at least one Reddit post URL');
            return;
        }

        const urls = urlsText.split('\n').map(url => url.trim()).filter(url => url);
        if (urls.length === 0) {
            showError('Please enter valid Reddit post URLs');
            return;
        }

        // Validate URLs
        for (const url of urls) {
            if (!url.includes('reddit.com/r/') || !url.includes('/comments/')) {
                showError(`Invalid Reddit URL: ${url.substring(0, 50)}...`);
                return;
            }
        }

        // Save to recent searches
        saveRecentSearch({
            researchQuestion,
            role,
            goal,
            method: 'urls',
            urlCount: urls.length,
            timestamp: Date.now()
        });

        // Analyze URLs directly
        await analyzeMultiplePosts(urls);
        return;
    }

    // For reddit/subreddit search methods
    let subreddits = '';
    if (searchMethod === 'subreddits') {
        subreddits = document.getElementById('topicSubreddits').value.trim();
        if (!subreddits) {
            showError('Please enter subreddit names');
            return;
        }
    }

    // Save to recent searches
    saveRecentSearch({
        researchQuestion,
        timeRange,
        subreddits,
        limit,
        role,
        goal,
        method: searchMethod,
        timestamp: Date.now()
    });

    // Reset
    hideAll();
    topicSelectedPosts.clear();
    showStatus('Searching Reddit...', 50);

    try {
        // Log search parameters for debugging
        console.log('\n🔍 SEARCH PARAMETERS:');
        console.log('Research Question:', researchQuestion);
        console.log('Time Range:', timeRange);
        console.log('Subreddits:', subreddits || 'All of Reddit');
        console.log('Limit:', limit);
        console.log('Role:', role || 'Not specified');
        console.log('Goal:', goal || 'Not specified');
        console.log('Search Method:', searchMethod);
        console.log('---');

        // Use research question as the search topic
        const result = await searchTopic(researchQuestion, timeRange, subreddits, limit, role, goal);

        // Log search results for debugging
        console.log('\n📊 SEARCH RESULTS:');
        console.log('Success:', result.success);
        console.log('Total found by Reddit:', result.totalFound);
        console.log('After filtering:', result.afterFiltering);
        console.log('Posts returned:', result.posts?.length || 0);
        if (!result.success) {
            console.error('Error:', result.error);
        }
        console.log('---\n');

        // Display backend debug information
        if (result.debug) {
            console.log('\n🔧 BACKEND DEBUG INFO:');
            console.log('═══════════════════════════════════════');
            console.log('Original Query:', result.debug.originalQuery);
            console.log('Formatted Query (after phrase matching):', result.debug.formattedQuery);
            console.log('Final Query (sent to Reddit):', result.debug.finalQuery);
            console.log('');
            console.log('Role:', result.debug.role || 'Not specified');
            console.log('Goal:', result.debug.goal || 'Not specified');
            console.log('');
            console.log('User Specified Subreddits:', result.debug.userSpecifiedSubreddits);
            console.log('Auto-Suggested Subreddits:', result.debug.autoSuggestedSubreddits || 'None');
            console.log('Effective Subreddits:', result.debug.effectiveSubreddits);
            console.log('');
            console.log('Reddit API URL:', result.debug.redditApiUrl);
            console.log('');

            if (result.debug.samplePosts && result.debug.samplePosts.length > 0) {
                console.log('Sample Posts Returned by Reddit:');
                result.debug.samplePosts.forEach((post, i) => {
                    console.log(`  ${i + 1}. r/${post.subreddit} - ${post.title}`);
                    console.log(`     Score: ${post.score}, Comments: ${post.comments}, Ratio: ${post.upvoteRatio}`);
                });
            } else {
                console.log('⚠️  Reddit returned 0 posts');
            }
            console.log('');

            if (result.debug.filterStats) {
                console.log('Filter Statistics:');
                console.log(`  Total posts from Reddit: ${result.debug.filterStats.total}`);
                console.log(`  Passed all filters: ${result.debug.filterStats.passed}`);
                console.log(`  Filter criteria: score ≥ ${result.debug.filterStats.minScore}, comments ≥ ${result.debug.filterStats.minComments}, ratio ≥ ${result.debug.filterStats.minUpvoteRatio}`);
                console.log(`  Filtered out:`);
                console.log(`    - Low score: ${result.debug.filterStats.lowScore}`);
                console.log(`    - Low comments: ${result.debug.filterStats.lowComments}`);
                console.log(`    - Low upvote ratio: ${result.debug.filterStats.lowUpvoteRatio}`);
                console.log(`    - Is video: ${result.debug.filterStats.isVideo}`);
                console.log(`    - Is stickied: ${result.debug.filterStats.isStickied}`);
            }

            if (result.debug.filteredExamples && result.debug.filteredExamples.length > 0) {
                console.log('');
                console.log('⚠️  Examples of Filtered Posts:');
                result.debug.filteredExamples.forEach((post, i) => {
                    console.log(`  ${i + 1}. r/${post.subreddit} - ${post.title}`);
                    console.log(`     Failed: ${post.failedReasons.join(', ')}`);
                });
            }

            console.log('═══════════════════════════════════════\n');
        }

        if (!result.success) {
            throw new Error(result.error || 'Search failed');
        }

        currentTopicResults = result.posts;

        // Display results
        hideAll();
        document.getElementById('topicResults').style.display = 'block';

        let titleText = `Found ${result.afterFiltering} posts`;
        if (role) {
            titleText += ` for ${role}`;
        }
        document.getElementById('topicResultsTitle').textContent = titleText;

        let summaryText = `Filtered ${result.afterFiltering} high-engagement posts from ${result.totalFound} total results`;
        summaryText += ` | Research: "${researchQuestion.substring(0, 80)}${researchQuestion.length > 80 ? '...' : ''}"`;
        if (goal) {
            summaryText += ` | Goal: ${goal.substring(0, 50)}${goal.length > 50 ? '...' : ''}`;
        }
        document.getElementById('topicResultsSummary').textContent = summaryText;

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
 * Analyze multiple posts with research context
 */
async function analyzeMultiplePosts(urls) {
    hideAll();
    showStatus(`Analyzing ${urls.length} posts...`, 0);

    // Get research context if available
    const researchContext = window.currentResearchContext || {};
    const role = researchContext.role || null;
    const goal = researchContext.goal || null;

    const results = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const progress = ((i + 1) / urls.length) * 100;

        showStatus(`Analyzing post ${i + 1} of ${urls.length}...`, progress);

        try {
            const result = await fullAnalysis(url, role, goal);
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

/**
 * Recent Searches Management (localStorage)
 */
function saveRecentSearch(searchData) {
    try {
        const MAX_RECENT = 10;
        let recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');

        // Add new search to beginning
        recents.unshift(searchData);

        // Keep only last MAX_RECENT
        recents = recents.slice(0, MAX_RECENT);

        localStorage.setItem('recentSearches', JSON.stringify(recents));
        updateRecentSearchesDropdown();
    } catch (error) {
        console.error('Error saving recent search:', error);
    }
}

function loadRecentSearch(index) {
    if (!index) return;

    try {
        const recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        const search = recents[index];

        if (search) {
            // Populate form fields
            document.getElementById('researchQuestion').value = search.researchQuestion || '';
            document.getElementById('topicTimeRange').value = search.timeRange || 'week';
            document.getElementById('topicLimit').value = search.limit || 15;
            document.getElementById('userRole').value = search.role || '';
            document.getElementById('userGoal').value = search.goal || '';

            // Restore search method
            const method = search.method || 'reddit';
            const radioButton = document.querySelector(`input[name="searchMethod"][value="${method}"]`);
            if (radioButton) {
                radioButton.checked = true;
                toggleSearchMethod(); // Show appropriate inputs
            }

            // Restore method-specific inputs
            if (search.subreddits) {
                document.getElementById('topicSubreddits').value = search.subreddits;
            }
        }
    } catch (error) {
        console.error('Error loading recent search:', error);
    }
}

function updateRecentSearchesDropdown() {
    try {
        const dropdown = document.getElementById('recentSearches');
        const recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');

        if (recents.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        dropdown.style.display = 'block';
        dropdown.innerHTML = '<option value="">Recent Searches</option>';

        recents.forEach((search, index) => {
            const label = (search.researchQuestion || search.topic || '').substring(0, 40);
            const truncated = label + ((search.researchQuestion || search.topic || '').length > 40 ? '...' : '');
            const roleTag = search.role ? ` [${search.role}]` : '';
            const methodTag = search.method === 'urls' ? ` (${search.urlCount} URLs)` :
                             search.method === 'subreddits' ? ' (subreddits)' : '';
            dropdown.innerHTML += `<option value="${index}">${truncated}${roleTag}${methodTag}</option>`;
        });
    } catch (error) {
        console.error('Error updating recent searches dropdown:', error);
    }
}

// Initialize recent searches dropdown on page load
document.addEventListener('DOMContentLoaded', function() {
    updateRecentSearchesDropdown();
});

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
