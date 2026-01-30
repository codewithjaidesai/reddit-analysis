// Main application logic

// State management
let topicSelectedPosts = new Set();
let subredditSelectedPosts = new Set();
let otherRelevantSelectedPosts = new Set(); // Track selected "other relevant" posts for re-analysis
let currentTopicResults = [];
let currentSubredditResults = [];

// Analysis history state
let analysisHistory = [];
let currentAnalysisIndex = 0;
let extractedPostsData = null; // Store extracted posts for re-analysis

// Re-analyze modal state
let reanalyzeSelectedPersona = null;
let reanalyzeSelectedOutcome = null;

// Content generation state
let generatedContents = []; // Store generated content for the Generated tab
let generateModalSelectedType = null;

// Deliverable types per persona
const personaDeliverables = {
    'Product Manager': [
        { id: 'user_stories', label: 'User Stories', icon: '📋', description: 'Generate user stories in "As a user..." format' },
        { id: 'feature_brief', label: 'Feature Brief', icon: '📄', description: 'One-pager outlining a feature based on user needs' }
    ],
    'Marketer / Copywriter': [
        { id: 'seo_article', label: 'SEO Article', icon: '📝', description: 'Long-form blog post with real quotes' },
        { id: 'ad_copy', label: 'Ad Copy', icon: '📣', description: '3-5 ad copy variations for social/search' },
        { id: 'email_sequence', label: 'Email Sequence', icon: '📧', description: '3-5 email nurture sequence' },
        { id: 'headlines', label: 'Headlines', icon: '🎯', description: '10+ hook/headline variations' }
    ],
    'Content Creator': [
        { id: 'twitter_thread', label: 'Twitter/X Thread', icon: '🐦', description: '5-10 tweet thread with hooks' },
        { id: 'linkedin_post', label: 'LinkedIn Post', icon: '💼', description: 'Professional long-form post' },
        { id: 'youtube_outline', label: 'YouTube Outline', icon: '🎬', description: 'Video script with hook and sections' },
        { id: 'blog_draft', label: 'Blog Draft', icon: '✍️', description: 'Full article with quotes woven in' }
    ],
    'Founder / Entrepreneur': [
        { id: 'pitch_points', label: 'Pitch Talking Points', icon: '🎤', description: 'Problem/solution content for pitch deck' },
        { id: 'problem_solution', label: 'Problem-Solution Brief', icon: '💡', description: 'Structured validation document' }
    ],
    'UX Researcher': [
        { id: 'user_persona', label: 'User Persona', icon: '👤', description: 'Detailed persona based on comment patterns' },
        { id: 'research_synthesis', label: 'Research Synthesis', icon: '🔬', description: 'Themes, quotes, and recommendations' }
    ]
};

/**
 * Toggle collapsible section
 */
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.toggle('collapsed');
    }
}

/**
 * Collapse a section
 */
function collapseSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section && !section.classList.contains('collapsed')) {
        section.classList.add('collapsed');
    }
}

/**
 * Expand a section
 */
function expandSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section && section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
    }
}

/**
 * Update collapsed summary text for input section
 */
function updateInputCollapsedSummary(query, goal) {
    const titleEl = document.getElementById('topicInputCollapsedTitle');
    const subtitleEl = document.getElementById('topicInputCollapsedSubtitle');

    if (titleEl) {
        const truncatedQuery = query.length > 40 ? query.substring(0, 40) + '...' : query;
        titleEl.textContent = `"${truncatedQuery}"`;
    }
    if (subtitleEl) {
        subtitleEl.textContent = goal ? `Goal: ${goal.substring(0, 50)}` : 'Click to edit search';
    }
}

/**
 * Update collapsed summary text for results section
 */
function updateResultsCollapsedSummary(postCount, selectedCount) {
    const titleEl = document.getElementById('topicResultsCollapsedTitle');
    const subtitleEl = document.getElementById('topicResultsCollapsedSubtitle');

    if (titleEl) {
        titleEl.textContent = `${postCount} posts found`;
    }
    if (subtitleEl) {
        subtitleEl.textContent = `${selectedCount} selected for analysis`;
    }
}

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
 * Get current search method (supports both dropdown and radio buttons)
 */
function getSearchMethod() {
    // Try dropdown first (new UI)
    const dropdown = document.getElementById('searchMethodDropdown');
    if (dropdown) {
        return dropdown.value;
    }

    // Fallback to radio buttons (legacy)
    const radio = document.querySelector('input[name="searchMethod"]:checked');
    return radio ? radio.value : 'reddit';
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
    const searchMethod = getSearchMethod();
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

        // Analyze URLs directly with auto-analyze
        await runAutoAnalyze(urls, role, goal, researchQuestion);
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
    resetStatusTimer(); // Reset elapsed time counter

    // Collapse input section immediately
    updateInputCollapsedSummary(researchQuestion, goal);
    collapseSection('topicInputSection');

    try {
        // === STEP 1: Search Reddit ===
        resetStatusTimer();
        showStatus('Searching Reddit...', 10);
        setStatusDetails('Finding discussions matching your research topic');

        console.log('\n=== AUTO-ANALYZE FLOW ===');
        console.log('Research Question:', researchQuestion);
        console.log('Limit:', limit);
        console.log('Role:', role || 'Not specified');
        console.log('Goal:', goal || 'Not specified');

        // Always fetch 100 to have more posts for pre-screening
        const searchLimit = Math.max(limit * 2, 100);
        const result = await searchTopic(researchQuestion, timeRange, subreddits, searchLimit, role, goal);

        if (!result.success) {
            throw new Error(result.error || 'Search failed');
        }

        console.log(`Search returned ${result.posts?.length || 0} posts`);

        if (!result.posts || result.posts.length === 0) {
            throw new Error('No posts found matching your search. Try different keywords or expand the time range.');
        }

        // === STEP 2: Pre-screen for relevance ===
        showStatus(`Found ${result.posts.length} posts`, 20);
        setStatusDetails('AI is scoring each post for relevance to your research question...');

        let postsToAnalyze = result.posts;

        // Track other relevant posts not selected for AI analysis
        let otherRelevantPosts = [];

        // Only pre-screen if we have more posts than the limit
        if (result.posts.length > limit) {
            try {
                const screenResult = await preScreenPosts(result.posts, researchQuestion, role, goal);
                if (screenResult.success && screenResult.posts.length > 0) {
                    postsToAnalyze = screenResult.posts.slice(0, limit);
                    // Keep the remaining relevant posts for display
                    otherRelevantPosts = screenResult.posts.slice(limit);
                    console.log(`Pre-screening: ${screenResult.screenedCount}/${screenResult.originalCount} relevant, taking top ${postsToAnalyze.length}, ${otherRelevantPosts.length} other relevant`);

                    // Update status with screening results
                    showStatus(`Selected ${postsToAnalyze.length} most relevant posts`, 30);
                    setStatusDetails(`${screenResult.screenedCount} posts passed relevance filter, ${otherRelevantPosts.length} additional posts saved`);
                } else {
                    // Pre-screening failed or returned nothing, use engagement-sorted posts
                    postsToAnalyze = result.posts.slice(0, limit);
                    console.log('Pre-screening returned no results, using engagement-sorted posts');
                }
            } catch (screenError) {
                console.log('Pre-screening failed, using engagement-sorted posts:', screenError.message);
                postsToAnalyze = result.posts.slice(0, limit);
            }
        } else {
            postsToAnalyze = result.posts.slice(0, limit);
        }

        // Store all results and the ones being analyzed
        currentTopicResults = postsToAnalyze;
        // Store other relevant posts globally for later access
        window.otherRelevantPosts = otherRelevantPosts;

        // Select all posts for analysis by default
        topicSelectedPosts.clear();
        postsToAnalyze.forEach(post => topicSelectedPosts.add(post.id));

        // Get URLs for analysis
        const urls = postsToAnalyze.map(post => post.url);

        // === STEP 3: Auto-analyze (extraction + single-call analysis) ===
        // Estimate: ~1.5s per post extraction + ~20s for AI analysis
        const estimatedSeconds = Math.round(urls.length * 1.5) + 20;
        setEstimatedTime(estimatedSeconds);
        showStatus(`Extracting comments from ${urls.length} posts...`, 40);
        setStatusDetails('Reading through discussions and extracting valuable insights');

        // Auto-scroll to status section
        document.getElementById('statusSection').scrollIntoView({ behavior: 'smooth', block: 'center' });

        await runAutoAnalyze(urls, role, goal, researchQuestion);

    } catch (error) {
        console.error('Auto-analyze error:', error);
        showError(error.message || 'Analysis failed');
    }
}

/**
 * Run auto-analyze: extraction + map-reduce, then display results with collapsed post list
 */
async function runAutoAnalyze(urls, role, goal, researchQuestion) {
    hideAll();
    showStatus(`Extracting comments from ${urls.length} posts...`, 40);
    setStatusDetails('Reading through discussions and extracting valuable insights');

    // Auto-scroll to status section
    document.getElementById('statusSection').scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Reset analysis history and generated content for fresh results
    analysisHistory = [];
    currentAnalysisIndex = 0;
    extractedPostsData = null;
    generatedContents = [];

    // Simulated progress updates while waiting for API
    const progressUpdates = [
        { delay: 3000, message: `Processing ${urls.length} posts...`, detail: 'Extracting comments from Reddit discussions', progress: 50 },
        { delay: 8000, message: 'Running AI analysis...', detail: 'Identifying patterns and insights across all posts', progress: 60 },
        { delay: 15000, message: 'Synthesizing insights...', detail: 'Connecting themes and generating comprehensive analysis', progress: 75 },
        { delay: 25000, message: 'Finalizing analysis...', detail: 'Preparing your personalized insights report', progress: 85 }
    ];

    const progressTimers = progressUpdates.map(update =>
        setTimeout(() => {
            showStatus(update.message, update.progress);
            setStatusDetails(update.detail);
        }, update.delay)
    );

    try {
        const result = await autoAnalysis(urls, role, goal);

        // Clear progress timers
        progressTimers.forEach(timer => clearTimeout(timer));

        if (!result.success) {
            throw new Error(result.error || 'Auto-analysis failed');
        }

        showStatus('Analysis complete!', 100);

        // Store research context
        window.currentResearchContext = {
            researchQuestion: researchQuestion || '',
            role,
            goal
        };

        // Display results using existing display function (compatible format)
        displayCombinedResults(result, role, goal);

    } catch (error) {
        // Clear progress timers on error
        progressTimers.forEach(timer => clearTimeout(timer));
        console.error('Auto-analyze error:', error);
        showError(error.message || 'Analysis failed');
    }
}

