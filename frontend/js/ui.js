// UI manipulation functions

/**
 * Switch tabs
 */
function switchTab(tabName) {
    Analytics.trackTabSwitch(tabName);
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
 * Toggle topic subreddit filter input (legacy)
 */
function toggleTopicSubredditInput() {
    const checkbox = document.getElementById('topicSubredditFilter');
    const div = document.getElementById('topicSubredditInputDiv');
    if (checkbox && div) {
        div.style.display = checkbox.checked ? 'block' : 'none';
    }
}

/**
 * Toggle search method dropdown (new)
 */
function toggleSearchMethodDropdown() {
    const dropdown = document.getElementById('searchMethodDropdown');
    const subredditInput = document.getElementById('subredditMethodInput');
    const urlInput = document.getElementById('urlMethodInput');

    if (!dropdown) return;

    const value = dropdown.value;

    // Hide all conditional inputs first
    if (subredditInput) subredditInput.style.display = 'none';
    if (urlInput) urlInput.style.display = 'none';

    // Show the relevant input
    if (value === 'subreddits' && subredditInput) {
        subredditInput.style.display = 'block';
    } else if (value === 'urls' && urlInput) {
        urlInput.style.display = 'block';
    }
}

/**
 * Toggle search method radio buttons (legacy compatibility)
 */
function toggleSearchMethod() {
    const radioButtons = document.querySelectorAll('input[name="searchMethod"]');
    let selectedValue = 'reddit';

    radioButtons.forEach(radio => {
        if (radio.checked) {
            selectedValue = radio.value;
        }
    });

    const subredditInput = document.getElementById('subredditMethodInput');
    const urlInput = document.getElementById('urlMethodInput');

    if (subredditInput) subredditInput.style.display = 'none';
    if (urlInput) urlInput.style.display = 'none';

    if (selectedValue === 'subreddits' && subredditInput) {
        subredditInput.style.display = 'block';
    } else if (selectedValue === 'urls' && urlInput) {
        urlInput.style.display = 'block';
    }
}

// Timer state for elapsed time display
let statusTimer = null;
let statusStartTime = null;
let statusEstimatedSeconds = null;
let lastElapsedTime = null; // Store for showing with results
let tipTimer = null;
let currentTipIndex = 0;
let currentStatusMessage = '';

// Tips to show during analysis
const analysisTips = [
    "Reddit has 52+ million daily active users sharing opinions",
    "We're reading through hundreds of comments to find the best insights",
    "AI analysis considers context, sentiment, and patterns across posts",
    "Higher relevance scores mean posts closely match your research topic",
    "Comments are ranked by engagement and insight value",
    "We filter out low-quality content automatically",
    "Each post can have thousands of comments - we extract the valuable ones",
    "Analysis considers the persona and goal you specified",
    "Contradicting opinions are highlighted to show the full picture",
    "We look for patterns that appear across multiple discussions"
];

/**
 * Reset the status timer (call before starting a new operation)
 */
function resetStatusTimer() {
    if (statusTimer) {
        clearInterval(statusTimer);
        statusTimer = null;
    }
    if (tipTimer) {
        clearInterval(tipTimer);
        tipTimer = null;
    }
    statusStartTime = null;
    statusEstimatedSeconds = null;
    lastElapsedTime = null;
    currentTipIndex = 0;
    currentStatusMessage = '';
    // Clear tip and details
    const tipEl = document.getElementById('statusTip');
    const detailsEl = document.getElementById('statusDetails');
    if (tipEl) tipEl.textContent = '';
    if (detailsEl) detailsEl.textContent = '';
}

/**
 * Set estimated time for the current operation
 * @param {number} seconds - Estimated seconds to complete
 */
function setEstimatedTime(seconds) {
    statusEstimatedSeconds = seconds;
}

/**
 * Get the last elapsed time (for showing with results)
 * @returns {string|null} Formatted time string or null
 */
function getLastElapsedTime() {
    return lastElapsedTime;
}

/**
 * Format seconds into a readable string
 */
function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/**
 * Update status details text (sub-status line)
 */
function setStatusDetails(details) {
    const detailsEl = document.getElementById('statusDetails');
    if (detailsEl) {
        detailsEl.textContent = details;
    }
}

/**
 * Show status message with elapsed time counter and optional estimated time
 */
function showStatus(message, progress) {
    hideAll();
    const statusText = document.getElementById('statusText');
    const tipEl = document.getElementById('statusTip');
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('statusSection').style.display = 'block';
    currentStatusMessage = message;

    // Start timer on first status call (progress < 100), stop on completion
    if (progress < 100) {
        if (!statusStartTime) {
            statusStartTime = Date.now();
            // Start the main timer
            statusTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - statusStartTime) / 1000);
                const elapsedStr = formatTime(elapsed);
                let timeDisplay = elapsedStr;
                if (statusEstimatedSeconds) {
                    if (elapsed <= statusEstimatedSeconds) {
                        // Normal: show elapsed / estimated
                        const estStr = formatTime(statusEstimatedSeconds);
                        timeDisplay = `${elapsedStr} / ~${estStr} est`;
                    } else {
                        // Exceeded estimate: just show elapsed, no estimate
                        timeDisplay = elapsedStr;
                    }
                }
                statusText.textContent = `${currentStatusMessage} (${timeDisplay})`;
            }, 1000);

            // Start tip rotation (every 4 seconds)
            currentTipIndex = Math.floor(Math.random() * analysisTips.length);
            if (tipEl) {
                tipEl.textContent = analysisTips[currentTipIndex];
            }
            tipTimer = setInterval(() => {
                currentTipIndex = (currentTipIndex + 1) % analysisTips.length;
                if (tipEl) {
                    tipEl.style.opacity = '0';
                    setTimeout(() => {
                        tipEl.textContent = analysisTips[currentTipIndex];
                        tipEl.style.opacity = '1';
                    }, 300);
                }
            }, 4000);
        }
        // Update message but keep timer running
        currentStatusMessage = message;
        const elapsed = Math.floor((Date.now() - statusStartTime) / 1000);
        const elapsedStr = formatTime(elapsed);
        let timeDisplay = elapsedStr;
        if (statusEstimatedSeconds) {
            if (elapsed <= statusEstimatedSeconds) {
                const estStr = formatTime(statusEstimatedSeconds);
                timeDisplay = `${elapsedStr} / ~${estStr} est`;
            }
            // If elapsed > estimated, just show elapsed (no estimate)
        }
        statusText.textContent = statusStartTime ? `${message} (${timeDisplay})` : message;
    } else {
        // Completion - stop timer and show final time
        if (statusTimer) {
            clearInterval(statusTimer);
            const elapsed = Math.floor((Date.now() - statusStartTime) / 1000);
            lastElapsedTime = formatTime(elapsed);
            statusText.textContent = `${message} (took ${lastElapsedTime})`;
            statusTimer = null;
            statusStartTime = null;
            statusEstimatedSeconds = null;
        } else {
            statusText.textContent = message;
        }
        // Stop tips on completion
        if (tipTimer) {
            clearInterval(tipTimer);
            tipTimer = null;
        }
        if (tipEl) tipEl.textContent = '';
        const detailsEl = document.getElementById('statusDetails');
        if (detailsEl) detailsEl.textContent = '';
    }
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
    // User analysis results
    const userResults = document.getElementById('userResultsSection');
    if (userResults) userResults.style.display = 'none';
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
 * Display AI insights (markdown fallback)
 */
