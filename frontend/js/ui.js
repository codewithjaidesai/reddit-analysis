// UI manipulation functions

/**
 * Switch tabs
 */
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });

    // Remove active from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.style.display = 'block';
    }

    // Activate button
    event.target.classList.add('active');

    // Hide results and status
    hideAll();
}

/**
 * Toggle topic subreddit filter input
 */
function toggleTopicSubredditInput() {
    const checkbox = document.getElementById('topicSubredditFilter');
    const div = document.getElementById('topicSubredditInputDiv');
    div.style.display = checkbox.checked ? 'block' : 'none';
}

/**
 * Show status message
 */
function showStatus(message, progress) {
    hideAll();
    document.getElementById('statusText').textContent = message;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('statusSection').style.display = 'block';
}

/**
 * Show error message
 */
function showError(message) {
    hideAll();
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorSection').style.display = 'block';
}

/**
 * Hide all sections
 */
function hideAll() {
    document.getElementById('statusSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('extractedDataCard').style.display = 'none';
    document.getElementById('insightsCard').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('multiPostResults').style.display = 'none';
}

/**
 * Set button loading state
 */
function setButtonLoading(buttonId, loading) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.disabled = loading;
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    if (btnText && btnLoader) {
        if (loading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    }
}

/**
 * Display extracted data summary
 */
function displayExtractedData(data) {
    const { post, valuableComments, extractionStats } = data;

    const html = `
        <div class="data-summary">
            <h3>${escapeHtml(post.title)}</h3>
            <div class="meta">
                <span>r/${post.subreddit}</span> •
                <span>by u/${post.author}</span> •
                <span>${formatNumber(post.score)} upvotes</span> •
                <span>${formatNumber(post.num_comments)} comments</span>
            </div>
            <div class="stats" style="margin-top: 20px;">
                <div class="stat-item">
                    <div class="stat-value">${extractionStats.extracted}</div>
                    <div class="stat-label">High-Value Comments</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${extractionStats.percentageKept}%</div>
                    <div class="stat-label">Retention Rate</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${formatNumber(extractionStats.averageScore)}</div>
                    <div class="stat-label">Avg Score</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('extractedDataContent').innerHTML = html;
    document.getElementById('extractedDataCard').style.display = 'block';
}

/**
 * Display AI insights
 */
function displayInsights(analysisText) {
    const formattedHtml = formatMarkdown(analysisText);
    document.getElementById('insightsContent').innerHTML = formattedHtml;
    document.getElementById('insightsCard').style.display = 'block';
}

/**
 * Display post cards for search results
 */
function displayPostCards(posts, containerId, selectedSet, toggleFunction) {
    const container = document.getElementById(containerId);

    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px;">No posts found</p>';
        return;
    }

    const html = posts.map(post => {
        const isSelected = selectedSet.has(post.id);
        const badge = getEngagementBadge(post.engagementTier);

        return `
            <div class="post-card ${isSelected ? 'selected' : ''}"
                 id="post-${post.id}"
                 onclick="${toggleFunction}('${post.id}')">
                <div style="display: flex; align-items: flex-start;">
                    <input type="checkbox"
                           id="check-${post.id}"
                           ${isSelected ? 'checked' : ''}
                           onclick="event.stopPropagation(); ${toggleFunction}('${post.id}')">
                    <div style="flex: 1;">
                        <div class="post-title">${escapeHtml(post.title)}</div>
                        ${badge ? `<div style="margin: 8px 0;">${badge}</div>` : ''}
                        <div class="post-meta">
                            <span>r/${post.subreddit}</span>
                            <span>${formatNumber(post.score)} ⬆️</span>
                            <span>${formatNumber(post.num_comments)} 💬</span>
                            <span>${post.ageText}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Export data as JSON
 */
function exportData() {
    // TODO: Implement export functionality
    alert('Export feature coming soon!');
}

/**
 * Export insights as PDF
 */
function exportInsights() {
    // TODO: Implement PDF export
    alert('PDF export feature coming soon!');
}