/**
 * Re-analyze with selected posts from both analyzed and other relevant lists
 */
async function reanalyzeSelectedPosts() {
    // Get URLs from selected analyzed posts
    const analyzedUrls = currentTopicResults
        .filter(post => topicSelectedPosts.has(post.id))
        .map(post => post.url);

    // Get URLs from selected other relevant posts
    const otherRelevant = window.otherRelevantPosts || [];
    const selectedOtherIds = new Set(otherRelevantSelectedPosts);
    const selectedOtherPosts = otherRelevant
        .filter((post, idx) => selectedOtherIds.has(String(post.id || idx)));
    const otherUrls = selectedOtherPosts.map(post => post.url);

    const allUrls = [...analyzedUrls, ...otherUrls];

    if (allUrls.length === 0) {
        showError('Please select at least one post to analyze');
        return;
    }

    const researchContext = window.currentResearchContext || {};
    const role = researchContext.role || null;
    const goal = researchContext.goal || null;

    // Show what we're doing
    const newPostsCount = otherUrls.length;
    const totalPosts = allUrls.length;
    console.log(`Re-analyzing ${totalPosts} posts (${analyzedUrls.length} previously analyzed + ${newPostsCount} new)`);

    // Remove selected posts from "other relevant" list since they're being analyzed now
    if (selectedOtherPosts.length > 0) {
        window.otherRelevantPosts = otherRelevant.filter((post, idx) =>
            !selectedOtherIds.has(String(post.id || idx))
        );
    }

    await runAutoAnalyze(allUrls, role, goal, researchContext.researchQuestion);
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
    const countText = `${count} post${count !== 1 ? 's' : ''} selected`;

    document.getElementById('topicSelectedCount').textContent = countText;
    document.getElementById('topicSelectedCountBottom').textContent = countText;

    const showActions = count > 0 ? 'block' : 'none';
    document.getElementById('topicSelectedActions').style.display = showActions;
    document.getElementById('topicSelectedActionsBottom').style.display = showActions;
}

/**
 * Toggle the collapsed posts analyzed section
 */
function togglePostsAnalyzedSection() {
    const section = document.getElementById('postsAnalyzedSection');
    if (section) {
        section.classList.toggle('collapsed');
    }
}

/**
 * Toggle the Other Relevant Posts section
 */
function toggleOtherRelevantSection() {
    const section = document.getElementById('otherRelevantSection');
    if (section) {
        section.classList.toggle('collapsed');
    }
}

/**
 * Toggle a post in the auto-analyzed posts list
 */
function toggleAutoPost(postId) {
    if (topicSelectedPosts.has(postId)) {
        topicSelectedPosts.delete(postId);
    } else {
        topicSelectedPosts.add(postId);
    }

    const item = document.getElementById(`auto-post-${postId}`);
    if (item) {
        item.classList.toggle('selected', topicSelectedPosts.has(postId));
    }

    updateAutoSelectedCount();
}

/**
 * Select all posts in the analyzed list
 */
function selectAllAnalyzedPosts() {
    currentTopicResults.forEach(post => {
        topicSelectedPosts.add(post.id);
        const item = document.getElementById(`auto-post-${post.id}`);
        if (item) {
            item.classList.add('selected');
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = true;
        }
    });
    updateAutoSelectedCount();
}

/**
 * Deselect all posts in the analyzed list
 */
function deselectAllAnalyzedPosts() {
    currentTopicResults.forEach(post => {
        topicSelectedPosts.delete(post.id);
        const item = document.getElementById(`auto-post-${post.id}`);
        if (item) {
            item.classList.remove('selected');
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        }
    });
    updateAutoSelectedCount();
}

/**
 * Update the auto-analyzed posts selected count
 */
function updateAutoSelectedCount() {
    const countEl = document.getElementById('autoSelectedCount');
    if (countEl) {
        countEl.textContent = `${topicSelectedPosts.size} of ${currentTopicResults.length} posts selected`;
    }
}

/**
 * Toggle selection of an "other relevant" post
 */
function toggleOtherRelevantPost(postId, url) {
    const MAX_ADDITIONAL = 25;

    if (otherRelevantSelectedPosts.has(postId)) {
        otherRelevantSelectedPosts.delete(postId);
    } else {
        // Check if we're at the limit
        if (otherRelevantSelectedPosts.size >= MAX_ADDITIONAL) {
            alert(`You can select up to ${MAX_ADDITIONAL} additional posts. Deselect some to add more.`);
            // Uncheck the checkbox
            const item = document.getElementById(`other-post-${postId}`);
            if (item) {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = false;
            }
            return;
        }
        otherRelevantSelectedPosts.add(postId);
    }

    const item = document.getElementById(`other-post-${postId}`);
    if (item) {
        item.classList.toggle('selected', otherRelevantSelectedPosts.has(postId));
    }

    updateOtherRelevantSelectedCount();
}

/**
 * Select first N other relevant posts
 */
function selectAllOtherRelevant(maxCount) {
    const otherRelevant = window.otherRelevantPosts || [];
    otherRelevantSelectedPosts.clear();

    otherRelevant.slice(0, maxCount).forEach((post, idx) => {
        const postId = post.id || idx;
        otherRelevantSelectedPosts.add(String(postId));
        const item = document.getElementById(`other-post-${postId}`);
        if (item) {
            item.classList.add('selected');
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = true;
        }
    });

    // Uncheck any beyond maxCount
    otherRelevant.slice(maxCount).forEach((post, idx) => {
        const postId = post.id || (maxCount + idx);
        const item = document.getElementById(`other-post-${postId}`);
        if (item) {
            item.classList.remove('selected');
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        }
    });

    updateOtherRelevantSelectedCount();
}

/**
 * Deselect all other relevant posts
 */
function deselectAllOtherRelevant() {
    const otherRelevant = window.otherRelevantPosts || [];
    otherRelevantSelectedPosts.clear();

    otherRelevant.forEach((post, idx) => {
        const postId = post.id || idx;
        const item = document.getElementById(`other-post-${postId}`);
        if (item) {
            item.classList.remove('selected');
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        }
    });

    updateOtherRelevantSelectedCount();
}

/**
 * Update the other relevant posts selected count and show/hide re-analyze button
 */
function updateOtherRelevantSelectedCount() {
    const otherRelevant = window.otherRelevantPosts || [];
    const countEl = document.getElementById('otherRelevantSelectedCount');
    if (countEl) {
        countEl.textContent = `${otherRelevantSelectedPosts.size} of ${otherRelevant.length} selected`;
    }

    // Show/hide re-analyze button based on selection
    const reanalyzeBtn = document.getElementById('reanalyzeOtherBtn');
    if (reanalyzeBtn) {
        reanalyzeBtn.style.display = otherRelevantSelectedPosts.size > 0 ? 'inline-block' : 'none';
    }
}

/**
 * Analyze selected topic posts (uses auto-analyze with map-reduce)
 */