function displayInsights(analysisText) {
    // Store insights for export
    window.currentAIInsights = analysisText;

    const formattedHtml = formatMarkdown(analysisText);
    document.getElementById('insightsContent').innerHTML = formattedHtml;
    document.getElementById('insightsCard').style.display = 'block';
}

/**
 * Display structured AI insights (like Analyze User)
 * @param {object} analysis - Structured analysis object
 * @param {string} model - AI model used
 * @param {string} source - 'reddit' or 'youtube'
 */
function displayStructuredInsights(analysis, model, source = 'reddit') {
    // Store for export
    window.currentAIInsights = JSON.stringify(analysis, null, 2);

    const isYouTube = source === 'youtube';
    const engagementLabel = isYouTube ? 'likes' : 'pts';

    let html = '';

    // Executive Summary
    if (analysis.executiveSummary) {
        html += `
            <div class="content-analysis-section">
                <h3>Executive Summary</h3>
                <p class="executive-summary-text">${escapeHtml(analysis.executiveSummary)}</p>
            </div>
        `;
    }

    // Goal Analysis (Evidence Section)
    if (analysis.goalAnalysis) {
        const ga = analysis.goalAnalysis;
        const verdictClass = getVerdictClass(ga.verdict);
        const evidenceScore = ga.evidenceScore || 0;

        html += `
            <div class="content-analysis-section">
                <h3>Goal Analysis</h3>
                <div class="goal-analysis-card">
                    <div class="hypothesis-row">
                        <span class="hypothesis-label">Hypothesis:</span>
                        <span class="hypothesis-text">${escapeHtml(ga.hypothesis || 'N/A')}</span>
                    </div>
                    <div class="verdict-row">
                        <span class="verdict-badge ${verdictClass}">${ga.verdict || 'Unknown'}</span>
                        <span class="confidence-badge confidence-${ga.confidenceLevel || 'medium'}">${(ga.confidenceLevel || 'medium').toUpperCase()} confidence</span>
                    </div>
                    <div class="evidence-bar-container">
                        <div class="evidence-bar">
                            <div class="evidence-fill" style="width: ${evidenceScore}%"></div>
                        </div>
                        <span class="evidence-score">${evidenceScore}% supported</span>
                    </div>
                    ${ga.breakdown ? `
                        <div class="evidence-breakdown">
                            <span>${ga.breakdown.relevantComments || 0} relevant comments analyzed</span>
                            <span class="evidence-detail">
                                <span class="supporting">${ga.breakdown.supportingCount || 0} supporting (${ga.breakdown.supportingPercentage || 0}%)</span>
                                <span class="counter">${ga.breakdown.counterCount || 0} counter (${ga.breakdown.counterPercentage || 0}%)</span>
                            </span>
                        </div>
                    ` : ''}
                    ${ga.confidenceReason ? `<p class="confidence-reason">${escapeHtml(ga.confidenceReason)}</p>` : ''}
                </div>
            </div>
        `;
    }

    // Sentiment Analysis
    if (analysis.sentimentAnalysis) {
        const sa = analysis.sentimentAnalysis;
        html += `
            <div class="content-analysis-section">
                <h3>Sentiment Analysis</h3>
                <div class="sentiment-overview">
                    <span class="sentiment-overall sentiment-${sa.overall || 'neutral'}">${(sa.overall || 'neutral').toUpperCase()}</span>
                    ${sa.emotionalTone ? `<span class="emotional-tone">${escapeHtml(sa.emotionalTone)}</span>` : ''}
                </div>
                ${sa.breakdown ? `
                    <div class="sentiment-bars">
                        <div class="sentiment-bar-row">
                            <span class="sentiment-label positive">Positive</span>
                            <div class="sentiment-bar-track">
                                <div class="sentiment-bar-fill positive" style="width: ${sa.breakdown.positive || 0}%"></div>
                            </div>
                            <span class="sentiment-percent">${sa.breakdown.positive || 0}%</span>
                        </div>
                        <div class="sentiment-bar-row">
                            <span class="sentiment-label negative">Negative</span>
                            <div class="sentiment-bar-track">
                                <div class="sentiment-bar-fill negative" style="width: ${sa.breakdown.negative || 0}%"></div>
                            </div>
                            <span class="sentiment-percent">${sa.breakdown.negative || 0}%</span>
                        </div>
                        <div class="sentiment-bar-row">
                            <span class="sentiment-label neutral">Neutral</span>
                            <div class="sentiment-bar-track">
                                <div class="sentiment-bar-fill neutral" style="width: ${sa.breakdown.neutral || 0}%"></div>
                            </div>
                            <span class="sentiment-percent">${sa.breakdown.neutral || 0}%</span>
                        </div>
                    </div>
                ` : ''}
                ${sa.drivers ? `
                    <div class="sentiment-drivers">
                        ${sa.drivers.positive && sa.drivers.positive.length > 0 ? `
                            <div class="driver-col positive">
                                <h4>Driving Positive</h4>
                                <ul>${sa.drivers.positive.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                        ${sa.drivers.negative && sa.drivers.negative.length > 0 ? `
                            <div class="driver-col negative">
                                <h4>Driving Negative</h4>
                                <ul>${sa.drivers.negative.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Topic Groups
    if (analysis.topicGroups && analysis.topicGroups.length > 0) {
        html += `
            <div class="content-analysis-section">
                <h3>Topic Breakdown</h3>
                <div class="topic-groups-grid">
                    ${analysis.topicGroups.map(tg => `
                        <div class="topic-card">
                            <div class="topic-header">
                                <span class="topic-name">${escapeHtml(tg.topic)}</span>
                                <span class="topic-sentiment sentiment-${tg.sentiment || 'neutral'}">${tg.sentiment || 'neutral'}</span>
                            </div>
                            <p class="topic-description">${escapeHtml(tg.description || '')}</p>
                            <div class="topic-meta">
                                <span>${tg.commentCount || 0} comments</span>
                            </div>
                            ${tg.keyPoints && tg.keyPoints.length > 0 ? `
                                <div class="topic-key-points">
                                    <ul>${tg.keyPoints.map(kp => `<li>${escapeHtml(kp)}</li>`).join('')}</ul>
                                </div>
                            ` : ''}
                            ${tg.quotes && tg.quotes.length > 0 ? `
                                <div class="topic-quotes">
                                    ${tg.quotes.slice(0, 2).map(q => `
                                        <div class="topic-quote">
                                            <span class="quote-text">"${escapeHtml(q.text)}"</span>
                                            <span class="quote-meta">— @${q.author || 'anon'} • ${q.score || 0} ${engagementLabel}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Key Quotes
    if (analysis.keyQuotes && analysis.keyQuotes.length > 0) {
        html += `
            <div class="content-analysis-section">
                <h3>Key Quotes</h3>
                <div class="key-quotes-list">
                    ${analysis.keyQuotes.map(q => `
                        <div class="key-quote-card quote-type-${(q.type || 'insight').toLowerCase()}">
                            <div class="quote-type-badge">${getQuoteTypeIcon(q.type)} ${q.type || 'INSIGHT'}</div>
                            <p class="quote-text">"${escapeHtml(q.text)}"</p>
                            <div class="quote-footer">
                                <span class="quote-author">— @${q.author || 'anonymous'}</span>
                                <span class="quote-score">${q.score || 0} ${engagementLabel}</span>
                            </div>
                            ${q.context ? `<p class="quote-context">${escapeHtml(q.context)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Actionable Insights
    if (analysis.actionableInsights && analysis.actionableInsights.length > 0) {
        html += `
            <div class="content-analysis-section">
                <h3>Actionable Insights</h3>
                <div class="actionable-insights-list">
                    ${analysis.actionableInsights.map(ai => `
                        <div class="actionable-insight-card priority-${ai.priority || 'medium'}">
                            <div class="insight-header">
                                <span class="insight-title">${escapeHtml(ai.title)}</span>
                                <span class="priority-badge priority-${ai.priority || 'medium'}">${(ai.priority || 'medium').toUpperCase()}</span>
                            </div>
                            <p class="insight-description">${escapeHtml(ai.description)}</p>
                            ${ai.relevanceToGoal ? `<p class="insight-relevance">${escapeHtml(ai.relevanceToGoal)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Patterns
    if (analysis.patterns && analysis.patterns.length > 0) {
        html += `
            <div class="content-analysis-section">
                <h3>Patterns Observed</h3>
                <div class="patterns-list">
                    ${analysis.patterns.map(p => `
                        <div class="pattern-card">
                            <span class="pattern-name">${escapeHtml(p.pattern)}</span>
                            <p class="pattern-description">${escapeHtml(p.description)}</p>
                            ${p.frequency ? `<span class="pattern-frequency">${escapeHtml(p.frequency)}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Go Deeper
    if (analysis.goDeeper && analysis.goDeeper.suggestions && analysis.goDeeper.suggestions.length > 0) {
        html += `
            <div class="content-analysis-section">
                <h3>Go Deeper</h3>
                ${analysis.goDeeper.limitedData ? `<p class="limited-data-warning">⚠️ Limited data available. Consider these follow-up searches:</p>` : ''}
                <div class="go-deeper-list">
                    ${analysis.goDeeper.suggestions.map(s => `
                        <div class="go-deeper-item">
                            <span class="go-deeper-type">${s.type || 'search'}</span>
                            <span class="go-deeper-query">${escapeHtml(s.query)}</span>
                            ${s.reason ? `<span class="go-deeper-reason">${escapeHtml(s.reason)}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Statistics
    if (analysis.statistics) {
        const stats = analysis.statistics;
        html += `
            <div class="content-analysis-section">
                <h3>Statistics</h3>
                <div class="stats-grid">
                    ${stats.avgCommentScore !== undefined ? `
                        <div class="stat-box">
                            <span class="stat-value">${stats.avgCommentScore}</span>
                            <span class="stat-label">Avg ${engagementLabel}</span>
                        </div>
                    ` : ''}
                    ${stats.discussionDepth ? `
                        <div class="stat-box">
                            <span class="stat-value">${stats.discussionDepth}</span>
                            <span class="stat-label">Discussion Depth</span>
                        </div>
                    ` : ''}
                    ${stats.engagementQuality ? `
                        <div class="stat-box">
                            <span class="stat-value">${stats.engagementQuality}</span>
                            <span class="stat-label">Engagement Quality</span>
                        </div>
                    ` : ''}
                </div>
                ${stats.topComment ? `
                    <div class="top-comment-box">
                        <strong>Top Comment (${stats.topComment.score || 0} ${engagementLabel}):</strong>
                        <p>"${escapeHtml(stats.topComment.text || '')}"</p>
                        <span class="top-comment-author">— @${stats.topComment.author || 'anonymous'}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Model attribution
    html += `<div class="model-attribution">Model: ${model || 'unknown'}</div>`;

    document.getElementById('insightsContent').innerHTML = html;
    document.getElementById('insightsCard').style.display = 'block';
}

/**
 * Get CSS class for verdict
 */
function getVerdictClass(verdict) {
    if (!verdict) return 'verdict-unknown';
    const v = verdict.toLowerCase();
    if (v.includes('strongly supported')) return 'verdict-strongly-supported';
    if (v.includes('supported')) return 'verdict-supported';
    if (v.includes('mixed')) return 'verdict-mixed';
    if (v.includes('weakly')) return 'verdict-weakly-supported';
    if (v.includes('not supported')) return 'verdict-not-supported';
    if (v.includes('insufficient')) return 'verdict-insufficient';
    return 'verdict-unknown';
}

/**
 * Get icon for quote type
 */
function getQuoteTypeIcon(type) {
    const icons = {
        'INSIGHT': '💡',
        'WARNING': '⚠️',
        'TIP': '💬',
        'COMPLAINT': '😤',
        'PRAISE': '👏',
        'QUESTION': '❓'
    };
    return icons[type] || '💬';
}

/**
 * Display post cards for search results (grid layout)
 */
function displayPostCards(posts, containerId, selectedSet, toggleFunction) {
    const container = document.getElementById(containerId);

    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px;">No posts found</p>';
        return;
    }

    const html = `<div class="post-cards-grid">${posts.map(post => {
        const isSelected = selectedSet.has(post.id);
        const badge = getEngagementBadge(post.engagementTier);

        return `
            <div class="post-card-grid ${isSelected ? 'selected' : ''}"
                 id="post-${post.id}"
                 onclick="${toggleFunction}('${post.id}')">
                <div class="post-card-header">
                    <div class="post-card-badges">
                        <span class="badge-subreddit">r/${post.subreddit}</span>
                        ${badge || ''}
                    </div>
                    <input type="checkbox"
                           id="check-${post.id}"
                           ${isSelected ? 'checked' : ''}
                           onclick="event.stopPropagation(); ${toggleFunction}('${post.id}')">
                </div>
                <span class="post-card-title">
                    ${escapeHtml(post.title)}
                </span>
                <div class="post-card-footer">
                    <span class="post-card-hint">Click to select</span>
                    <a href="${post.url}" target="_blank" class="post-card-link" onclick="event.stopPropagation();">
                        View source ↗
                    </a>
                </div>
            </div>
        `;
    }).join('')}</div>`;

    container.innerHTML = html;
}

/**
 * Export data as JSON
 */
function exportData() {
    if (!window.currentExtractedData) {
        alert('No data to export');
        return;
    }

    const dataStr = JSON.stringify(window.currentExtractedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reddit-data-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Copy extracted data to clipboard (with AI analysis prompt)
 */
function copyToClipboard() {
    if (!window.currentExtractedData) {
        alert('No data to copy');
        return;
    }

    const formattedText = formatForClaudeAnalysis(window.currentExtractedData);

    navigator.clipboard.writeText(formattedText).then(() => {
        alert('✅ Content copied to clipboard with AI analysis prompt!');
    }).catch(err => {
        alert('❌ Failed to copy: ' + err);
    });
}

/**
 * Copy as plain text (comments only, no prompt)
 */
function copyAsText() {
    if (!window.currentExtractedData) {
        alert('No data to copy');
        return;
    }

    const { post, valuableComments, extractionStats } = window.currentExtractedData;

    let output = `═══════════════════════════════════════════════════════════════════════════
REDDIT POST - ${post.title}
═══════════════════════════════════════════════════════════════════════════

METADATA:
• Posted by: u/${post.author}
• Subreddit: r/${post.subreddit || 'unknown'}
• Post Score: ${post.score} upvotes
• Total Comments: ${post.num_comments}
• High-Value Comments Extracted: ${extractionStats.extracted}
${post.permalink ? `• Source URL: https://reddit.com${post.permalink}` : ''}

POST BODY:
${post.selftext || '[No body text - link or image post]'}

═══════════════════════════════════════════════════════════════════════════
HIGH-VALUE COMMENTS (${valuableComments.length} comments)
═══════════════════════════════════════════════════════════════════════════

`;

    valuableComments.forEach((comment, index) => {
        const commentUrl = post.permalink && post.id && comment.id
            ? `https://reddit.com${post.permalink}${comment.id}/`
            : null;
        output += `
────────────────────────────────────────────────────────────────────────────
COMMENT #${index + 1}
────────────────────────────────────────────────────────────────────────────
Author: u/${comment.author}
Score: ${comment.score} upvotes${comment.awards > 0 ? ` | Awards: ${comment.awards}` : ''}
${commentUrl ? `Comment URL: ${commentUrl}` : ''}

${comment.body}
`;
    });

    output += `\n═══════════════════════════════════════════════════════════════════════════
END OF DATA
═══════════════════════════════════════════════════════════════════════════

Exported: ${new Date().toISOString()}
Analysis Tool: Reddit Analyzer v2.0
`;

    navigator.clipboard.writeText(output).then(() => {
        alert('✅ Comments copied to clipboard!');
    }).catch(err => {
        alert('❌ Failed to copy: ' + err);
    });
}

/**
 * Export insights as PDF
 */
function exportToPDF() {
    if (!window.currentExtractedData) {
        alert('No data to export');
        return;
    }

    const { post, valuableComments, extractionStats } = window.currentExtractedData;

    // Create a new window for PDF export
    const printWindow = window.open('', '', 'width=800,height=600');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(post.title)}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 20px;
                    color: #333;
                }
                h1 {
                    color: #2d3748;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .meta {
                    background: #f7fafc;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin: 20px 0;
                }
                .stat {
                    text-align: center;
                    padding: 15px;
                    background: #edf2f7;
                    border-radius: 6px;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #667eea;
                }
                .stat-label {
                    font-size: 12px;
                    color: #718096;
                    margin-top: 5px;
                }
                .comment {
                    border-left: 4px solid #667eea;
                    padding: 15px;
                    margin: 20px 0;
                    background: #f7fafc;
                    page-break-inside: avoid;
                }
                .comment-header {
                    font-weight: bold;
                    color: #2d3748;
                    margin-bottom: 10px;
                }
                .comment-body {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(post.title)}</h1>

            <div class="meta">
                Posted by u/${escapeHtml(post.author)} •
                ${post.score} upvotes •
                ${post.num_comments} comments
                ${post.permalink ? `<br><strong>Source:</strong> <a href="https://reddit.com${post.permalink}" target="_blank" style="color: #667eea; text-decoration: none;">https://reddit.com${post.permalink}</a>` : ''}
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${extractionStats.total}</div>
                    <div class="stat-label">Total Comments</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${extractionStats.extracted}</div>
                    <div class="stat-label">Extracted</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${extractionStats.percentageKept}%</div>
                    <div class="stat-label">Retention</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${extractionStats.averageScore}</div>
                    <div class="stat-label">Avg Score</div>
                </div>
            </div>

            ${post.selftext ? `<div class="meta"><strong>Post Body:</strong><br>${escapeHtml(post.selftext)}</div>` : ''}

            <h2>High-Value Comments (${valuableComments.length})</h2>

            ${valuableComments.map((comment, index) => {
                const commentUrl = post.permalink && post.id && comment.id
                    ? `https://reddit.com${post.permalink}${comment.id}/`
                    : null;
                return `
                <div class="comment">
                    <div class="comment-header">
                        #${index + 1} • u/${escapeHtml(comment.author)} • ${comment.score} upvotes${comment.awards > 0 ? ` • ${comment.awards} awards` : ''}${commentUrl ? ` • <a href="${commentUrl}" target="_blank" style="color: #667eea; text-decoration: none;">View on Reddit</a>` : ''}
                    </div>
                    <div class="comment-body">${escapeHtml(comment.body)}</div>
                </div>
            `}).join('')}

            <div class="meta" style="margin-top: 30px; text-align: center; font-size: 12px;">
                Exported: ${new Date().toLocaleString()}<br>
                Reddit Analyzer v2.0
            </div>

            <div class="no-print" style="position: fixed; top: 20px; right: 20px;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Print / Save as PDF
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-left: 10px;">
                    ✕ Close
                </button>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Export AI insights as PDF
 */
function exportInsightsPDF() {
    if (!window.currentAIInsights) {
        alert('No AI insights to export. Please generate insights first.');
        return;
    }

    // Get post title if available
    const postTitle = window.currentExtractedData?.post?.title || 'Reddit Analysis';

    // Create a new window for PDF export
    const printWindow = window.open('', '', 'width=800,height=600');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Insights - ${escapeHtml(postTitle)}</title>
            <style>
                body {
                    font-family: 'Georgia', 'Times New Roman', serif;
                    line-height: 1.8;
                    max-width: 800px;
                    margin: 20px;
                    color: #2d3748;
                }
                h1 {
                    color: #1a202c;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 15px;
                    margin-bottom: 30px;
                    font-size: 28px;
                }
                h2 {
                    color: #2d3748;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    font-size: 22px;
                    border-left: 4px solid #667eea;
                    padding-left: 12px;
                }
                h3 {
                    color: #4a5568;
                    margin-top: 20px;
                    margin-bottom: 10px;
                    font-size: 18px;
                }
                p {
                    margin: 12px 0;
                }
                ul, ol {
                    margin: 10px 0;
                    padding-left: 30px;
                }
                li {
                    margin: 8px 0;
                }
                strong {
                    color: #1a202c;
                }
                em {
                    color: #4a5568;
                }
                .header-meta {
                    background: #f7fafc;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    font-size: 14px;
                    color: #718096;
                }
                .insights-content {
                    margin-top: 30px;
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
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>AI-Powered Content Intelligence</h1>

            <div class="header-meta">
                <strong>Analysis of:</strong> ${escapeHtml(postTitle)}<br>
                ${window.currentExtractedData?.post?.permalink ? `<strong>Source:</strong> <a href="https://reddit.com${window.currentExtractedData.post.permalink}" target="_blank" style="color: #667eea; text-decoration: none;">View on Reddit →</a><br>` : ''}
                <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
                <strong>Tool:</strong> Reddit Analyzer v2.0
            </div>

            <div class="insights-content">
                ${formatMarkdown(window.currentAIInsights)}
            </div>

            <div class="footer">
                Reddit Analyzer v2.0 • AI-Powered Business Intelligence<br>
                Exported: ${new Date().toISOString()}
            </div>

            <div class="no-print" style="position: fixed; top: 20px; right: 20px;">
                <button onclick="window.print()" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    Print / Save as PDF
                </button>
                <button onclick="window.close()" style="padding: 12px 24px; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-left: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    ✕ Close
                </button>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * Format data for Claude AI analysis (with embedded prompt)
 */
function formatForClaudeAnalysis(data) {
    const post = data.post;
    const comments = data.valuableComments;
    const stats = data.extractionStats;

    // Build the formatted text with embedded prompt
    let output = `═══════════════════════════════════════════════════════════════════════════
REDDIT CONTENT ANALYSIS REQUEST
═══════════════════════════════════════════════════════════════════════════

You are an expert Reddit content analyst. Below is a Reddit post with extracted high-value comments. Provide deep, actionable insights that go beyond surface-level observations.

═══════════════════════════════════════════════════════════════════════════
ANALYSIS FRAMEWORK
═══════════════════════════════════════════════════════════════════════════

1. CONTENT INTELLIGENCE
   • What type of discussion is this? (Don't force categories - describe what you observe)
   • What makes this content engaging to this audience?
   • What patterns emerge that might not be immediately obvious?

2. ENGAGEMENT DYNAMICS
   • Why did certain comments get high upvotes? What resonated?
   • Is there consensus, controversy, or something else driving engagement?
   • What's the upvote distribution telling us?

3. HIDDEN PATTERNS
   Look for non-obvious patterns:
   • Cognitive biases (confirmation bias, survivorship bias, etc.)
   • Emotional triggers (fear, hope, identity, validation)
   • Social dynamics (expertise vs experience, contrarian vs conformist)
   • Temporal patterns (immediate vs long-term thinking)
   • Economic factors (price sensitivity, value perception)

4. AUDIENCE INSIGHTS
   • Who is participating? (experts, enthusiasts, beginners, skeptics)
   • What do they care about? (practical advice, validation, entertainment, learning)
   • What assumptions do they share?
   • What questions are they really asking (vs what they explicitly say)?

5. CONTENT STRATEGY INTELLIGENCE
   If someone wanted to create similar engaging content:
   • What elements should they replicate?
   • What format works best? (question, story, controversy, education)
   • What tone resonates?
   • What timing/context matters?

6. SURPRISING FINDINGS
   • What's unexpected or counter-intuitive?
   • What would most people miss on first read?
   • What does this reveal about the community/topic/culture?

7. ACTIONABLE RECOMMENDATIONS
   Provide 3-5 specific, actionable takeaways for:
   • Content creators (how to replicate engagement)
   • Marketers (audience insights for targeting)
   • Researchers (cultural/social patterns)
   • The original poster (what they can learn)

8. DATA ANALYSIS WITH TABLES
   Generate data-driven tables that are RELEVANT to this specific content type.
   Choose 5-8 tables from these options based on what makes sense for THIS discussion:

   UNIVERSAL TABLES (apply to most posts):
   • Upvote Performance Tiers (Tier | Range | # Comments | Avg Position | Patterns)
   • Top 10-20 Comments Breakdown (Rank | Author | Upvotes | Theme | Key Factor)
   • Theme Distribution & Engagement (Theme | # Comments | Avg Upvotes | % of Discussion)
   • Word Count vs Engagement (Range | # Comments | Avg Upvotes | Optimal?)
   • Sentiment Distribution (Sentiment | # Comments | Avg Upvotes | Characteristics)

   CONTENT-SPECIFIC TABLES (choose relevant ones):
   For FACTUAL/TIL: Cognitive violations, verifiability matrix, temporal references
   For PRODUCT/REVIEW: Feature sentiment, price analysis, comparison matrix
   For OPINION/DEBATE: Viewpoint distribution, argument quality, polarization
   For ADVICE/HOW-TO: Success rates, expert vs experience, timeline expectations
   For STORY/EXPERIENCE: Emotional responses, advice vs empathy ratios

   TABLE GENERATION RULES:
   • Use markdown table format for easy reading
   • Include column headers and clear data
   • Add brief interpretation after each table
   • Only include tables that have sufficient data (minimum 5-10 data points)
   • Prioritize tables that reveal non-obvious insights
   • Calculate percentages, averages, and ratios where meaningful

IMPORTANT ANALYSIS GUIDELINES:
• Don't just summarize - analyze WHY things are the way they are
• Look for patterns across multiple comments, not just individual standouts
• Consider context: subreddit culture, current events, audience demographics
• Be honest if something is unclear or if the data is too limited
• Cite specific examples from the comments to support your insights
• Generate tables in markdown format for clarity
• Choose 5-8 most relevant tables based on content type - don't force irrelevant tables

═══════════════════════════════════════════════════════════════════════════
POST DATA
═══════════════════════════════════════════════════════════════════════════

TITLE: ${post.title}

METADATA:
• Posted by: u/${post.author}
• Subreddit: r/${post.subreddit || 'unknown'}
• Post Score: ${post.score} upvotes
• Total Comments: ${post.num_comments}

EXTRACTION STATISTICS:
• Total Comments Processed: ${stats.total}
• High-Value Comments Extracted: ${stats.extracted} (${stats.percentageKept}% kept)
• Average Comment Score: ${stats.averageScore}
• Extraction Quality: ${stats.percentageKept}% retention indicates ${stats.percentageKept > 50 ? 'diverse quality' : 'highly selective filtering'}

POST BODY:
${post.selftext || '[No body text - link or image post]'}

═══════════════════════════════════════════════════════════════════════════
HIGH-VALUE COMMENTS (${comments.length} comments)
═══════════════════════════════════════════════════════════════════════════

`;

    // Add all comments
    comments.forEach((comment, index) => {
        output += `
────────────────────────────────────────────────────────────────────────────
COMMENT #${index + 1}
────────────────────────────────────────────────────────────────────────────
Author: u/${comment.author}
Score: ${comment.score} upvotes${comment.awards > 0 ? ` | Awards: ${comment.awards}` : ''}
Engagement Rank: #${index + 1} of ${comments.length}

${comment.body}
`;
    });

    output += `
═══════════════════════════════════════════════════════════════════════════
END OF DATA
═══════════════════════════════════════════════════════════════════════════

Exported: ${new Date().toISOString()}
Analysis Tool: Reddit Analyzer v2.0

Now please provide your comprehensive analysis following the framework above.
`;

    return output;
}

/**
 * ============================================
 * PERSONA & OUTCOME SELECTION
 * ============================================
 */

// Persona outcomes mapping
const personaOutcomes = {
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
            { id: 'voice', label: "Extract 'Voice of Customer' Lingo" },
            { id: 'objections', label: 'Identify Buying Objections' },
            { id: 'viral', label: 'Find Viral Marketing Angles' },
            { id: 'sentiment', label: 'Analyze Sentiment Drivers' },
            { id: 'free_form', label: 'Other (specify your goal)', isCustom: true }
        ]
    },
    content_creator: {
        role: 'Content Creator',
        outcomes: [
            { id: 'content_gaps', label: 'Find Content Gaps & Questions' },
            { id: 'polarizing', label: 'Identify Polarizing Topics' },
            { id: 'faq', label: 'Gather Q&A for FAQ Video' },
            { id: 'trends', label: 'Spot Emerging Trends' },
            { id: 'free_form', label: 'Other (specify your goal)', isCustom: true }
        ]
    },
    custom: {
        role: 'Custom',
        outcomes: null // Will show custom inputs
    }
};

// Track current selections per tab
const tabSelections = {
    topic: { persona: null, outcome: null },
    url: { persona: null, outcome: null },
    subreddit: { persona: null, outcome: null }
};

/**
 * Select a persona card
 */
function selectPersona(tabId, personaId) {
    // Update selection state
    tabSelections[tabId].persona = personaId;
    tabSelections[tabId].outcome = null;

    // Update UI - remove selected from all cards in this tab
    const container = document.getElementById(`${tabId}PersonaCards`);
    container.querySelectorAll('.persona-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selected to clicked card
    const selectedCard = container.querySelector(`[data-persona="${personaId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    // Show outcome selection
    const outcomeSection = document.getElementById(`${tabId}OutcomeSelection`);
    const outcomeOptions = document.getElementById(`${tabId}OutcomeOptions`);
    const outcomeLabel = document.getElementById(`${tabId}OutcomeLabel`);

    if (personaId === 'custom') {
        // Show custom inputs
        outcomeLabel.textContent = 'DEFINE YOUR RESEARCH';
        outcomeOptions.innerHTML = `
            <div class="custom-inputs">
                <div class="custom-input-group">
                    <label>Custom Role</label>
                    <input type="text" id="${tabId}CustomRole" placeholder="e.g., UX Researcher, Founder, Investor" onchange="updateCustomSelection('${tabId}')">
                </div>
                <div class="custom-input-group">
                    <label>Specific Goal</label>
                    <input type="text" id="${tabId}CustomGoal" placeholder="e.g., Find usability issues, Validate market size" onchange="updateCustomSelection('${tabId}')">
                </div>
            </div>
        `;
        outcomeSection.style.display = 'block';

        // Clear hidden fields
        updateHiddenFields(tabId, 'Custom', '');
    } else {
        // Show predefined outcomes
        const persona = personaOutcomes[personaId];
        outcomeLabel.textContent = `SELECT SPECIFIC OUTCOME FOR ${persona.role.toUpperCase()}`;

        outcomeOptions.innerHTML = persona.outcomes.map((outcome, index) => `
            <div class="outcome-option" onclick="selectOutcome('${tabId}', '${personaId}', '${outcome.id}', '${outcome.label}', ${outcome.isCustom || false})">
                <input type="radio" name="${tabId}Outcome" id="${tabId}_${outcome.id}" ${index === 0 ? 'checked' : ''}>
                <span>${outcome.label}</span>
            </div>
        `).join('') + `
            <div id="${tabId}FreeFormInput" class="free-form-input-container" style="display: none; grid-column: 1 / -1;">
                <input type="text" id="${tabId}FreeFormGoal" placeholder="Describe your specific research goal..." class="free-form-goal-input" onchange="updateFreeFormGoal('${tabId}', '${personaId}')" oninput="updateFreeFormGoal('${tabId}', '${personaId}')">
            </div>
        `;

        outcomeSection.style.display = 'block';

        // Auto-select first outcome
        selectOutcome(tabId, personaId, persona.outcomes[0].id, persona.outcomes[0].label, false);
    }
}

/**
 * Select an outcome option
 */
function selectOutcome(tabId, personaId, outcomeId, outcomeLabel, isCustom = false) {
    tabSelections[tabId].outcome = outcomeId;

    // Update UI
    const outcomeOptions = document.getElementById(`${tabId}OutcomeOptions`);
    outcomeOptions.querySelectorAll('.outcome-option').forEach(option => {
        option.classList.remove('selected');
    });

    // Find and select the clicked option
    const radioBtn = document.getElementById(`${tabId}_${outcomeId}`);
    if (radioBtn) {
        radioBtn.checked = true;
        radioBtn.closest('.outcome-option').classList.add('selected');
    }

    // Show/hide custom input for free_form option
    const customInput = document.getElementById(`${tabId}FreeFormInput`);
    if (isCustom || outcomeId === 'free_form') {
        if (customInput) {
            customInput.style.display = 'block';
        }
        // Use custom input value if available
        const customValue = document.getElementById(`${tabId}FreeFormGoal`)?.value?.trim();
        const persona = personaOutcomes[personaId];
        updateHiddenFields(tabId, persona.role, customValue || 'Custom research goal');
    } else {
        if (customInput) {
            customInput.style.display = 'none';
        }
        // Update hidden fields
        const persona = personaOutcomes[personaId];
        updateHiddenFields(tabId, persona.role, outcomeLabel);
    }
}

/**
 * Update free form goal when user types
 */
function updateFreeFormGoal(tabId, personaId) {
    const customValue = document.getElementById(`${tabId}FreeFormGoal`)?.value?.trim();
    const persona = personaOutcomes[personaId];
    if (persona && customValue) {
        updateHiddenFields(tabId, persona.role, customValue);
    }
}

/**
 * Update custom selection fields
 */
function updateCustomSelection(tabId) {
    const customRole = document.getElementById(`${tabId}CustomRole`).value.trim() || 'Researcher';
    const customGoal = document.getElementById(`${tabId}CustomGoal`).value.trim() || 'Extract insights';

    updateHiddenFields(tabId, customRole, customGoal);
}

/**
 * Update hidden role/goal fields based on tab
 */
function updateHiddenFields(tabId, role, goal) {
    // Map tab IDs to their hidden field IDs
    const fieldMapping = {
        topic: { role: 'userRole', goal: 'userGoal' },
        url: { role: 'urlUserRole', goal: 'urlUserGoal' },
        subreddit: { role: 'subredditUserRole', goal: 'subredditUserGoal' }
    };

    const fields = fieldMapping[tabId];
    if (fields) {
        document.getElementById(fields.role).value = role;
        document.getElementById(fields.goal).value = goal;
    }
}
