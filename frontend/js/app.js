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
    const role = document.getElementById('urlUserRole').value.trim();
    const goal = document.getElementById('urlUserGoal').value.trim();

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
        // Call the full analysis endpoint with role/goal
        showStatus('Analyzing comments...', 40);
        const result = await fullAnalysis(url, role, goal);

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

    // Set research context from subreddit tab
    const role = document.getElementById('subredditUserRole').value.trim();
    const goal = document.getElementById('subredditUserGoal').value.trim();
    window.currentResearchContext = { role, goal };

    const selectedUrls = currentSubredditResults
        .filter(post => subredditSelectedPosts.has(post.id))
        .map(post => post.url);

    await analyzeMultiplePosts(selectedUrls);
}

/**
 * Analyze multiple posts with combined analysis (single AI call)
 */
async function analyzeMultiplePosts(urls) {
    hideAll();
    showStatus(`Extracting data from ${urls.length} posts...`, 20);

    // Get research context if available
    const researchContext = window.currentResearchContext || {};
    const role = researchContext.role || null;
    const goal = researchContext.goal || null;

    try {
        showStatus(`Generating combined analysis...`, 60);
        const result = await combinedAnalysis(urls, role, goal);

        if (!result.success) {
            throw new Error(result.error || 'Combined analysis failed');
        }

        showStatus(`Analysis complete!`, 100);
        displayCombinedResults(result, role, goal);
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Display combined analysis results
 */
// Store combined results globally for export
window.combinedResultsData = null;

function displayCombinedResults(result, role, goal) {
    hideAll();
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('multiPostResults').style.display = 'block';

    // Store results globally for export functions
    window.combinedResultsData = result;

    const { combinedAnalysis, posts, failures } = result;
    const totalComments = combinedAnalysis.totalComments || 0;
    const subreddits = combinedAnalysis.subreddits || [];

    let html = '';

    // Combined Analysis Card
    html += `
        <div class="result-card">
            <div class="card-header" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="margin: 0; color: var(--primary);">🔄 Combined Analysis</h2>
                        <p style="margin: 5px 0 0 0; color: #718096; font-size: 14px;">
                            ${posts.length} posts • ${totalComments} comments • ${subreddits.map(s => 'r/' + s).join(', ')}
                        </p>
                    </div>
                </div>
            </div>
            <div class="ai-analysis-content">
                ${formatMarkdown(combinedAnalysis.aiAnalysis)}
            </div>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
                <button onclick="exportCombinedSummaryPDF()" style="background: #ed8936; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    📄 Export Summary PDF
                </button>
                <button onclick="copyCombinedSummary()" style="background: #9f7aea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    📋 Copy Summary
                </button>
            </div>
        </div>
    `;

    // Source Posts Section
    html += `
        <div class="result-card" style="margin-top: 20px;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">📖 Source Posts (Raw Data)</h3>
            <div class="source-posts-list">
    `;

    posts.forEach((post, index) => {
        const data = post.extractedData;
        const postInfo = data.post;
        const stats = data.extractionStats;

        html += `
            <div class="source-post-item" style="padding: 15px; background: #f7fafc; border-radius: 8px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1; min-width: 200px;">
                        <div style="font-weight: 600; color: #2d3748; cursor: pointer;" onclick="togglePostDetails(${index})">
                            ► Post ${index + 1}: "${escapeHtml(postInfo.title.substring(0, 60))}${postInfo.title.length > 60 ? '...' : ''}"
                        </div>
                        <div style="font-size: 13px; color: #718096; margin-top: 4px;">
                            r/${postInfo.subreddit} • ${stats.extracted} comments • ${formatNumber(postInfo.score)} upvotes
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="exportSourcePostPDF(${index})" style="background: #ed8936; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            📄 PDF
                        </button>
                        <button onclick="copySourcePostForAI(${index})" style="background: #9f7aea; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            📋 Copy for AI
                        </button>
                        <button onclick="copySourcePostAsText(${index})" style="background: #48bb78; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            📝 Copy Text
                        </button>
                    </div>
                </div>
                <div id="post-details-${index}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <div style="max-height: 300px; overflow-y: auto; font-size: 13px;">
                        ${data.valuableComments.slice(0, 10).map(c => `
                            <div style="padding: 8px; background: white; border-radius: 4px; margin-bottom: 8px;">
                                <span style="color: #718096;">[${c.score} pts]</span> ${escapeHtml(c.body.substring(0, 200))}${c.body.length > 200 ? '...' : ''}
                            </div>
                        `).join('')}
                        ${data.valuableComments.length > 10 ? `<p style="color: #718096; text-align: center;">... and ${data.valuableComments.length - 10} more comments</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    // Show failures if any
    if (failures && failures.length > 0) {
        failures.forEach(failure => {
            html += `
                <div style="padding: 10px 15px; background: #fff5f5; border-radius: 8px; margin-bottom: 10px; color: #c53030; font-size: 13px;">
                    ⚠️ Failed: ${escapeHtml(failure.url)} - ${failure.error}
                </div>
            `;
        });
    }

    html += `
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
                <button onclick="downloadAllRawData()" style="background: #3182ce; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    📦 Download All Raw Data
                </button>
                <button onclick="copyAllForAI()" style="background: #9f7aea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    📋 Copy All for AI
                </button>
            </div>
        </div>
    `;

    document.getElementById('multiPostResults').innerHTML = html;
}

// Toggle post details visibility
function togglePostDetails(index) {
    const details = document.getElementById(`post-details-${index}`);
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';

    // Update arrow indicator
    const parent = details.parentElement;
    const header = parent.querySelector('div[onclick]');
    if (header) {
        header.innerHTML = header.innerHTML.replace(isVisible ? '▼' : '►', isVisible ? '►' : '▼');
    }
}

// Export functions for combined results

// Export combined summary as PDF
function exportCombinedSummaryPDF() {
    if (!window.combinedResultsData) return;

    const { combinedAnalysis, posts } = window.combinedResultsData;

    // Create a temporary data structure for PDF export
    window.currentAIInsights = combinedAnalysis.aiAnalysis;
    window.currentExtractedData = {
        post: {
            title: `Combined Analysis: ${posts.length} posts`,
            subreddit: combinedAnalysis.subreddits.join(', '),
            score: posts.reduce((sum, p) => sum + (p.extractedData.post.score || 0), 0)
        },
        extractionStats: {
            extracted: combinedAnalysis.totalComments
        }
    };

    exportInsightsPDF();
}

// Copy combined summary to clipboard
function copyCombinedSummary() {
    if (!window.combinedResultsData) return;

    const { combinedAnalysis } = window.combinedResultsData;
    navigator.clipboard.writeText(combinedAnalysis.aiAnalysis).then(() => {
        alert('Combined summary copied to clipboard!');
    });
}

// Export individual source post as PDF
function exportSourcePostPDF(index) {
    if (!window.combinedResultsData) return;

    const post = window.combinedResultsData.posts[index];
    if (post && post.extractedData) {
        window.currentExtractedData = post.extractedData;
        exportToPDF();
    }
}

// Copy individual source post for AI
function copySourcePostForAI(index) {
    if (!window.combinedResultsData) return;

    const post = window.combinedResultsData.posts[index];
    if (post && post.extractedData) {
        window.currentExtractedData = post.extractedData;
        copyToClipboard();
    }
}

// Copy individual source post as text
function copySourcePostAsText(index) {
    if (!window.combinedResultsData) return;

    const post = window.combinedResultsData.posts[index];
    if (post && post.extractedData) {
        window.currentExtractedData = post.extractedData;
        copyAsText();
    }
}

// Download all raw data as JSON
function downloadAllRawData() {
    if (!window.combinedResultsData) return;

    const { posts } = window.combinedResultsData;

    const allData = posts.map(p => ({
        url: p.url,
        post: p.extractedData.post,
        comments: p.extractedData.valuableComments,
        stats: p.extractedData.extractionStats
    }));

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reddit-analysis-${posts.length}-posts.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Copy all posts' raw data for AI
function copyAllForAI() {
    if (!window.combinedResultsData) return;

    const { posts } = window.combinedResultsData;

    let text = '';
    posts.forEach((p, idx) => {
        const post = p.extractedData.post;
        const comments = p.extractedData.valuableComments;

        text += `\n${'='.repeat(50)}\n`;
        text += `POST ${idx + 1}: ${post.title}\n`;
        text += `r/${post.subreddit} | ${post.score} upvotes\n`;
        text += `${'='.repeat(50)}\n\n`;

        if (post.selftext) {
            text += `${post.selftext}\n\n`;
        }

        text += `--- COMMENTS (${comments.length}) ---\n\n`;
        comments.forEach(c => {
            text += `[${c.score} pts] ${c.body}\n\n`;
        });
    });

    navigator.clipboard.writeText(text).then(() => {
        alert(`All ${posts.length} posts copied to clipboard!`);
    });
}

// Legacy function - keep for backwards compatibility
function exportMultiPostInsightsPDF(index) {
    if (window.combinedResultsData) {
        exportSourcePostPDF(index);
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