async function analyzeTopicSelectedPosts() {
    if (topicSelectedPosts.size === 0) {
        showError('Please select at least one post');
        return;
    }

    const selectedUrls = currentTopicResults
        .filter(post => topicSelectedPosts.has(post.id))
        .map(post => post.url);

    // Collapse results section and update its summary
    updateResultsCollapsedSummary(currentTopicResults.length, topicSelectedPosts.size);
    collapseSection('topicResultsSection');

    const researchContext = window.currentResearchContext || {};
    await runAutoAnalyze(selectedUrls, researchContext.role, researchContext.goal, researchContext.researchQuestion);
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
    const countText = `${count} post${count !== 1 ? 's' : ''} selected`;

    document.getElementById('subredditSelectedCount').textContent = countText;
    document.getElementById('subredditSelectedCountBottom').textContent = countText;

    const showActions = count > 0 ? 'block' : 'none';
    document.getElementById('subredditSelectedActions').style.display = showActions;
    document.getElementById('subredditSelectedActionsBottom').style.display = showActions;
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
async function analyzeMultiplePosts(urls, isReanalyze = false) {
    hideAll();

    // Reset analysis history for new search (not re-analyze)
    if (!isReanalyze) {
        analysisHistory = [];
        currentAnalysisIndex = 0;
        extractedPostsData = null;
    }
    // Always clear generated content for fresh results
    generatedContents = [];

    showStatus(isReanalyze ? 'Re-analyzing with new perspective...' : `Extracting data from ${urls.length} posts...`, 20);

    // Auto-scroll to status section
    document.getElementById('statusSection').scrollIntoView({ behavior: 'smooth', block: 'center' });

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

function displayCombinedResults(result, role, goal, isReanalyze = false, isSwitching = false) {
    hideAll();
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('multiPostResults').style.display = 'block';

    // Store results globally for export functions
    window.combinedResultsData = result;

    const { combinedAnalysis, posts, failures } = result;
    const totalComments = combinedAnalysis.totalComments || 0;
    const subreddits = combinedAnalysis.subreddits || [];

    // Get structured data - could be nested or at top level
    let structured = combinedAnalysis.structured;

    // If structured is null but combinedAnalysis has the expected fields, use it directly
    if (!structured && combinedAnalysis.executiveSummary) {
        structured = combinedAnalysis;
        console.log('Using combinedAnalysis directly as structured data');
    }

    console.log('displayCombinedResults - structured:', structured ? 'exists' : 'null');

    // Log analysis method for debugging
    if (result.meta) {
        console.log(`Analysis method: ${result.meta.analysisMethod} | Chunks: ${result.meta.chunksProcessed} | Model: ${result.meta.reduceModel || result.meta.mapModel || 'standard'}`);
    }

    // Store extracted posts for re-analysis (only on fresh analysis)
    if (!isReanalyze && !isSwitching) {
        extractedPostsData = posts.map(p => p.extractedData);
    }

    // Only modify history if not just switching between existing analyses
    if (!isSwitching) {
        const analysisEntry = {
            id: Date.now(),
            role: role,
            goal: goal,
            result: result,
            timestamp: new Date()
        };

        if (isReanalyze) {
            analysisHistory.push(analysisEntry);
            currentAnalysisIndex = analysisHistory.length - 1;
        } else {
            analysisHistory = [analysisEntry];
            currentAnalysisIndex = 0;
        }
    }

    let html = '';

    // Analysis History Tabs (if more than one analysis)
    if (analysisHistory.length > 1) {
        html += `<div class="analysis-history">
            <div class="analysis-history-tabs">
                ${analysisHistory.map((entry, idx) => `
                    <button class="history-tab ${idx === currentAnalysisIndex ? 'active' : ''}" onclick="switchAnalysis(${idx})">
                        <span class="history-tab-number">${idx + 1}</span>
                        <span>${entry.role || 'Analysis'}: ${(entry.goal || 'Insights').substring(0, 25)}${(entry.goal || '').length > 25 ? '...' : ''}</span>
                    </button>
                `).join('')}
            </div>
        </div>`;
    }

    // Re-analyze bar
    html += `
        <div class="reanalyze-bar">
            <div class="reanalyze-bar-info">
                <span class="reanalyze-bar-label">Current perspective:</span>
                <span class="reanalyze-bar-current">${role || 'Analyst'} — ${(goal || 'Extract insights').substring(0, 40)}${(goal || '').length > 40 ? '...' : ''}</span>
            </div>
            <button class="reanalyze-btn" onclick="openReanalyzeModal()">Re-analyze with different goal</button>
        </div>
    `;

    // Header section
    const elapsedTime = getLastElapsedTime();
    html += `
        <div class="analysis-header">
            <div class="analysis-header-content">
                <h1 class="analysis-title">Insight Analysis</h1>
                <span class="analysis-badge">Based on ${posts.length} sources${elapsedTime ? ` • Completed in ${elapsedTime}` : ''}</span>
            </div>
            <div class="analysis-meta">
                <span>Topic: <strong>${window.currentResearchContext?.researchQuestion || window.currentResearchContext?.topic || 'Reddit Analysis'}</strong></span>
                <span>Goal: <strong>${goal || 'Extract insights'}</strong></span>
            </div>
            <div class="analysis-actions">
                <button onclick="downloadAllRawData()" class="btn-export">Export Comments (PDF)</button>
                <button onclick="exportCombinedSummaryPDF()" class="btn-export primary">Export Insights (PDF)</button>
            </div>
        </div>
    `;

    // Collapsed Posts Analyzed section (shows which posts were analyzed, with checkboxes)
    if (currentTopicResults.length > 0) {
        html += `
            <div class="posts-analyzed-section collapsed" id="postsAnalyzedSection">
                <div class="posts-analyzed-header" onclick="togglePostsAnalyzedSection()">
                    <div class="posts-analyzed-summary">
                        <span class="posts-analyzed-count">${posts.length} posts analyzed</span>
                        <span class="posts-analyzed-hint">Click to view/modify selection</span>
                    </div>
                    <span class="posts-analyzed-toggle">&#9660;</span>
                </div>
                <div class="posts-analyzed-body">
                    <div class="posts-analyzed-actions-bar">
                        <span id="autoSelectedCount">${topicSelectedPosts.size} of ${currentTopicResults.length} posts selected</span>
                        <div>
                            <button class="btn-small" onclick="selectAllAnalyzedPosts()">Select All</button>
                            <button class="btn-small" onclick="deselectAllAnalyzedPosts()">Deselect All</button>
                            <button class="btn-small btn-primary" onclick="reanalyzeSelectedPosts()">Re-analyze Selected</button>
                        </div>
                    </div>
                    <div class="posts-analyzed-list">
                        ${currentTopicResults.map(post => {
                            const isSelected = topicSelectedPosts.has(post.id);
                            return `
                                <div class="post-analyzed-item ${isSelected ? 'selected' : ''}" id="auto-post-${post.id}">
                                    <label class="post-analyzed-label" onclick="event.stopPropagation();">
                                        <input type="checkbox" ${isSelected ? 'checked' : ''}
                                            onchange="toggleAutoPost('${post.id}')">
                                        <div class="post-analyzed-info">
                                            <span class="post-analyzed-title">${escapeHtml(post.title || post.extractedData?.post?.title || 'Untitled')}</span>
                                            <span class="post-analyzed-meta">
                                                r/${post.subreddit || post.extractedData?.post?.subreddit || '?'}
                                                ${post.score ? ` | ${post.score} upvotes` : ''}
                                                ${post.num_comments ? ` | ${post.num_comments} comments` : ''}
                                                ${post.relevanceScore ? ` | Relevance: ${post.relevanceScore}/5` : ''}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Other Relevant Posts section (posts that passed pre-screening but weren't in top N)
    const otherRelevant = window.otherRelevantPosts || [];
    // Clear previous selections for other relevant posts
    otherRelevantSelectedPosts.clear();

    if (otherRelevant.length > 0) {
        const maxAdditional = 25; // Cap at 25 additional posts
        html += `
            <div class="other-relevant-section collapsed" id="otherRelevantSection">
                <div class="other-relevant-header" onclick="toggleOtherRelevantSection()">
                    <div class="other-relevant-summary">
                        <span class="other-relevant-count">${otherRelevant.length} other relevant posts</span>
                        <span class="other-relevant-hint">Select to include in re-analysis (max ${maxAdditional} additional)</span>
                    </div>
                    <span class="other-relevant-toggle">&#9660;</span>
                </div>
                <div class="other-relevant-body">
                    <div class="other-relevant-info">
                        <p>These posts passed the relevance filter but weren't in the top ${posts.length}. Select any to include them in your next analysis.</p>
                    </div>
                    <div class="other-relevant-actions-bar">
                        <span id="otherRelevantSelectedCount">0 of ${otherRelevant.length} selected</span>
                        <div>
                            <button class="btn-small" onclick="selectAllOtherRelevant(${maxAdditional})">Select First ${maxAdditional}</button>
                            <button class="btn-small" onclick="deselectAllOtherRelevant()">Deselect All</button>
                            <button class="btn-small btn-primary" id="reanalyzeOtherBtn" onclick="reanalyzeSelectedPosts()" style="display: none;">Re-analyze with Selection</button>
                        </div>
                    </div>
                    <div class="other-relevant-list">
                        ${otherRelevant.map((post, idx) => `
                            <div class="other-relevant-item" id="other-post-${post.id || idx}">
                                <label class="other-relevant-label" onclick="event.stopPropagation();">
                                    <input type="checkbox" onchange="toggleOtherRelevantPost('${post.id || idx}', '${post.url}')">
                                    <div class="other-relevant-item-info">
                                        <span class="other-relevant-title">${escapeHtml(post.title || 'Untitled')}</span>
                                        <span class="other-relevant-meta">
                                            r/${post.subreddit || '?'}
                                            ${post.score ? ` | ${post.score} upvotes` : ''}
                                            ${post.num_comments ? ` | ${post.num_comments} comments` : ''}
                                            ${post.relevanceScore ? ` | Relevance: ${post.relevanceScore}/5` : ''}
                                        </span>
                                    </div>
                                </label>
                                <a href="${post.url}" target="_blank" class="other-relevant-link" onclick="event.stopPropagation();">↗</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Check if we have structured data
    if (structured) {
        // Analysis Tabs (Qualitative vs Data vs Generated)
        const hasQuantitative = structured.quantitativeInsights;
        const hasGenerated = generatedContents.length > 0;

        // Always show tabs if we have quantitative or generated content
        if (hasQuantitative || hasGenerated) {
            html += `
                <div class="analysis-tabs">
                    <button class="analysis-tab active" onclick="switchAnalysisTab('qualitative')">
                        Qualitative Insights
                    </button>
                    ${hasQuantitative ? `
                    <button class="analysis-tab" onclick="switchAnalysisTab('quantitative')">
                        Data Analysis <span class="analysis-tab-badge">Experimental</span>
                    </button>
                    ` : ''}
                    ${hasGenerated ? `
                    <button class="analysis-tab" onclick="switchAnalysisTab('generated')">
                        Generated <span class="analysis-tab-badge generated-count">${generatedContents.length}</span>
                    </button>
                    ` : ''}
                </div>
            `;
        }

        // QUALITATIVE TAB CONTENT
        html += `<div id="qualitativeTab" class="analysis-tab-content active">`;

        // EXECUTIVE SUMMARY (First)
        if (structured.executiveSummary) {
            html += `
                <div class="analysis-section">
                    <h2 class="section-title">Executive Summary</h2>
                    <div class="summary-card">
                        <p>${escapeHtml(structured.executiveSummary)}</p>
                    </div>
                </div>
            `;
        }

        // FOR YOUR GOAL SECTION
        if (structured.forYourGoal && structured.forYourGoal.length > 0) {
            html += `
                <div class="analysis-section">
                    <h2 class="section-title">For Your Goal: "${goal || 'Insights'}"</h2>
                    <div class="goal-answers">
                        ${structured.forYourGoal.map(item => `
                            <div class="goal-item">
                                <span class="goal-bullet">→</span>
                                <span>${escapeHtml(item)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // GENERATE CONTENT SECTION - Show deliverable buttons based on persona
        const deliverables = personaDeliverables[role] || [];
        if (deliverables.length > 0) {
            html += `
                <div class="analysis-section generate-section">
                    <div class="generate-section-header">
                        <h2 class="section-title">Create Content</h2>
                        <span class="generate-section-hint">Generate deliverables using insights + real quotes</span>
                    </div>
                    <div class="generate-buttons-grid">
                        ${deliverables.map(d => `
                            <button class="generate-btn" onclick="openGenerateModal('${d.id}', '${escapeHtml(d.label)}')">
                                <span class="generate-btn-icon">${d.icon}</span>
                                <span class="generate-btn-label">${escapeHtml(d.label)}</span>
                                <span class="generate-btn-desc">${escapeHtml(d.description)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // KEY INSIGHTS
        if (structured.keyInsights && structured.keyInsights.length > 0) {
            html += `
                <div class="analysis-section">
                    <h2 class="section-title">Key Insights</h2>
                    <div class="insights-grid">
                        ${structured.keyInsights.map(insight => `
                            <div class="insight-card">
                                <div class="insight-header">
                                    <h3 class="insight-title">${escapeHtml(insight.title)}</h3>
                                    <span class="sentiment-badge sentiment-${insight.sentiment || 'neutral'}">${insight.sentiment || 'neutral'}</span>
                                </div>
                                <p class="insight-description">${escapeHtml(insight.description)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // CONFIDENCE
        if (structured.confidence) {
            const subredditCount = subreddits.length;
            const scopeLabel = totalComments > 0
                ? `Based on ${totalComments.toLocaleString()} comments across ${subredditCount} subreddit${subredditCount !== 1 ? 's' : ''}`
                : '';
            html += `
                <div class="analysis-section">
                    <h2 class="section-title">Confidence</h2>
                    <div class="confidence-card confidence-${structured.confidence.level || 'medium'}">
                        <span class="confidence-level">${(structured.confidence.level || 'medium').toUpperCase()}</span>
                        <span class="confidence-reason">${escapeHtml(structured.confidence.reason || '')}</span>
                    </div>
                    ${scopeLabel ? `<p class="confidence-scope">${scopeLabel}</p>` : ''}
                </div>
            `;
        }

        // TOP QUOTES SECTION (in qualitative tab)
        if (structured.topQuotes && structured.topQuotes.length > 0) {
            html += `
                <div class="analysis-section">
                    <h2 class="section-title">Supporting Quotes</h2>
                    <p class="section-subtitle">Direct quotes from Reddit users</p>
                    <div class="quotes-grid">
                        ${structured.topQuotes.map(q => `
                            <div class="quote-card quote-${(q.type || 'insight').toLowerCase()}">
                                <span class="quote-type-badge">${q.type || 'INSIGHT'}</span>
                                <div class="quote-icon">"</div>
                                <p class="quote-text">"${escapeHtml(q.quote)}"</p>
                                <p class="quote-source">— Reddit User (${q.subreddit || 'Unknown'})</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        html += `</div>`; // End qualitative tab

        // QUANTITATIVE TAB CONTENT
        if (hasQuantitative) {
            const quant = structured.quantitativeInsights;
            html += `<div id="quantitativeTab" class="analysis-tab-content">`;

            // Topics Discussed
            if (quant.topicsDiscussed && quant.topicsDiscussed.length > 0) {
                html += `
                    <div class="quant-subsection">
                        <h3 class="quant-subsection-title">Topics Discussed</h3>
                        <div class="topics-grid">
                            ${quant.topicsDiscussed.map(topic => `
                                <div class="topic-card">
                                    <div class="topic-header">
                                        <span class="topic-name">${escapeHtml(topic.topic)}</span>
                                        <span class="topic-count">${topic.mentions}x</span>
                                    </div>
                                    <span class="topic-sentiment ${topic.sentiment || 'neutral'}">${topic.sentiment || 'neutral'}</span>
                                    ${topic.example ? `<p class="topic-example">"${escapeHtml(topic.example)}"</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Sentiment Breakdown
            if (quant.sentimentBreakdown) {
                const sb = quant.sentimentBreakdown;
                html += `
                    <div class="quant-subsection">
                        <h3 class="quant-subsection-title">Sentiment Distribution</h3>
                        <div class="sentiment-breakdown">
                            <div class="sentiment-bar-container">
                                <div class="sentiment-bar-label">Overall tone of the discussion</div>
                                <div class="sentiment-bar">
                                    ${sb.positive > 0 ? `<div class="sentiment-bar-segment positive" style="width: ${sb.positive}%">${sb.positive}%</div>` : ''}
                                    ${sb.neutral > 0 ? `<div class="sentiment-bar-segment neutral" style="width: ${sb.neutral}%">${sb.neutral}%</div>` : ''}
                                    ${sb.negative > 0 ? `<div class="sentiment-bar-segment negative" style="width: ${sb.negative}%">${sb.negative}%</div>` : ''}
                                </div>
                            </div>
                            <div class="sentiment-stats">
                                <div class="sentiment-stat"><span class="sentiment-dot positive"></span> Positive: ${sb.positive || 0}%</div>
                                <div class="sentiment-stat"><span class="sentiment-dot neutral"></span> Neutral: ${sb.neutral || 0}%</div>
                                <div class="sentiment-stat"><span class="sentiment-dot negative"></span> Negative: ${sb.negative || 0}%</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Common Phrases
            if (quant.commonPhrases && quant.commonPhrases.length > 0) {
                html += `
                    <div class="quant-subsection">
                        <h3 class="quant-subsection-title">Frequently Mentioned</h3>
                        <div class="phrases-list">
                            ${quant.commonPhrases.map(phrase => `
                                <div class="phrase-tag">
                                    <span class="phrase-text">${escapeHtml(phrase.phrase)}</span>
                                    <span class="phrase-count">${phrase.count}x</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Data Patterns
            if (quant.dataPatterns && quant.dataPatterns.length > 0) {
                html += `
                    <div class="quant-subsection">
                        <h3 class="quant-subsection-title">Observed Patterns</h3>
                        <div class="patterns-list">
                            ${quant.dataPatterns.map(pattern => `
                                <div class="pattern-item">
                                    <span class="pattern-icon">~</span>
                                    <span class="pattern-text">${escapeHtml(pattern)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Engagement Correlation
            if (quant.engagementCorrelation) {
                html += `
                    <div class="quant-subsection">
                        <h3 class="quant-subsection-title">Engagement Insight</h3>
                        <div class="engagement-insight">
                            <span class="engagement-insight-icon">^</span>
                            <span class="engagement-insight-text">${escapeHtml(quant.engagementCorrelation)}</span>
                        </div>
                    </div>
                `;
            }

            // Evidence Analysis (in Data Analysis tab)
            if (structured.evidenceAnalysis) {
                const evidence = structured.evidenceAnalysis;
                const verdictClass = (evidence.verdict || '').toLowerCase().replace(/\s+/g, '-');

                html += `
                    <div class="quant-subsection evidence-section">
                        <h3 class="quant-subsection-title">Evidence Analysis</h3>

                        <div class="evidence-header">
                            <div class="evidence-claim">
                                <span class="evidence-label">Hypothesis:</span>
                                <span class="evidence-claim-text">${escapeHtml(evidence.primaryClaim || 'N/A')}</span>
                            </div>
                            <div class="evidence-verdict verdict-${verdictClass}">
                                <span class="verdict-label">${escapeHtml(evidence.verdict || 'Unknown')}</span>
                                <span class="evidence-score">${evidence.evidenceScore || 0}% support</span>
                            </div>
                        </div>

                        <div class="evidence-columns">
                            <div class="evidence-column supporting">
                                <h3 class="evidence-column-title">
                                    <span class="evidence-icon">✓</span>
                                    Supporting Evidence
                                    <span class="evidence-count">(${evidence.supporting?.count || 0} comments, ${evidence.supporting?.percentage || 0}%)</span>
                                </h3>
                                ${evidence.supporting?.keyPoints ? `
                                    <ul class="evidence-points">
                                        ${evidence.supporting.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                                    </ul>
                                ` : ''}
                                ${evidence.supporting?.quotes ? `
                                    <div class="evidence-quotes">
                                        ${evidence.supporting.quotes.map(q => `
                                            <div class="evidence-quote">
                                                <span class="quote-text">"${escapeHtml(q.text)}"</span>
                                                <span class="quote-meta">${q.score} pts • r/${escapeHtml(q.subreddit || 'unknown')}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>

                            <div class="evidence-column counter">
                                <h3 class="evidence-column-title">
                                    <span class="evidence-icon">✗</span>
                                    Counter Evidence
                                    <span class="evidence-count">(${evidence.counter?.count || 0} comments, ${evidence.counter?.percentage || 0}%)</span>
                                </h3>
                                ${evidence.counter?.keyPoints ? `
                                    <ul class="evidence-points">
                                        ${evidence.counter.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                                    </ul>
                                ` : ''}
                                ${evidence.counter?.quotes ? `
                                    <div class="evidence-quotes">
                                        ${evidence.counter.quotes.map(q => `
                                            <div class="evidence-quote">
                                                <span class="quote-text">"${escapeHtml(q.text)}"</span>
                                                <span class="quote-meta">${q.score} pts • r/${escapeHtml(q.subreddit || 'unknown')}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        ${evidence.nuances && evidence.nuances.length > 0 ? `
                            <div class="evidence-nuances">
                                <h4>Nuances & Caveats</h4>
                                <ul>
                                    ${evidence.nuances.map(n => `<li>${escapeHtml(n)}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        <div class="evidence-confidence">
                            <span class="confidence-badge confidence-${evidence.confidenceLevel || 'medium'}">${(evidence.confidenceLevel || 'medium').toUpperCase()}</span>
                            <span class="confidence-reason">${escapeHtml(evidence.confidenceReason || '')}</span>
                        </div>

                        ${evidence.totalAnalyzed ? `
                            <p class="evidence-footnote">
                                * Of ${evidence.totalAnalyzed} comments analyzed, ${evidence.relevantCount || 0} were relevant to this hypothesis.
                                ${evidence.notRelevantCount ? `${evidence.notRelevantCount} comments discussed other topics.` : ''}
                            </p>
                        ` : ''}
                    </div>
                `;
            }

            html += `</div>`; // End quantitative tab
        }

        // GENERATED TAB CONTENT
        if (generatedContents.length > 0) {
            html += `<div id="generatedTab" class="analysis-tab-content">`;
            html += `
                <div class="generated-content-list">
                    ${generatedContents.map((content, idx) => `
                        <div class="generated-content-item">
                            <div class="generated-content-header">
                                <div class="generated-content-title">
                                    <span class="generated-content-icon">${content.icon || '📄'}</span>
                                    <h3>${escapeHtml(content.label)}</h3>
                                    <span class="generated-content-time">${new Date(content.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div class="generated-content-actions">
                                    <button onclick="copyGeneratedContent(${idx})" class="btn-small">Copy</button>
                                    <button onclick="exportGeneratedContentPDF(${idx})" class="btn-small btn-primary">Export PDF</button>
                                    <button onclick="deleteGeneratedContent(${idx})" class="btn-small btn-danger">Delete</button>
                                </div>
                            </div>
                            <div class="generated-content-body">
                                <div class="generated-content-text">${formatMarkdown(content.content)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            html += `</div>`; // End generated tab
        }

    } else {
        // FALLBACK: Use markdown rendering
        html += `
            <div class="result-card">
                <div class="ai-analysis-content">
                    ${formatMarkdown(combinedAnalysis.aiAnalysis)}
                </div>
            </div>
        `;
    }

    // Export buttons section
    html += `
        <div class="analysis-section" style="margin-top: 20px;">
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="copyCombinedSummary()" class="btn-secondary">Copy Summary</button>
            </div>
        </div>
    `;

    // Source Posts Section
    html += `
        <div class="result-card" style="margin-top: 20px;">
            <h3 style="color: #f1f5f9; margin-bottom: 15px;">Source Posts (Raw Data)</h3>
            <div class="source-posts-list">
    `;

    posts.forEach((post, index) => {
        const data = post.extractedData;
        const postInfo = data.post;
        const stats = data.extractionStats;

        html += `
            <div class="source-post-item" style="padding: 15px; background: #1c2432; border-radius: 8px; margin-bottom: 10px; border: 1px solid #2d3a4d;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1; min-width: 200px;">
                        <div style="font-weight: 600; color: #f1f5f9; cursor: pointer;" onclick="togglePostDetails(${index})">
                            ► Post ${index + 1}: "${escapeHtml(postInfo.title.substring(0, 60))}${postInfo.title.length > 60 ? '...' : ''}"
                        </div>
                        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
                            r/${postInfo.subreddit} • ${stats.extracted} comments • ${formatNumber(postInfo.score)} upvotes
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="exportSourcePostPDF(${index})" style="background: #ed8936; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            PDF
                        </button>
                        <button onclick="copySourcePostForAI(${index})" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            Copy for AI
                        </button>
                        <button onclick="copySourcePostAsText(${index})" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            Copy Text
                        </button>
                    </div>
                </div>
                <div id="post-details-${index}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #2d3a4d;">
                    <div style="max-height: 300px; overflow-y: auto; font-size: 13px;">
                        ${data.valuableComments.slice(0, 10).map(c => `
                            <div style="padding: 8px; background: #242d3d; border-radius: 4px; margin-bottom: 8px; color: #f1f5f9;">
                                <span style="color: #a78bfa;">[${c.score} pts]</span> ${escapeHtml(c.body.substring(0, 200))}${c.body.length > 200 ? '...' : ''}
                            </div>
                        `).join('')}
                        ${data.valuableComments.length > 10 ? `<p style="color: #94a3b8; text-align: center;">... and ${data.valuableComments.length - 10} more comments</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    // Show failures if any
    if (failures && failures.length > 0) {
        failures.forEach(failure => {
            html += `
                <div style="padding: 10px 15px; background: rgba(239, 68, 68, 0.15); border-radius: 8px; margin-bottom: 10px; color: #fc8181; font-size: 13px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    Failed: ${escapeHtml(failure.url)} - ${failure.error}
                </div>
            `;
        });
    }

    html += `
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #2d3a4d; display: flex; gap: 10px;">
                <button onclick="downloadAllRawData()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    Download All Raw Data
                </button>
                <button onclick="copyAllForAI()" style="background: #8b5cf6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    Copy All for AI
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
    const structured = combinedAnalysis.structured;
    const researchContext = window.currentResearchContext || {};

    // Create a new window for PDF export
    const printWindow = window.open('', '', 'width=900,height=700');

    let insightsHtml = '';

    if (structured) {
        // Format structured data as readable HTML

        // Executive Summary
        if (structured.executiveSummary) {
            insightsHtml += `
                <div class="section executive-summary">
                    <h2>Executive Summary</h2>
                    <p class="summary-text">${escapeHtml(structured.executiveSummary)}</p>
                </div>
            `;
        }

        // Top Quotes
        if (structured.topQuotes && structured.topQuotes.length > 0) {
            insightsHtml += `
                <div class="section">
                    <h2>Key Quotes from Reddit Users</h2>
                    <div class="quotes-list">
                        ${structured.topQuotes.map(q => `
                            <div class="quote-item quote-${(q.type || 'insight').toLowerCase()}">
                                <span class="quote-badge">${q.type || 'INSIGHT'}</span>
                                <blockquote>"${escapeHtml(q.quote)}"</blockquote>
                                <cite>— Reddit User (${q.subreddit || 'Unknown'})</cite>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // For Your Goal
        if (structured.forYourGoal && structured.forYourGoal.length > 0) {
            insightsHtml += `
                <div class="section goal-section">
                    <h2>For Your Goal: "${escapeHtml(researchContext.goal || 'Insights')}"</h2>
                    <ul class="goal-list">
                        ${structured.forYourGoal.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Key Insights
        if (structured.keyInsights && structured.keyInsights.length > 0) {
            insightsHtml += `
                <div class="section">
                    <h2>Key Insights</h2>
                    <div class="insights-list">
                        ${structured.keyInsights.map(insight => `
                            <div class="insight-item">
                                <h3>${escapeHtml(insight.title)} <span class="sentiment ${insight.sentiment || 'neutral'}">${insight.sentiment || 'neutral'}</span></h3>
                                <p>${escapeHtml(insight.description)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Confidence
        if (structured.confidence) {
            insightsHtml += `
                <div class="section confidence-section">
                    <h2>Analysis Confidence</h2>
                    <p><strong>Level:</strong> <span class="confidence-badge ${structured.confidence.level || 'medium'}">${(structured.confidence.level || 'medium').toUpperCase()}</span></p>
                    <p><strong>Reason:</strong> ${escapeHtml(structured.confidence.reason || 'Based on available data')}</p>
                </div>
            `;
        }

        // Quantitative Insights (Data Analysis - Experimental)
        if (structured.quantitativeInsights) {
            const quant = structured.quantitativeInsights;
            insightsHtml += `
                <div class="section quant-section">
                    <h2>Data Analysis <span class="experimental-badge">Experimental</span></h2>
            `;

            // Topics Discussed
            if (quant.topicsDiscussed && quant.topicsDiscussed.length > 0) {
                insightsHtml += `
                    <div class="quant-subsection">
                        <h3>Topics Discussed</h3>
                        <div class="topics-list">
                            ${quant.topicsDiscussed.map(topic => `
                                <div class="topic-item">
                                    <span class="topic-name">${escapeHtml(topic.topic)}</span>
                                    <span class="topic-mentions">${topic.mentions}x mentioned</span>
                                    <span class="topic-sentiment sentiment-${topic.sentiment || 'neutral'}">${topic.sentiment || 'neutral'}</span>
                                    ${topic.example ? `<p class="topic-example">"${escapeHtml(topic.example)}"</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Sentiment Breakdown
            if (quant.sentimentBreakdown) {
                const sb = quant.sentimentBreakdown;
                insightsHtml += `
                    <div class="quant-subsection">
                        <h3>Sentiment Distribution</h3>
                        <div class="sentiment-stats">
                            <span class="sentiment-stat positive">Positive: ${sb.positive || 0}%</span>
                            <span class="sentiment-stat neutral">Neutral: ${sb.neutral || 0}%</span>
                            <span class="sentiment-stat negative">Negative: ${sb.negative || 0}%</span>
                        </div>
                    </div>
                `;
            }

            // Common Phrases
            if (quant.commonPhrases && quant.commonPhrases.length > 0) {
                insightsHtml += `
                    <div class="quant-subsection">
                        <h3>Common Phrases</h3>
                        <div class="phrases-list">
                            ${quant.commonPhrases.map(phrase => `
                                <div class="phrase-item">
                                    <span class="phrase-text">"${escapeHtml(phrase.phrase)}"</span>
                                    <span class="phrase-count">${phrase.count}x</span>
                                    ${phrase.context ? `<span class="phrase-context">— ${escapeHtml(phrase.context)}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Data Patterns
            if (quant.dataPatterns && quant.dataPatterns.length > 0) {
                insightsHtml += `
                    <div class="quant-subsection">
                        <h3>Data Patterns</h3>
                        <ul class="patterns-list">
                            ${quant.dataPatterns.map(pattern => `<li>${escapeHtml(pattern)}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            // Engagement Correlation
            if (quant.engagementCorrelation) {
                insightsHtml += `
                    <div class="quant-subsection">
                        <h3>Engagement Insight</h3>
                        <p class="engagement-insight">${escapeHtml(quant.engagementCorrelation)}</p>
                    </div>
                `;
            }

            insightsHtml += `</div>`;
        }
    } else {
        // Fallback to raw text
        insightsHtml = `<div class="section"><div class="raw-content">${formatMarkdown(combinedAnalysis.aiAnalysis)}</div></div>`;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Insights - Combined Analysis</title>
            <style>
                body {
                    font-family: 'Georgia', 'Times New Roman', serif;
                    line-height: 1.7;
                    max-width: 850px;
                    margin: 0 auto;
                    padding: 30px;
                    color: #2d3748;
                    background: white;
                }
                h1 {
                    color: #1a202c;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 15px;
                    margin-bottom: 10px;
                    font-size: 26px;
                }
                h2 {
                    color: #2d3748;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    font-size: 20px;
                    border-left: 4px solid #667eea;
                    padding-left: 12px;
                }
                h3 {
                    color: #4a5568;
                    font-size: 16px;
                    margin-bottom: 8px;
                }
                .header-meta {
                    background: #f7fafc;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0 30px 0;
                    font-size: 14px;
                    color: #4a5568;
                }
                .header-meta strong { color: #2d3748; }
                .section {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                }
                .executive-summary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 25px;
                    border-radius: 12px;
                    margin: 20px 0;
                }
                .executive-summary h2 {
                    color: white;
                    border-left-color: white;
                    margin-top: 0;
                }
                .executive-summary .summary-text {
                    font-size: 16px;
                    line-height: 1.8;
                }
                .quote-item {
                    border-left: 4px solid #667eea;
                    padding: 15px;
                    margin: 15px 0;
                    background: #f7fafc;
                    page-break-inside: avoid;
                }
                .quote-item.quote-warning { border-left-color: #f6ad55; background: #fffaf0; }
                .quote-item.quote-tip { border-left-color: #48bb78; background: #f0fff4; }
                .quote-item.quote-complaint { border-left-color: #f56565; background: #fff5f5; }
                .quote-badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                    background: #667eea;
                    color: white;
                    margin-bottom: 10px;
                }
                .quote-item.quote-warning .quote-badge { background: #dd6b20; }
                .quote-item.quote-tip .quote-badge { background: #38a169; }
                .quote-item.quote-complaint .quote-badge { background: #e53e3e; }
                blockquote {
                    font-style: italic;
                    margin: 10px 0;
                    font-size: 15px;
                    line-height: 1.6;
                }
                cite {
                    font-size: 13px;
                    color: #718096;
                }
                .goal-section {
                    background: #f0f4ff;
                    padding: 20px;
                    border-radius: 12px;
                    border: 2px solid #667eea;
                }
                .goal-section h2 {
                    margin-top: 0;
                    color: #667eea;
                }
                .goal-list li {
                    margin: 12px 0;
                    font-size: 15px;
                }
                .insight-item {
                    background: #f7fafc;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 12px 0;
                    border: 1px solid #e2e8f0;
                }
                .sentiment {
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    margin-left: 8px;
                }
                .sentiment.positive { background: #c6f6d5; color: #276749; }
                .sentiment.negative { background: #fed7d7; color: #c53030; }
                .sentiment.neutral { background: #e2e8f0; color: #4a5568; }
                .confidence-badge {
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-weight: bold;
                }
                .confidence-badge.high { background: #c6f6d5; color: #276749; }
                .confidence-badge.medium { background: #feebc8; color: #c05621; }
                .confidence-badge.low { background: #fed7d7; color: #c53030; }
                .quant-section {
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                }
                .quant-section h2 {
                    margin-top: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .experimental-badge {
                    font-size: 10px;
                    background: #805ad5;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-weight: normal;
                }
                .quant-subsection {
                    margin: 20px 0;
                    padding-top: 15px;
                    border-top: 1px solid #e2e8f0;
                }
                .quant-subsection:first-child {
                    border-top: none;
                    padding-top: 0;
                }
                .quant-subsection h3 {
                    color: #4a5568;
                    margin-bottom: 12px;
                }
                .topic-item {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: white;
                    border-radius: 6px;
                    margin: 8px 0;
                    border: 1px solid #e2e8f0;
                }
                .topic-name {
                    font-weight: 600;
                    color: #2d3748;
                }
                .topic-mentions {
                    font-size: 12px;
                    color: #718096;
                }
                .topic-sentiment {
                    font-size: 11px;
                    padding: 2px 8px;
                    border-radius: 10px;
                }
                .sentiment-positive, .topic-sentiment.sentiment-positive { background: #c6f6d5; color: #276749; }
                .sentiment-negative, .topic-sentiment.sentiment-negative { background: #fed7d7; color: #c53030; }
                .sentiment-neutral, .topic-sentiment.sentiment-neutral { background: #e2e8f0; color: #4a5568; }
                .sentiment-mixed, .topic-sentiment.sentiment-mixed { background: #feebc8; color: #c05621; }
                .topic-example {
                    width: 100%;
                    font-size: 13px;
                    font-style: italic;
                    color: #718096;
                    margin: 5px 0 0 0;
                }
                .sentiment-stats {
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                .sentiment-stat {
                    padding: 8px 15px;
                    border-radius: 6px;
                    font-weight: 500;
                }
                .sentiment-stat.positive { background: #c6f6d5; color: #276749; }
                .sentiment-stat.neutral { background: #e2e8f0; color: #4a5568; }
                .sentiment-stat.negative { background: #fed7d7; color: #c53030; }
                .phrase-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    background: white;
                    border-radius: 6px;
                    margin: 6px 0;
                    border: 1px solid #e2e8f0;
                }
                .phrase-text {
                    font-weight: 500;
                    color: #2d3748;
                }
                .phrase-count {
                    font-size: 12px;
                    color: #667eea;
                    font-weight: 600;
                }
                .phrase-context {
                    font-size: 12px;
                    color: #718096;
                    font-style: italic;
                }
                .patterns-list {
                    padding-left: 20px;
                }
                .patterns-list li {
                    margin: 8px 0;
                    color: #4a5568;
                }
                .engagement-insight {
                    background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                    color: #4a5568;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    font-size: 12px;
                    color: #a0aec0;
                }
                @media print {
                    body { margin: 0; padding: 20px; }
                    .no-print { display: none !important; }
                    .executive-summary { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <h1>AI-Powered Content Intelligence</h1>

            <div class="header-meta">
                <strong>Analysis of:</strong> Combined Analysis: ${posts.length} posts<br>
                <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
                <strong>Tool:</strong> Reddit Analyzer v2.0
            </div>

            ${insightsHtml}

            <div class="footer">
                Reddit Analyzer v2.0 • AI-Powered Business Intelligence<br>
                Exported: ${new Date().toISOString()}
            </div>

            <div class="no-print" style="position: fixed; top: 20px; right: 20px;">
                <button onclick="window.print()" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    Print / Save as PDF
                </button>
                <button onclick="window.close()" style="padding: 12px 24px; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-left: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    Close
                </button>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

// Copy combined summary to clipboard
function copyCombinedSummary() {
    if (!window.combinedResultsData) return;

    const { combinedAnalysis } = window.combinedResultsData;
    const structured = combinedAnalysis.structured;
    const researchContext = window.currentResearchContext || {};

    let text = '';

    if (structured) {
        // Format structured data as readable text
        text += '═══════════════════════════════════════════════════════════════\n';
        text += 'AI ANALYSIS SUMMARY\n';
        text += '═══════════════════════════════════════════════════════════════\n\n';

        if (structured.executiveSummary) {
            text += 'EXECUTIVE SUMMARY\n';
            text += '─────────────────────\n';
            text += structured.executiveSummary + '\n\n';
        }

        if (structured.topQuotes && structured.topQuotes.length > 0) {
            text += 'KEY QUOTES\n';
            text += '─────────────────────\n';
            structured.topQuotes.forEach((q, i) => {
                text += `[${q.type || 'INSIGHT'}] "${q.quote}"\n`;
                text += `   — Reddit User (${q.subreddit || 'Unknown'})\n\n`;
            });
        }

        if (structured.forYourGoal && structured.forYourGoal.length > 0) {
            text += `FOR YOUR GOAL: "${researchContext.goal || 'Insights'}"\n`;
            text += '─────────────────────\n';
            structured.forYourGoal.forEach((item, i) => {
                text += `• ${item}\n`;
            });
            text += '\n';
        }

        if (structured.keyInsights && structured.keyInsights.length > 0) {
            text += 'KEY INSIGHTS\n';
            text += '─────────────────────\n';
            structured.keyInsights.forEach((insight, i) => {
                text += `${i + 1}. ${insight.title} [${insight.sentiment || 'neutral'}]\n`;
                text += `   ${insight.description}\n\n`;
            });
        }

        if (structured.confidence) {
            text += 'CONFIDENCE\n';
            text += '─────────────────────\n';
            text += `Level: ${(structured.confidence.level || 'medium').toUpperCase()}\n`;
            text += `Reason: ${structured.confidence.reason || 'Based on available data'}\n\n`;
        }

        text += '═══════════════════════════════════════════════════════════════\n';
        text += `Generated: ${new Date().toLocaleString()}\n`;
        text += 'Tool: Reddit Analyzer v2.0\n';
    } else {
        // Fallback to raw text
        text = combinedAnalysis.aiAnalysis;
    }

    navigator.clipboard.writeText(text).then(() => {
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

// Download all raw data as formatted PDF
function downloadAllRawData() {
    if (!window.combinedResultsData) return;

    const { posts } = window.combinedResultsData;
    const researchContext = window.currentResearchContext || {};

    // Create a new window for PDF export
    const printWindow = window.open('', '', 'width=900,height=700');

    let postsHtml = '';

    posts.forEach((p, idx) => {
        const post = p.extractedData.post;
        const comments = p.extractedData.valuableComments;
        const stats = p.extractedData.extractionStats;

        postsHtml += `
            <div class="post-section">
                <h2>Post ${idx + 1}: ${escapeHtml(post.title)}</h2>
                <div class="post-meta">
                    <span><strong>Subreddit:</strong> r/${escapeHtml(post.subreddit)}</span>
                    <span><strong>Author:</strong> u/${escapeHtml(post.author)}</span>
                    <span><strong>Score:</strong> ${formatNumber(post.score)} upvotes</span>
                    <span><strong>Comments:</strong> ${formatNumber(post.num_comments)}</span>
                </div>
                ${post.permalink ? `<p class="post-link"><strong>Source:</strong> <a href="https://reddit.com${post.permalink}" target="_blank">https://reddit.com${post.permalink}</a></p>` : ''}

                <div class="stats-row">
                    <div class="stat-box">
                        <div class="stat-value">${stats.total}</div>
                        <div class="stat-label">Total Comments</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${stats.extracted}</div>
                        <div class="stat-label">Extracted</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${stats.percentageKept}%</div>
                        <div class="stat-label">Retention</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${stats.averageScore}</div>
                        <div class="stat-label">Avg Score</div>
                    </div>
                </div>

                ${post.selftext ? `<div class="post-body"><strong>Post Body:</strong><br>${escapeHtml(post.selftext)}</div>` : ''}

                <h3>High-Value Comments (${comments.length})</h3>
                <div class="comments-list">
                    ${comments.map((c, i) => `
                        <div class="comment">
                            <div class="comment-header">
                                #${i + 1} • u/${escapeHtml(c.author)} • ${c.score} upvotes${c.awards > 0 ? ` • ${c.awards} awards` : ''}
                            </div>
                            <div class="comment-body">${escapeHtml(c.body)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reddit Comments Export - ${posts.length} Posts</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 30px;
                    color: #2d3748;
                    background: white;
                }
                h1 {
                    color: #1a202c;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 15px;
                    margin-bottom: 10px;
                    font-size: 24px;
                }
                h2 {
                    color: #2d3748;
                    font-size: 18px;
                    margin-top: 0;
                    margin-bottom: 10px;
                }
                h3 {
                    color: #4a5568;
                    font-size: 16px;
                    margin-top: 20px;
                    margin-bottom: 10px;
                    border-left: 3px solid #667eea;
                    padding-left: 10px;
                }
                .header-meta {
                    background: #f7fafc;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0 30px 0;
                    font-size: 14px;
                    color: #4a5568;
                }
                .header-meta strong { color: #2d3748; }
                .post-section {
                    background: #f7fafc;
                    padding: 20px;
                    border-radius: 12px;
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                    border: 1px solid #e2e8f0;
                }
                .post-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    font-size: 13px;
                    color: #718096;
                    margin-bottom: 10px;
                }
                .post-link {
                    font-size: 13px;
                    margin: 10px 0;
                }
                .post-link a {
                    color: #667eea;
                    text-decoration: none;
                }
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin: 15px 0;
                }
                .stat-box {
                    background: white;
                    padding: 10px;
                    border-radius: 6px;
                    text-align: center;
                    border: 1px solid #e2e8f0;
                }
                .stat-value {
                    font-size: 20px;
                    font-weight: bold;
                    color: #667eea;
                }
                .stat-label {
                    font-size: 11px;
                    color: #718096;
                }
                .post-body {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 15px 0;
                    font-size: 14px;
                    white-space: pre-wrap;
                    border: 1px solid #e2e8f0;
                }
                .comment {
                    background: white;
                    border-left: 3px solid #667eea;
                    padding: 12px 15px;
                    margin: 10px 0;
                    border-radius: 0 6px 6px 0;
                    page-break-inside: avoid;
                }
                .comment-header {
                    font-size: 12px;
                    color: #667eea;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .comment-body {
                    font-size: 13px;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    font-size: 12px;
                    color: #a0aec0;
                }
                @media print {
                    body { margin: 0; padding: 20px; }
                    .no-print { display: none !important; }
                    .post-section { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <h1>Reddit Comments Export</h1>

            <div class="header-meta">
                <strong>Total Posts:</strong> ${posts.length}<br>
                <strong>Total Comments:</strong> ${posts.reduce((sum, p) => sum + p.extractedData.valuableComments.length, 0)}<br>
                ${researchContext.researchQuestion ? `<strong>Research Topic:</strong> ${escapeHtml(researchContext.researchQuestion)}<br>` : ''}
                <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
                <strong>Tool:</strong> Reddit Analyzer v2.0
            </div>

            ${postsHtml}

            <div class="footer">
                Reddit Analyzer v2.0 • Raw Data Export<br>
                Exported: ${new Date().toISOString()}
            </div>

            <div class="no-print" style="position: fixed; top: 20px; right: 20px;">
                <button onclick="window.print()" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    Print / Save as PDF
                </button>
                <button onclick="window.close()" style="padding: 12px 24px; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-left: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    Close
                </button>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
    updateSavedContentDropdown();
});

// ============================================
// SAVED GENERATED CONTENT (localStorage)
// ============================================

/**
 * Save generated content to localStorage
 */
function saveGeneratedToHistory(content) {
    try {
        const MAX_SAVED = 20;
        let saved = JSON.parse(localStorage.getItem('savedGeneratedContent') || '[]');

        saved.unshift({
            label: content.label,
            type: content.type,
            icon: content.icon,
            content: content.content,
            topic: window.currentResearchContext?.researchQuestion || '',
            role: window.currentResearchContext?.role || '',
            goal: window.currentResearchContext?.goal || '',
            timestamp: new Date().toISOString()
        });

        saved = saved.slice(0, MAX_SAVED);
        localStorage.setItem('savedGeneratedContent', JSON.stringify(saved));
        updateSavedContentDropdown();
    } catch (error) {
        console.error('Error saving generated content:', error);
    }
}

/**
 * Update the saved content dropdown in the header
 */
function updateSavedContentDropdown() {
    try {
        const dropdown = document.getElementById('savedContent');
        if (!dropdown) return;

        const saved = JSON.parse(localStorage.getItem('savedGeneratedContent') || '[]');

        if (saved.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        dropdown.style.display = 'inline-block';
        dropdown.innerHTML = '<option value="">Saved Content (' + saved.length + ')</option>';

        saved.forEach((item, index) => {
            const topic = item.topic ? item.topic.substring(0, 30) : 'Untitled';
            const label = item.label || item.type || 'Content';
            const date = new Date(item.timestamp).toLocaleDateString();
            dropdown.innerHTML += `<option value="${index}">${label} — ${topic}${item.topic?.length > 30 ? '...' : ''} (${date})</option>`;
        });
    } catch (error) {
        console.error('Error updating saved content dropdown:', error);
    }
}

/**
 * Load saved generated content from localStorage
 */
function loadSavedContent(index) {
    if (index === '' || index === undefined) return;

    try {
        const saved = JSON.parse(localStorage.getItem('savedGeneratedContent') || '[]');
        const item = saved[index];

        if (!item) return;

        // Show in a modal-style view
        const viewWindow = window.open('', '', 'width=800,height=600');
        viewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${item.icon || ''} ${item.label || 'Generated Content'}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: #0f1419; color: #f1f5f9; line-height: 1.6; }
                    h1 { color: #a78bfa; font-size: 1.4rem; margin-bottom: 5px; }
                    .meta { color: #94a3b8; font-size: 0.85rem; margin-bottom: 25px; border-bottom: 1px solid #2d3a4d; padding-bottom: 15px; }
                    .content { white-space: pre-wrap; font-size: 0.95rem; }
                    button { background: #8b5cf6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-right: 8px; }
                    button:hover { background: #7c3aed; }
                    .actions { margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <h1>${item.icon || ''} ${item.label || 'Generated Content'}</h1>
                <div class="meta">
                    Topic: ${item.topic || 'N/A'} | Role: ${item.role || 'N/A'} | Goal: ${item.goal || 'N/A'}<br>
                    Generated: ${new Date(item.timestamp).toLocaleString()}
                </div>
                <div class="actions">
                    <button onclick="navigator.clipboard.writeText(document.querySelector('.content').textContent).then(() => alert('Copied!'))">Copy</button>
                    <button onclick="window.print()">Print / Save PDF</button>
                </div>
                <div class="content">${item.content}</div>
            </body>
            </html>
        `);
        viewWindow.document.close();

        // Reset dropdown
        document.getElementById('savedContent').value = '';
    } catch (error) {
        console.error('Error loading saved content:', error);
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

// ============================================
// ANALYSIS TABS (Qualitative vs Data Analysis)
// ============================================

/**
 * Switch between analysis tabs
 */
function switchAnalysisTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.analysis-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    // Update tab content
    document.querySelectorAll('.analysis-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabContent = document.getElementById(tabName + 'Tab');
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

// ============================================
// ANALYSIS HISTORY
// ============================================

/**
 * Switch to a different analysis in history
 */
function switchAnalysis(index) {
    if (index < 0 || index >= analysisHistory.length) return;

    currentAnalysisIndex = index;
    const entry = analysisHistory[index];

    // Update global state
    window.combinedResultsData = entry.result;
    window.currentResearchContext = {
        ...window.currentResearchContext,
        role: entry.role,
        goal: entry.goal
    };

    // Re-render with the selected analysis (isSwitching = true to prevent adding to history)
    displayCombinedResults(entry.result, entry.role, entry.goal, false, true);
}

// ============================================
// RE-ANALYZE MODAL
// ============================================

// Persona outcomes mapping (same as in ui.js)
const reanalyzePersonaOutcomes = {
    product_manager: {
        role: 'Product Manager',
        outcomes: [
            { id: 'pain_points', label: 'Identify Pain Points & Complaints' },
            { id: 'competitor', label: 'Analyze Competitor Weaknesses' },
            { id: 'validate', label: 'Validate a New Feature Idea' },
            { id: 'unmet_needs', label: 'Discover Unmet Needs' },
            { id: 'free_form', label: 'Other (specify your goal)', isCustom: true }
        ]
    },
    marketer: {
        role: 'Marketer / Copywriter',
        outcomes: [
            { id: 'hooks', label: 'Find Attention-Grabbing Hooks' },
            { id: 'language', label: 'Extract Customer Language & Phrases' },
            { id: 'objections', label: 'Identify Common Objections' },
            { id: 'testimonials', label: 'Find Testimonial Patterns' },
            { id: 'free_form', label: 'Other (specify your goal)', isCustom: true }
        ]
    },
    content_creator: {
        role: 'Content Creator',
        outcomes: [
            { id: 'video_ideas', label: 'Generate Video/Content Ideas' },
            { id: 'trending', label: 'Find Trending Topics' },
            { id: 'controversy', label: 'Identify Debate-Worthy Takes' },
            { id: 'questions', label: 'Find Most-Asked Questions' },
            { id: 'free_form', label: 'Other (specify your goal)', isCustom: true }
        ]
    },
    custom: {
        role: 'Custom',
        outcomes: [
            { id: 'custom_goal', label: 'Define your own goal', isCustom: true }
        ]
    }
};

/**
 * Open re-analyze modal
 */
function openReanalyzeModal() {
    // Reset state
    reanalyzeSelectedPersona = null;
    reanalyzeSelectedOutcome = null;

    // Reset UI
    document.querySelectorAll('#reanalyzePersonaCards .persona-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById('reanalyzeOutcomeSection').style.display = 'none';
    document.getElementById('reanalyzeSubmitBtn').disabled = true;

    // Show modal
    document.getElementById('reanalyzeModal').classList.add('show');
}

/**
 * Close re-analyze modal
 */
function closeReanalyzeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('reanalyzeModal').classList.remove('show');
}

/**
 * Select persona in re-analyze modal
 */
function selectReanalyzePersona(persona) {
    reanalyzeSelectedPersona = persona;
    reanalyzeSelectedOutcome = null;

    // Update UI
    document.querySelectorAll('#reanalyzePersonaCards .persona-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.persona === persona);
    });

    // Show outcome options
    const personaData = reanalyzePersonaOutcomes[persona];
    if (personaData) {
        const outcomeSection = document.getElementById('reanalyzeOutcomeSection');
        const outcomeLabel = document.getElementById('reanalyzeOutcomeLabel');
        const outcomeOptions = document.getElementById('reanalyzeOutcomeOptions');

        outcomeLabel.textContent = `SELECT OUTCOME FOR ${personaData.role.toUpperCase()}`;

        let optionsHtml = personaData.outcomes.map(outcome => `
            <div class="outcome-option" data-outcome="${outcome.id}" onclick="selectReanalyzeOutcome('${outcome.id}', '${escapeHtml(outcome.label)}', ${outcome.isCustom || false})">
                <span class="outcome-radio"></span>
                <span class="outcome-label">${outcome.label}</span>
            </div>
        `).join('');

        // Add custom input field (hidden by default)
        optionsHtml += `
            <div id="reanalyzeFreeFormInput" class="free-form-goal-input" style="display: none;">
                <input type="text" id="reanalyzeFreeFormGoal" placeholder="Describe your specific goal..."
                       oninput="updateReanalyzeFreeFormGoal()" />
            </div>
        `;

        outcomeOptions.innerHTML = optionsHtml;
        outcomeSection.style.display = 'block';
    }

    document.getElementById('reanalyzeSubmitBtn').disabled = true;
}

/**
 * Select outcome in re-analyze modal
 */
function selectReanalyzeOutcome(outcomeId, outcomeLabel, isCustom) {
    // Update UI
    document.querySelectorAll('#reanalyzeOutcomeOptions .outcome-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.outcome === outcomeId);
    });

    // Handle custom/free-form input
    const freeFormInput = document.getElementById('reanalyzeFreeFormInput');
    if (isCustom) {
        freeFormInput.style.display = 'block';
        document.getElementById('reanalyzeFreeFormGoal').focus();
        reanalyzeSelectedOutcome = null; // Will be set when user types
        document.getElementById('reanalyzeSubmitBtn').disabled = true;
    } else {
        freeFormInput.style.display = 'none';
        reanalyzeSelectedOutcome = outcomeLabel;
        document.getElementById('reanalyzeSubmitBtn').disabled = false;
    }
}

/**
 * Update free-form goal in re-analyze modal
 */
function updateReanalyzeFreeFormGoal() {
    const input = document.getElementById('reanalyzeFreeFormGoal');
    const value = input.value.trim();

    if (value) {
        reanalyzeSelectedOutcome = value;
        document.getElementById('reanalyzeSubmitBtn').disabled = false;
    } else {
        reanalyzeSelectedOutcome = null;
        document.getElementById('reanalyzeSubmitBtn').disabled = true;
    }
}

/**
 * Submit re-analyze request
 */
async function submitReanalyze() {
    if (!reanalyzeSelectedPersona || !reanalyzeSelectedOutcome) return;
    if (!extractedPostsData || extractedPostsData.length === 0) {
        showError('No data available for re-analysis');
        return;
    }

    // Close modal
    closeReanalyzeModal();

    // Get role and goal
    const personaData = reanalyzePersonaOutcomes[reanalyzeSelectedPersona];
    const role = personaData ? personaData.role : 'Analyst';
    const goal = reanalyzeSelectedOutcome;

    // Update research context
    window.currentResearchContext = {
        ...window.currentResearchContext,
        role: role,
        goal: goal
    };

    // Clear generated content for fresh results
    generatedContents = [];

    // Show loading
    hideAll();
    showStatus('Re-analyzing with new perspective...', 30);

    try {
        // Call the backend with existing extracted data
        showStatus('Generating new analysis...', 60);

        const result = await reanalyzePostsData(extractedPostsData, role, goal);

        if (!result.success) {
            throw new Error(result.error || 'Re-analysis failed');
        }

        showStatus('Complete!', 100);

        // Display with isReanalyze = true to preserve history
        displayCombinedResults(result, role, goal, true);

    } catch (error) {
        console.error('Re-analysis error:', error);
        showError(error.message || 'Re-analysis failed');
    }
}

// ============================================
// CONTENT GENERATION
// ============================================

/**
 * Open the generate content modal
 */
function openGenerateModal(typeId, typeLabel) {
    generateModalSelectedType = typeId;

    // Find the deliverable info
    const role = window.currentResearchContext?.role;
    const deliverables = personaDeliverables[role] || [];
    const deliverable = deliverables.find(d => d.id === typeId);

    // Update modal content
    document.getElementById('generateModalTitle').textContent = `Generate ${typeLabel}`;
    document.getElementById('generateModalDescription').textContent = deliverable?.description || '';
    document.getElementById('generateFocusInput').value = '';

    // Show modal
    document.getElementById('generateModal').classList.add('show');
}

/**
 * Close the generate content modal
 */
function closeGenerateModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('generateModal').classList.remove('show');
    generateModalSelectedType = null;
}

/**
 * Submit content generation request
 */
async function submitGenerate() {
    console.log('submitGenerate called');
    console.log('generateModalSelectedType:', generateModalSelectedType);

    if (!generateModalSelectedType) {
        console.error('No type selected');
        return;
    }

    // Save type BEFORE closing modal (which resets generateModalSelectedType to null)
    const selectedType = generateModalSelectedType;

    const focus = document.getElementById('generateFocusInput').value.trim();
    const tone = document.querySelector('input[name="generateTone"]:checked')?.value || 'conversational';
    const length = document.querySelector('input[name="generateLength"]:checked')?.value || 'medium';

    console.log('Form values:', { focus, tone, length });

    // Get current context
    const role = window.currentResearchContext?.role || 'Analyst';
    const goal = window.currentResearchContext?.goal || '';
    const structured = window.combinedResultsData?.combinedAnalysis?.structured;

    console.log('Context:', { role, goal, hasStructured: !!structured });

    // Find deliverable info
    const deliverables = personaDeliverables[role] || [];
    const deliverable = deliverables.find(d => d.id === selectedType);

    console.log('Deliverable:', deliverable);

    // Close modal
    closeGenerateModal();

    // Show loading
    hideAll();
    showStatus(`Generating ${deliverable?.label || 'content'}...`, 30);

    try {
        showStatus('Crafting content with real insights...', 60);

        console.log('Calling generateContent API...');
        console.log('extractedPostsData:', extractedPostsData ? `${extractedPostsData.length} posts` : 'null');

        // Call the backend
        const result = await generateContent({
            type: selectedType,
            typeLabel: deliverable?.label || 'Content',
            focus: focus,
            tone: tone,
            length: length,
            role: role,
            goal: goal,
            insights: structured,
            postsData: extractedPostsData
        });

        console.log('API result:', result);

        if (!result.success) {
            throw new Error(result.error || 'Generation failed');
        }

        showStatus('Content generated!', 100);

        // Add to generated contents (current session)
        const generatedItem = {
            id: Date.now(),
            type: selectedType,
            label: deliverable?.label || 'Content',
            icon: deliverable?.icon || '📄',
            content: result.content,
            timestamp: new Date(),
            focus: focus,
            tone: tone,
            length: length
        };
        generatedContents.push(generatedItem);

        // Persist to localStorage
        saveGeneratedToHistory(generatedItem);

        // Re-render results to show the Generated tab
        const currentResult = window.combinedResultsData;
        const originalRole = window.currentResearchContext?.role;
        const originalGoal = window.currentResearchContext?.goal;
        displayCombinedResults(currentResult, originalRole, originalGoal, false, true);

        // Switch to Generated tab - find it by onclick attribute
        setTimeout(() => {
            const generatedTabBtn = document.querySelector('.analysis-tab[onclick*="generated"]');
            console.log('Found generated tab button:', generatedTabBtn);
            if (generatedTabBtn) {
                generatedTabBtn.click();
            }
        }, 100);

    } catch (error) {
        console.error('Generation error:', error);
        showError(error.message || 'Content generation failed');
        // Re-show results
        const currentResult = window.combinedResultsData;
        if (currentResult) {
            const originalRole = window.currentResearchContext?.role;
            const originalGoal = window.currentResearchContext?.goal;
            displayCombinedResults(currentResult, originalRole, originalGoal, false, true);
        }
    }
}

/**
 * Copy generated content to clipboard
 */
function copyGeneratedContent(index) {
    if (index < 0 || index >= generatedContents.length) return;

    const content = generatedContents[index];
    navigator.clipboard.writeText(content.content).then(() => {
        alert('Content copied to clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Failed to copy content');
    });
}

/**
 * Export generated content as PDF
 */
function exportGeneratedContentPDF(index) {
    if (index < 0 || index >= generatedContents.length) return;

    const content = generatedContents[index];
    const printWindow = window.open('', '', 'width=900,height=700');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(content.label)} - Generated Content</title>
            <style>
                body {
                    font-family: 'Georgia', 'Times New Roman', serif;
                    line-height: 1.8;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px;
                    color: #2d3748;
                }
                h1 {
                    color: #1a202c;
                    border-bottom: 3px solid #805ad5;
                    padding-bottom: 15px;
                }
                h2, h3 { color: #2d3748; margin-top: 25px; }
                .meta {
                    background: #f7fafc;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    font-size: 14px;
                    color: #4a5568;
                }
                .content {
                    white-space: pre-wrap;
                    font-size: 15px;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    font-size: 12px;
                    color: #a0aec0;
                }
                @media print {
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(content.label)}</h1>
            <div class="meta">
                <strong>Generated:</strong> ${new Date(content.timestamp).toLocaleString()}<br>
                <strong>Tone:</strong> ${content.tone || 'conversational'}<br>
                ${content.focus ? `<strong>Focus:</strong> ${escapeHtml(content.focus)}<br>` : ''}
            </div>
            <div class="content">${formatMarkdown(content.content)}</div>
            <div class="footer">
                Reddit Analyzer - AI Generated Content<br>
                ${new Date().toISOString()}
            </div>
            <div class="no-print" style="position: fixed; top: 20px; right: 20px;">
                <button onclick="window.print()" style="padding: 12px 24px; background: #805ad5; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Print / Save as PDF
                </button>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Delete generated content
 */
function deleteGeneratedContent(index) {
    if (index < 0 || index >= generatedContents.length) return;

    if (!confirm('Delete this generated content?')) return;

    generatedContents.splice(index, 1);

    // Re-render results
    const role = window.currentResearchContext?.role;
    const goal = window.currentResearchContext?.goal;
    const currentResult = window.combinedResultsData;

    if (currentResult) {
        displayCombinedResults(currentResult, role, goal, false, true);
    }
}
