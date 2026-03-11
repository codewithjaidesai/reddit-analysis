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
/**
 * Handle source selector change (Reddit + YouTube / Reddit only / YouTube only)
 * Hides Reddit-specific search options when YouTube-only is selected
 */
function handleSourceChange() {
    const sourceSelector = document.getElementById('topicSourceSelector');
    const searchMethodGroup = document.getElementById('searchMethodGroup');
    const subredditInput = document.getElementById('subredditMethodInput');
    const urlInput = document.getElementById('urlMethodInput');

    if (!sourceSelector) return;

    const source = sourceSelector.value;

    if (source === 'youtube') {
        // Hide Reddit-specific search method options
        if (searchMethodGroup) searchMethodGroup.style.display = 'none';
        if (subredditInput) subredditInput.style.display = 'none';
        if (urlInput) urlInput.style.display = 'none';
        // Reset to default search method
        const dropdown = document.getElementById('searchMethodDropdown');
        if (dropdown) dropdown.value = 'reddit';
    } else {
        // Show Reddit search method options
        if (searchMethodGroup) searchMethodGroup.style.display = '';
        // Re-trigger method toggle to show correct sub-inputs
        toggleSearchMethodDropdown();
    }
}

/**
 * Check YouTube availability and update source selector accordingly
 * Called on page load to hide YouTube options if not configured
 */
async function checkYouTubeAvailability() {
    try {
        const response = await fetch((window.API_CONFIG?.baseUrl || '') + '/api/analyze/features');
        if (!response.ok) return;
        const data = await response.json();
        if (!data.features?.youtube) {
            const selector = document.getElementById('topicSourceSelector');
            if (selector) {
                // Remove YouTube-only option
                const ytOption = selector.querySelector('option[value="youtube"]');
                if (ytOption) ytOption.remove();
                // Update "both" option to indicate YouTube unavailable
                const bothOption = selector.querySelector('option[value="both"]');
                if (bothOption) {
                    bothOption.textContent = 'Reddit (YouTube unavailable)';
                    bothOption.value = 'reddit';
                }
            }
        }
    } catch (e) {
        console.log('YouTube feature check failed, defaulting to Reddit only');
    }
}

// Check YouTube availability on page load
document.addEventListener('DOMContentLoaded', checkYouTubeAvailability);

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
    const isYouTube = data.source === 'youtube' || post.channelTitle;

    // Build meta info based on source
    let metaHtml;
    if (isYouTube) {
        const viewsFormatted = post.viewCount ? formatNumber(post.viewCount) + ' views' : '';
        const likesFormatted = formatNumber(post.score) + ' likes';
        const transcriptStatus = extractionStats.hasTranscript
            ? '<span class="transcript-badge available" title="Transcript available for video content analysis">📜 Transcript</span>'
            : '<span class="transcript-badge unavailable" title="No transcript available - captions may be disabled">📜 No transcript</span>';
        metaHtml = `
            <span>YouTube: ${escapeHtml(post.channelTitle || 'Unknown')}</span> •
            ${viewsFormatted ? `<span>${viewsFormatted}</span> •` : ''}
            <span>${likesFormatted}</span> •
            <span>${formatNumber(post.num_comments)} comments</span>
            ${transcriptStatus}
        `;
    } else {
        metaHtml = `
            <span>r/${post.subreddit}</span> •
            <span>by u/${post.author}</span> •
            <span>${formatNumber(post.score)} upvotes</span> •
            <span>${formatNumber(post.num_comments)} comments</span>
        `;
    }

    const html = `
        <div class="data-summary">
            <h3>${escapeHtml(post.title)}</h3>
            <div class="meta">
                ${metaHtml}
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
                    <div class="stat-label">Avg ${isYouTube ? 'Likes' : 'Score'}</div>
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
    // Store for export - keep both structured object and JSON string
    window.currentStructuredAnalysis = analysis;
    window.currentAnalysisSource = source;
    window.currentAIInsights = JSON.stringify(analysis, null, 2);

    const isYouTube = source === 'youtube';
    const engagementLabel = isYouTube ? 'likes' : 'pts';

    let html = '';

    // Video Summary (YouTube only, when transcript is available)
    if (isYouTube && analysis.videoSummary) {
        const vs = analysis.videoSummary;
        html += `
            <div class="content-analysis-section video-summary-section">
                <h3>📺 Video Content Summary</h3>
                <div class="video-summary-card">
                    <div class="video-type-badge">${escapeHtml(vs.contentType || 'video')}</div>
                    ${vs.summary ? `<p class="video-summary-text">${escapeHtml(vs.summary)}</p>` : ''}

                    ${vs.keyPoints && vs.keyPoints.length > 0 ? `
                        <div class="video-key-points">
                            <h4>Key Takeaways</h4>
                            <ul class="key-points-list">
                                ${vs.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    ${vs.concepts && vs.concepts.length > 0 ? `
                        <div class="video-concepts">
                            <h4>Concepts Explained</h4>
                            <div class="concepts-grid">
                                ${vs.concepts.map(concept => `
                                    <div class="concept-card">
                                        <span class="concept-term">${escapeHtml(concept.term)}</span>
                                        <p class="concept-definition">${escapeHtml(concept.definition)}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Video Overview (YouTube only, when NO transcript but has description)
    if (isYouTube && analysis.videoOverview && !analysis.videoSummary) {
        const vo = analysis.videoOverview;
        html += `
            <div class="content-analysis-section video-overview-section">
                <h3>📋 Video Overview <span class="info-label">From description</span></h3>
                <div class="video-overview-card">
                    <div class="video-type-badge">${escapeHtml(vo.contentType || 'video')}</div>
                    ${vo.summary ? `<p class="video-overview-text">${escapeHtml(vo.summary)}</p>` : ''}

                    ${vo.topicsFromDescription && vo.topicsFromDescription.length > 0 ? `
                        <div class="video-topics">
                            <h4>Topics Covered</h4>
                            <ul class="topics-list">
                                ${vo.topicsFromDescription.map(topic => `<li>${escapeHtml(topic)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <p class="overview-note">ℹ️ ${escapeHtml(vo.note || 'Based on video description - transcript unavailable')}</p>
                </div>
            </div>
        `;
    }

    // Executive Summary
    if (analysis.executiveSummary) {
        html += `
            <div class="content-analysis-section">
                <h3>Executive Summary</h3>
                <p class="executive-summary-text">${escapeHtml(analysis.executiveSummary)}</p>
            </div>
        `;
    }

    // Sentiment Analysis
    if (analysis.sentimentAnalysis) {
        const sa = analysis.sentimentAnalysis;
        html += `
            <div class="content-analysis-section">
                <h3>Sentiment Analysis <span class="info-label">Comment tone</span></h3>
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

    // Audience Segmentation (new demographic patterns format)
    if (analysis.audienceSegmentation && analysis.audienceSegmentation.demographicPatterns?.length > 0) {
        const as = analysis.audienceSegmentation;
        html += `
            <div class="content-analysis-section">
                <h3>Audience Segmentation <span class="info-label">${as.demographicPatterns.length} segments identified</span></h3>
                ${as.summary ? `<p class="section-summary-text">${escapeHtml(as.summary)}</p>` : ''}
                <div class="audience-chart-container" style="margin-bottom: 16px;">
                    <div class="audience-bar-chart" style="display: flex; height: 32px; border-radius: 8px; overflow: hidden; margin-bottom: 8px;">
                        ${as.demographicPatterns.map((seg, i) => {
                            const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac'];
                            return `<div style="width: ${seg.percentage || 0}%; background: ${colors[i % colors.length]}; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600; min-width: ${seg.percentage > 5 ? '0' : '20px'};">${seg.percentage > 8 ? seg.percentage + '%' : ''}</div>`;
                        }).join('')}
                    </div>
                    <div class="audience-chart-legend" style="display: flex; flex-wrap: wrap; gap: 12px;">
                        ${as.demographicPatterns.map((seg, i) => {
                            const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac'];
                            return `<span style="display: flex; align-items: center; gap: 4px; font-size: 13px; color: #cbd5e0;"><span style="width: 10px; height: 10px; border-radius: 50%; background: ${colors[i % colors.length]};"></span> ${escapeHtml(seg.identifier)} (${seg.percentage || 0}%)</span>`;
                        }).join('')}
                    </div>
                </div>
                <div class="audience-segments-grid">
                    ${as.demographicPatterns.map(seg => `
                        <div class="audience-segment-card">
                            <div class="segment-header">
                                <span class="segment-level-badge">${escapeHtml(seg.identifier || 'Unknown')}</span>
                                <span class="segment-stats">${seg.estimatedCount || 0} comments (${seg.percentage || 0}%)</span>
                            </div>
                            <p class="segment-description">${escapeHtml(seg.description || '')}</p>
                            ${seg.characteristics && seg.characteristics.length > 0 ? `
                                <div class="segment-characteristics">
                                    ${seg.characteristics.map(c => `<span class="segment-trait">${escapeHtml(c)}</span>`).join('')}
                                </div>
                            ` : ''}
                            ${seg.evidence && seg.evidence.length > 0 ? `
                                <div class="segment-evidence" style="margin-top: 8px;">
                                    ${seg.evidence.map(e => `<p class="segment-evidence-quote" style="font-size: 12px; color: #94a3b8; font-style: italic;">"${escapeHtml(e)}"</p>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Audience Segmentation (legacy format - experience levels)
    if (analysis.audienceSegmentation && analysis.audienceSegmentation.segments?.length > 0 && !analysis.audienceSegmentation.demographicPatterns) {
        const as = analysis.audienceSegmentation;
        html += `
            <div class="content-analysis-section">
                <h3>Audience Segmentation <span class="info-label">${as.segments.length} segments identified</span></h3>
                ${as.summary ? `<p class="section-summary-text">${escapeHtml(as.summary)}</p>` : ''}
                <div class="audience-segments-grid">
                    ${as.segments.map(seg => `
                        <div class="audience-segment-card segment-${(seg.level || 'unknown').toLowerCase()}">
                            <div class="segment-header">
                                <span class="segment-level-badge level-${(seg.level || 'unknown').toLowerCase()}">${(seg.level || 'Unknown').toUpperCase()}</span>
                                <span class="segment-stats">${seg.estimatedCount || 0} comments (${seg.percentage || 0}%)</span>
                            </div>
                            <p class="segment-description">${escapeHtml(seg.description || '')}</p>
                            ${seg.characteristics && seg.characteristics.length > 0 ? `
                                <div class="segment-characteristics">
                                    ${seg.characteristics.map(c => `<span class="segment-trait">${escapeHtml(c)}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Viral Content Ideas (Content Creator)
    if (analysis.viralContentIdeas && analysis.viralContentIdeas.ideas?.length > 0) {
        const vc = analysis.viralContentIdeas;
        html += `
            <div class="content-analysis-section">
                <h3>Viral Content Ideas <span class="info-label success">From audience language</span></h3>
                ${vc.summary ? `<p class="section-summary-text">${escapeHtml(vc.summary)}</p>` : ''}
                <div class="viral-ideas-list">
                    ${vc.ideas.map(idea => `
                        <div class="viral-idea-card" style="background: #1c2432; border: 1px solid #2d3a4d; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <span style="font-weight: 600; color: #f1f5f9; font-size: 15px;">${escapeHtml(idea.idea)}</span>
                                <span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; white-space: nowrap;">Demand: ${idea.demandScore || '?'}/10</span>
                            </div>
                            <p style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">${escapeHtml(idea.whyViral || '')}</p>
                            ${idea.audienceQuotes && idea.audienceQuotes.length > 0 ? `
                                <div style="margin-bottom: 8px;">
                                    ${idea.audienceQuotes.map(q => `<p style="font-size: 12px; color: #a78bfa; font-style: italic; margin: 4px 0;">"${escapeHtml(q)}"</p>`).join('')}
                                </div>
                            ` : ''}
                            ${idea.suggestedFormats && idea.suggestedFormats.length > 0 ? `
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    ${idea.suggestedFormats.map(f => `<span style="background: #2d3a4d; color: #cbd5e0; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${escapeHtml(f)}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Top Open Questions (Content Creator)
    if (analysis.topOpenQuestions && analysis.topOpenQuestions.questions?.length > 0) {
        const toq = analysis.topOpenQuestions;
        html += `
            <div class="content-analysis-section">
                <h3>Top Open Questions <span class="info-label success">Engagement opportunities</span></h3>
                ${toq.summary ? `<p class="section-summary-text">${escapeHtml(toq.summary)}</p>` : ''}
                <div class="unanswered-questions-list">
                    ${toq.questions.map(q => `
                        <div class="unanswered-q-card">
                            <div class="unanswered-q-header">
                                <span class="unanswered-q-text">${escapeHtml(q.question)}</span>
                                <span class="content-opportunity-tag">Content Idea</span>
                            </div>
                            <div class="unanswered-q-meta">
                                <span class="unanswered-q-author">-- @${escapeHtml(q.author || 'anonymous')}</span>
                                <span class="unanswered-q-score">${q.score || 0} ${engagementLabel}</span>
                                ${q.engagementSignal ? `<span style="color: #48bb78; font-size: 12px;">${escapeHtml(q.engagementSignal)}</span>` : ''}
                            </div>
                            ${q.contentOpportunity ? `<p class="unanswered-q-opportunity">${escapeHtml(q.contentOpportunity)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Pain Points (Marketer)
    if (analysis.painPoints) {
        const pp = analysis.painPoints;
        html += `
            <div class="content-analysis-section">
                <h3>Pain Points</h3>
                ${pp.summary ? `<p class="section-summary-text">${escapeHtml(pp.summary)}</p>` : ''}
                ${pp.points && pp.points.length > 0 ? `
                    <div style="margin-bottom: 16px;">
                        ${pp.points.map(p => `
                            <div style="background: #1c2432; border: 1px solid #2d3a4d; border-radius: 8px; padding: 14px; margin-bottom: 10px; border-left: 3px solid ${p.severity === 'high' ? '#e53e3e' : p.severity === 'medium' ? '#ed8936' : '#48bb78'};">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <span style="font-weight: 600; color: #f1f5f9; font-size: 14px;">${escapeHtml(p.pain)}</span>
                                    <div style="display: flex; gap: 6px;">
                                        <span style="background: ${p.severity === 'high' ? '#e53e3e33' : p.severity === 'medium' ? '#ed893633' : '#48bb7833'}; color: ${p.severity === 'high' ? '#fc8181' : p.severity === 'medium' ? '#fbd38d' : '#9ae6b4'}; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${(p.severity || 'medium').toUpperCase()}</span>
                                        ${p.frequency ? `<span style="color: #94a3b8; font-size: 11px;">${p.frequency}x mentioned</span>` : ''}
                                    </div>
                                </div>
                                ${p.marketingAngle ? `<p style="color: #48bb78; font-size: 13px; margin-top: 6px;">Marketing angle: ${escapeHtml(p.marketingAngle)}</p>` : ''}
                                ${p.quotes && p.quotes.length > 0 ? `<p style="font-size: 12px; color: #a78bfa; font-style: italic; margin-top: 6px;">"${escapeHtml(p.quotes[0].text)}"</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Key Value Proposition (Marketer)
    if (analysis.keyValueProposition) {
        const kvp = analysis.keyValueProposition;
        html += `
            <div class="content-analysis-section">
                <h3>Key Value Proposition</h3>
                <div style="background: #1c2432; border: 1px solid #667eea; border-radius: 8px; padding: 20px; margin-bottom: 12px;">
                    <div style="font-size: 18px; font-weight: 700; color: #f1f5f9; margin-bottom: 12px;">${escapeHtml(kvp.primaryValue || '')}</div>
                    ${kvp.supportingValues && kvp.supportingValues.length > 0 ? `
                        <div style="margin-bottom: 12px;">
                            ${kvp.supportingValues.map(v => `<span style="background: #2d3a4d; color: #cbd5e0; padding: 4px 10px; border-radius: 4px; font-size: 13px; margin-right: 6px; display: inline-block; margin-bottom: 4px;">${escapeHtml(v)}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${kvp.userLanguage && kvp.userLanguage.length > 0 ? `
                        <div style="margin-bottom: 12px;">
                            <span style="color: #94a3b8; font-size: 12px; display: block; margin-bottom: 6px;">In their own words:</span>
                            ${kvp.userLanguage.map(l => `<p style="color: #a78bfa; font-style: italic; font-size: 13px; margin: 4px 0;">"${escapeHtml(l)}"</p>`).join('')}
                        </div>
                    ` : ''}
                    ${kvp.differentiators && kvp.differentiators.length > 0 ? `
                        <div>
                            <span style="color: #94a3b8; font-size: 12px; display: block; margin-bottom: 6px;">Differentiators:</span>
                            <ul style="margin: 0; padding-left: 16px;">${kvp.differentiators.map(d => `<li style="color: #48bb78; font-size: 13px;">${escapeHtml(d)}</li>`).join('')}</ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Unanswered Questions (legacy format)
    if (analysis.unansweredQuestions && analysis.unansweredQuestions.questions?.length > 0) {
        const uq = analysis.unansweredQuestions;
        html += `
            <div class="content-analysis-section">
                <h3>Unanswered Questions <span class="info-label success">Content opportunities</span></h3>
                ${uq.summary ? `<p class="section-summary-text">${escapeHtml(uq.summary)}</p>` : ''}
                <div class="unanswered-questions-list">
                    ${uq.questions.map(q => `
                        <div class="unanswered-q-card">
                            <div class="unanswered-q-header">
                                <span class="unanswered-q-text">${escapeHtml(q.question)}</span>
                                <span class="content-opportunity-tag">Content Idea</span>
                            </div>
                            <div class="unanswered-q-meta">
                                <span class="unanswered-q-author">— @${escapeHtml(q.author || 'anonymous')}</span>
                                <span class="unanswered-q-score">${q.score || 0} ${engagementLabel}</span>
                            </div>
                            ${q.contentOpportunity ? `<p class="unanswered-q-opportunity">${escapeHtml(q.contentOpportunity)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Comment Classification
    if (analysis.commentClassification && analysis.commentClassification.breakdown) {
        const cc = analysis.commentClassification;
        const bd = cc.breakdown;
        html += `
            <div class="content-analysis-section">
                <h3>Comment Substance Analysis <span class="info-label">Engagement quality</span></h3>
                ${cc.summary ? `<p class="section-summary-text">${escapeHtml(cc.summary)}</p>` : ''}
                <div class="classification-bar-container">
                    <div class="classification-bar">
                        ${bd.substantive?.percentage > 0 ? `<div class="classification-segment substantive" style="width: ${bd.substantive.percentage}%"><span>${bd.substantive.percentage}%</span></div>` : ''}
                        ${bd.motivational?.percentage > 0 ? `<div class="classification-segment motivational" style="width: ${bd.motivational.percentage}%"><span>${bd.motivational.percentage}%</span></div>` : ''}
                        ${bd.conversational?.percentage > 0 ? `<div class="classification-segment conversational" style="width: ${bd.conversational.percentage}%"><span>${bd.conversational.percentage}%</span></div>` : ''}
                        ${bd.promotional?.percentage > 0 ? `<div class="classification-segment promotional" style="width: ${bd.promotional.percentage}%"><span>${bd.promotional.percentage}%</span></div>` : ''}
                    </div>
                    <div class="classification-legend">
                        <span class="legend-item"><span class="legend-dot substantive"></span> Substantive ${bd.substantive?.count || 0}</span>
                        <span class="legend-item"><span class="legend-dot motivational"></span> Motivational ${bd.motivational?.count || 0}</span>
                        <span class="legend-item"><span class="legend-dot conversational"></span> Conversational ${bd.conversational?.count || 0}</span>
                        <span class="legend-item"><span class="legend-dot promotional"></span> Promotional ${bd.promotional?.count || 0}</span>
                    </div>
                </div>
                ${cc.topSubstantiveComments && cc.topSubstantiveComments.length > 0 ? `
                    <div class="top-substantive-list">
                        <h4>Top Substantive Comments</h4>
                        ${cc.topSubstantiveComments.map(c => `
                            <div class="substantive-comment-card">
                                <p class="substantive-snippet">"${escapeHtml(c.snippet)}"</p>
                                <div class="substantive-meta">
                                    <span class="substantive-author">— @${escapeHtml(c.author || 'anonymous')}</span>
                                    <span class="substantive-score">${c.score || 0} ${engagementLabel}</span>
                                </div>
                                ${c.whyValuable ? `<p class="substantive-why">${escapeHtml(c.whyValuable)}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Spam & Promotions
    if (analysis.spamAndPromotions) {
        const sp = analysis.spamAndPromotions;
        const hasFlagged = sp.flaggedComments && sp.flaggedComments.length > 0;
        html += `
            <div class="content-analysis-section">
                <h3>Spam & Promotions <span class="info-label ${hasFlagged ? 'warning' : ''}">${hasFlagged ? sp.flaggedComments.length + ' flagged' : 'Clean'}</span></h3>
                ${sp.summary ? `<p class="section-summary-text">${escapeHtml(sp.summary)}</p>` : ''}
                ${hasFlagged ? `
                    <div class="spam-flagged-list">
                        ${sp.flaggedComments.map(f => `
                            <div class="spam-flagged-item severity-${(f.severity || 'low').toLowerCase()}">
                                <div class="spam-flagged-header">
                                    <span class="spam-type-badge type-${(f.type || 'spam').replace(/_/g, '-')}">${(f.type || 'spam').replace(/_/g, ' ')}</span>
                                    <span class="spam-severity-badge severity-${(f.severity || 'low').toLowerCase()}">${(f.severity || 'low').toUpperCase()}</span>
                                </div>
                                <p class="spam-snippet">"${escapeHtml(f.snippet || '')}"</p>
                                <div class="spam-meta">
                                    <span class="spam-author">— @${escapeHtml(f.author || 'anonymous')}</span>
                                    ${f.reason ? `<span class="spam-reason">${escapeHtml(f.reason)}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="spam-clean-notice">No spam or promotional comments detected.</div>
                `}
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
${post.permalink ? `• Source URL: ${post.permalink.startsWith('http') ? post.permalink : 'https://reddit.com' + post.permalink}` : ''}

POST BODY:
${post.selftext || '[No body text - link or image post]'}

═══════════════════════════════════════════════════════════════════════════
HIGH-VALUE COMMENTS (${valuableComments.length} comments)
═══════════════════════════════════════════════════════════════════════════

`;

    valuableComments.forEach((comment, index) => {
        const commentUrl = post.permalink && post.id && comment.id && !post.permalink.startsWith('http')
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
                ${post.permalink ? (() => {
                    const sourceUrl = post.permalink.startsWith('http') ? post.permalink : 'https://reddit.com' + post.permalink;
                    return `<br><strong>Source:</strong> <a href="${sourceUrl}" target="_blank" style="color: #667eea; text-decoration: none;">${sourceUrl}</a>`;
                })() : ''}
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
                const commentUrl = post.permalink && post.id && comment.id && !post.permalink.startsWith('http')
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
 * Export AI insights as PDF - supports both structured and markdown analysis
 */
function exportInsightsPDF() {
    if (!window.currentAIInsights && !window.currentStructuredAnalysis) {
        alert('No AI insights to export. Please generate insights first.');
        return;
    }

    // Get post info
    const postTitle = window.currentExtractedData?.post?.title || 'Content Analysis';
    const source = window.currentAnalysisSource || window.currentExtractedData?.source || 'reddit';
    const isYouTube = source === 'youtube';
    const post = window.currentExtractedData?.post;

    // Build source link
    let sourceLink = '';
    if (post?.permalink) {
        if (isYouTube) {
            sourceLink = `<strong>Source:</strong> <a href="${post.permalink}" target="_blank" style="color: #667eea;">View on YouTube →</a><br>`;
        } else {
            sourceLink = `<strong>Source:</strong> <a href="https://reddit.com${post.permalink}" target="_blank" style="color: #667eea;">View on Reddit →</a><br>`;
        }
    }

    // Generate content - use structured renderer if available
    let contentHtml;
    if (window.currentStructuredAnalysis) {
        contentHtml = formatStructuredAnalysisForPDF(window.currentStructuredAnalysis, source);
    } else {
        contentHtml = formatMarkdown(window.currentAIInsights);
    }

    const printWindow = window.open('', '', 'width=900,height=700');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Insights - ${escapeHtml(postTitle)}</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    max-width: 850px;
                    margin: 0 auto;
                    padding: 30px;
                    color: #1a202c;
                    background: white;
                }
                h1 {
                    color: #1a202c;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 12px;
                    margin-bottom: 24px;
                    font-size: 24px;
                    font-weight: 700;
                }
                h2 {
                    color: #2d3748;
                    margin-top: 28px;
                    margin-bottom: 12px;
                    font-size: 18px;
                    font-weight: 600;
                    border-left: 4px solid #667eea;
                    padding-left: 12px;
                }
                h3 {
                    color: #4a5568;
                    margin-top: 16px;
                    margin-bottom: 8px;
                    font-size: 15px;
                    font-weight: 600;
                }
                p { margin: 10px 0; font-size: 14px; }
                ul, ol { margin: 8px 0; padding-left: 24px; }
                li { margin: 6px 0; font-size: 14px; }
                .header-meta {
                    background: #f7fafc;
                    padding: 16px;
                    border-radius: 8px;
                    margin: 16px 0 24px 0;
                    font-size: 13px;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                }
                .header-meta strong { color: #2d3748; }
                .section {
                    margin-bottom: 24px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .section:last-child { border-bottom: none; }
                .summary-box {
                    background: #f0f4ff;
                    border-left: 4px solid #667eea;
                    padding: 14px 16px;
                    border-radius: 0 8px 8px 0;
                    font-size: 14px;
                    line-height: 1.7;
                }
                .verdict-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 16px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-right: 8px;
                }
                .verdict-supported { background: #c6f6d5; color: #22543d; }
                .verdict-mixed { background: #fef3c7; color: #92400e; }
                .verdict-not-supported { background: #fed7d7; color: #9b2c2c; }
                .evidence-bar {
                    height: 8px;
                    background: #e2e8f0;
                    border-radius: 4px;
                    margin: 8px 0;
                    overflow: hidden;
                }
                .evidence-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    border-radius: 4px;
                }
                .quote-box {
                    background: #f7fafc;
                    border-left: 3px solid #a0aec0;
                    padding: 12px 14px;
                    margin: 10px 0;
                    border-radius: 0 6px 6px 0;
                    font-style: italic;
                    font-size: 13px;
                }
                .quote-author { font-style: normal; color: #718096; font-size: 12px; margin-top: 6px; }
                .insight-card {
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 14px;
                    margin: 10px 0;
                }
                .priority-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .priority-high { background: #fed7d7; color: #9b2c2c; }
                .priority-medium { background: #fef3c7; color: #92400e; }
                .priority-low { background: #e2e8f0; color: #4a5568; }
                .topic-card {
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 14px;
                    margin: 10px 0;
                    page-break-inside: avoid;
                }
                .topic-name { font-weight: 600; color: #2d3748; margin-bottom: 6px; }
                .sentiment-tag {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 500;
                }
                .sentiment-positive { background: #c6f6d5; color: #22543d; }
                .sentiment-negative { background: #fed7d7; color: #9b2c2c; }
                .sentiment-mixed { background: #fef3c7; color: #92400e; }
                .sentiment-neutral { background: #e2e8f0; color: #4a5568; }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    margin: 12px 0;
                }
                .stat-box {
                    text-align: center;
                    background: #f7fafc;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }
                .stat-value { font-size: 18px; font-weight: 700; color: #667eea; }
                .stat-label { font-size: 11px; color: #718096; margin-top: 4px; }
                .video-section {
                    background: #fff5f5;
                    border: 1px solid #feb2b2;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                .video-section h2 { border-left-color: #e53e3e; margin-top: 0; }
                .video-badge {
                    display: inline-block;
                    padding: 3px 10px;
                    background: #fed7d7;
                    color: #9b2c2c;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                }
                .concept-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-left: 3px solid #d69e2e;
                    padding: 10px 12px;
                    margin: 8px 0;
                    border-radius: 0 6px 6px 0;
                }
                .concept-term { font-weight: 600; color: #d69e2e; }
                .label-hint {
                    display: inline-block;
                    background: #edf2f7;
                    color: #4a5568;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    margin-left: 8px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    font-size: 11px;
                    color: #a0aec0;
                }
                @media print {
                    body { padding: 20px; }
                    .no-print { display: none !important; }
                    .section { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <h1>AI-Powered Content Intelligence</h1>

            <div class="header-meta">
                <strong>Analysis of:</strong> ${escapeHtml(postTitle)}<br>
                ${sourceLink}
                <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
                <strong>Source:</strong> ${isYouTube ? 'YouTube' : 'Reddit'} • <strong>Tool:</strong> Reddit Analyzer v2.0
            </div>

            <div class="insights-content">
                ${contentHtml}
            </div>

            <div class="footer">
                Reddit Analyzer v2.0 • AI-Powered Business Intelligence<br>
                Exported: ${new Date().toISOString()}
            </div>

            <div class="no-print" style="position: fixed; top: 20px; right: 20px; display: flex; gap: 10px;">
                <button onclick="window.print()" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                    Print / Save as PDF
                </button>
                <button onclick="window.close()" style="padding: 12px 24px; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
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
 * Format structured analysis for PDF export
 */
function formatStructuredAnalysisForPDF(analysis, source = 'reddit') {
    const isYouTube = source === 'youtube';
    let html = '';

    // Video Summary (YouTube only, with transcript)
    if (isYouTube && analysis.videoSummary) {
        const vs = analysis.videoSummary;
        html += `
            <div class="video-section">
                <h2>📺 Video Content Summary</h2>
                <span class="video-badge">${escapeHtml(vs.contentType || 'video')}</span>
                ${vs.summary ? `<p>${escapeHtml(vs.summary)}</p>` : ''}
                ${vs.keyPoints && vs.keyPoints.length > 0 ? `
                    <h3>Key Takeaways</h3>
                    <ul>${vs.keyPoints.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
                ` : ''}
                ${vs.concepts && vs.concepts.length > 0 ? `
                    <h3>Concepts Explained</h3>
                    ${vs.concepts.map(c => `
                        <div class="concept-card">
                            <span class="concept-term">${escapeHtml(c.term)}</span>
                            <p style="margin: 4px 0 0 0; font-size: 13px;">${escapeHtml(c.definition)}</p>
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `;
    }

    // Video Overview (YouTube only, from description when no transcript)
    if (isYouTube && analysis.videoOverview && !analysis.videoSummary) {
        const vo = analysis.videoOverview;
        html += `
            <div class="section" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h2 style="border-left-color: #3b82f6; margin-top: 0;">📋 Video Overview <span class="label-hint">From description</span></h2>
                <span class="video-badge" style="background: #dbeafe; color: #1d4ed8;">${escapeHtml(vo.contentType || 'video')}</span>
                ${vo.summary ? `<p>${escapeHtml(vo.summary)}</p>` : ''}
                ${vo.topicsFromDescription && vo.topicsFromDescription.length > 0 ? `
                    <h3>Topics Covered</h3>
                    <ul>${vo.topicsFromDescription.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
                ` : ''}
                <p style="font-size: 12px; color: #64748b; font-style: italic; margin-top: 12px;">ℹ️ ${escapeHtml(vo.note || 'Based on video description - transcript unavailable')}</p>
            </div>
        `;
    }

    // Executive Summary
    if (analysis.executiveSummary) {
        html += `
            <div class="section">
                <h2>Executive Summary</h2>
                <div class="summary-box">${escapeHtml(analysis.executiveSummary)}</div>
            </div>
        `;
    }

    // Sentiment Analysis
    if (analysis.sentimentAnalysis) {
        const sa = analysis.sentimentAnalysis;
        html += `
            <div class="section">
                <h2>Sentiment Analysis</h2>
                <p><span class="sentiment-tag sentiment-${(sa.overall || '').toLowerCase()}">${escapeHtml(sa.overall || 'Unknown')}</span>
                ${sa.emotionalTone ? ` — ${escapeHtml(sa.emotionalTone)}` : ''}</p>
                ${sa.breakdown ? `
                    <p style="font-size: 13px;">
                        Positive: ${sa.breakdown.positive || 0}% •
                        Neutral: ${sa.breakdown.neutral || 0}% •
                        Negative: ${sa.breakdown.negative || 0}%
                    </p>
                ` : ''}
                ${sa.drivers ? `
                    <div style="margin-top: 8px;">
                        ${sa.drivers.positive?.length > 0 ? `<p style="font-size: 13px;"><strong style="color: #48bb78;">Positive drivers:</strong> ${sa.drivers.positive.map(d => escapeHtml(d)).join(', ')}</p>` : ''}
                        ${sa.drivers.negative?.length > 0 ? `<p style="font-size: 13px;"><strong style="color: #e53e3e;">Negative drivers:</strong> ${sa.drivers.negative.map(d => escapeHtml(d)).join(', ')}</p>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Confidence
    if (analysis.confidence) {
        const conf = analysis.confidence;
        html += `
            <div class="section">
                <h2>Data Confidence</h2>
                <p><strong>${escapeHtml((conf.level || 'unknown').toUpperCase())}</strong> confidence${conf.totalComments ? ` (${conf.totalComments} comments analyzed)` : ''}</p>
                ${conf.reason ? `<p style="font-size: 13px; color: #718096;">${escapeHtml(conf.reason)}</p>` : ''}
            </div>
        `;
    }

    // Audience Segmentation (new demographic patterns)
    if (analysis.audienceSegmentation && analysis.audienceSegmentation.demographicPatterns?.length > 0) {
        const as = analysis.audienceSegmentation;
        html += `<div class="section"><h2>Audience Segmentation</h2>`;
        if (as.summary) html += `<p style="font-size: 13px; color: #718096;">${escapeHtml(as.summary)}</p>`;
        for (const seg of as.demographicPatterns) {
            html += `
                <div class="insight-card">
                    <strong>${escapeHtml(seg.identifier || 'Unknown')}</strong>
                    <span class="label-hint">${seg.estimatedCount || 0} comments (${seg.percentage || 0}%)</span>
                    <p style="font-size: 13px; margin: 6px 0;">${escapeHtml(seg.description || '')}</p>
                    ${seg.characteristics?.length > 0 ? `<ul style="font-size: 12px;">${seg.characteristics.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
                </div>
            `;
        }
        html += `</div>`;
    }

    // Audience Segmentation (legacy segments format)
    if (analysis.audienceSegmentation && analysis.audienceSegmentation.segments?.length > 0 && !analysis.audienceSegmentation.demographicPatterns) {
        const as = analysis.audienceSegmentation;
        html += `<div class="section"><h2>Audience Segmentation</h2>`;
        if (as.summary) html += `<p style="font-size: 13px; color: #718096;">${escapeHtml(as.summary)}</p>`;
        for (const seg of as.segments) {
            html += `
                <div class="insight-card">
                    <strong>${escapeHtml((seg.level || 'Unknown').toUpperCase())}</strong>
                    <span class="label-hint">${seg.estimatedCount || 0} comments (${seg.percentage || 0}%)</span>
                    <p style="font-size: 13px; margin: 6px 0;">${escapeHtml(seg.description || '')}</p>
                    ${seg.characteristics?.length > 0 ? `<ul style="font-size: 12px;">${seg.characteristics.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
                </div>
            `;
        }
        html += `</div>`;
    }

    // Viral Content Ideas (Content Creator)
    if (analysis.viralContentIdeas && analysis.viralContentIdeas.ideas?.length > 0) {
        const vc = analysis.viralContentIdeas;
        html += `<div class="section"><h2>Viral Content Ideas</h2>`;
        if (vc.summary) html += `<p style="font-size: 13px; color: #718096;">${escapeHtml(vc.summary)}</p>`;
        for (const idea of vc.ideas) {
            html += `
                <div class="insight-card">
                    <strong>${escapeHtml(idea.idea)}</strong>
                    ${idea.demandScore ? `<span class="label-hint">Demand: ${idea.demandScore}/10</span>` : ''}
                    ${idea.whyViral ? `<p style="font-size: 13px; margin: 6px 0;">${escapeHtml(idea.whyViral)}</p>` : ''}
                    ${idea.suggestedFormats?.length > 0 ? `<p style="font-size: 12px; color: #667eea;">Formats: ${idea.suggestedFormats.join(', ')}</p>` : ''}
                    ${idea.audienceQuotes?.length > 0 ? `<p style="font-size: 12px; color: #a78bfa; font-style: italic;">"${escapeHtml(idea.audienceQuotes[0])}"</p>` : ''}
                </div>
            `;
        }
        html += `</div>`;
    }

    // Top Open Questions (Content Creator)
    if (analysis.topOpenQuestions && analysis.topOpenQuestions.questions?.length > 0) {
        const toq = analysis.topOpenQuestions;
        html += `<div class="section"><h2>Top Open Questions</h2>`;
        if (toq.summary) html += `<p style="font-size: 13px; color: #718096;">${escapeHtml(toq.summary)}</p>`;
        for (const q of toq.questions) {
            html += `
                <div class="quote-box">
                    <strong>${escapeHtml(q.question)}</strong>
                    <div class="quote-author">— @${escapeHtml(q.author || 'anonymous')}${q.score ? ` • ${q.score} ${isYouTube ? 'likes' : 'pts'}` : ''}</div>
                    ${q.contentOpportunity ? `<p style="font-size: 12px; color: #48bb78; margin-top: 4px;">${escapeHtml(q.contentOpportunity)}</p>` : ''}
                </div>
            `;
        }
        html += `</div>`;
    }

    // Pain Points (Marketer)
    if (analysis.painPoints && analysis.painPoints.points?.length > 0) {
        const pp = analysis.painPoints;
        html += `<div class="section"><h2>Pain Points</h2>`;
        if (pp.summary) html += `<p style="font-size: 13px; color: #718096;">${escapeHtml(pp.summary)}</p>`;
        for (const p of pp.points) {
            html += `
                <div class="insight-card" style="border-left-color: ${p.severity === 'high' ? '#e53e3e' : p.severity === 'medium' ? '#d69e2e' : '#48bb78'};">
                    <strong>${escapeHtml(p.pain)}</strong>
                    <span class="priority-badge priority-${p.severity || 'medium'}">${(p.severity || 'medium').toUpperCase()}</span>
                    ${p.frequency ? `<span class="label-hint">${p.frequency}x mentioned</span>` : ''}
                    ${p.marketingAngle ? `<p style="font-size: 13px; color: #48bb78; margin: 6px 0;">Angle: ${escapeHtml(p.marketingAngle)}</p>` : ''}
                    ${p.quotes?.length > 0 ? `<p style="font-size: 12px; color: #a78bfa; font-style: italic;">"${escapeHtml(p.quotes[0].text)}"</p>` : ''}
                </div>
            `;
        }
        html += `</div>`;
    }

    // Key Value Proposition (Marketer)
    if (analysis.keyValueProposition) {
        const kvp = analysis.keyValueProposition;
        html += `
            <div class="section">
                <h2>Key Value Proposition</h2>
                ${kvp.primaryValue ? `<p style="font-size: 16px; font-weight: bold;">${escapeHtml(kvp.primaryValue)}</p>` : ''}
                ${kvp.supportingValues?.length > 0 ? `<p style="font-size: 13px;">Supporting: ${kvp.supportingValues.map(v => escapeHtml(v)).join(' • ')}</p>` : ''}
                ${kvp.userLanguage?.length > 0 ? `<div style="margin-top: 8px;"><p style="font-size: 12px; color: #718096;">In their words:</p>${kvp.userLanguage.map(l => `<p style="font-size: 13px; color: #a78bfa; font-style: italic;">"${escapeHtml(l)}"</p>`).join('')}</div>` : ''}
                ${kvp.differentiators?.length > 0 ? `<p style="font-size: 13px; margin-top: 8px;">Differentiators: ${kvp.differentiators.map(d => escapeHtml(d)).join(', ')}</p>` : ''}
            </div>
        `;
    }

    // Comment Classification
    if (analysis.commentClassification && analysis.commentClassification.breakdown) {
        const cc = analysis.commentClassification;
        const bd = cc.breakdown;
        html += `
            <div class="section">
                <h2>Comment Substance Analysis</h2>
                ${cc.summary ? `<p style="font-size: 13px; color: #718096;">${escapeHtml(cc.summary)}</p>` : ''}
                <div class="stats-grid">
                    <div class="stat-box"><div class="stat-value">${bd.substantive?.percentage || 0}%</div><div class="stat-label">Substantive (${bd.substantive?.count || 0})</div></div>
                    <div class="stat-box"><div class="stat-value">${bd.motivational?.percentage || 0}%</div><div class="stat-label">Motivational (${bd.motivational?.count || 0})</div></div>
                    <div class="stat-box"><div class="stat-value">${bd.conversational?.percentage || 0}%</div><div class="stat-label">Conversational (${bd.conversational?.count || 0})</div></div>
                    <div class="stat-box"><div class="stat-value">${bd.promotional?.percentage || 0}%</div><div class="stat-label">Promotional (${bd.promotional?.count || 0})</div></div>
                </div>
            </div>
        `;
    }

    // Unanswered Questions (legacy)
    if (analysis.unansweredQuestions && analysis.unansweredQuestions.questions?.length > 0) {
        const uq = analysis.unansweredQuestions;
        html += `<div class="section"><h2>Unanswered Questions</h2>`;
        if (uq.summary) html += `<p style="font-size: 13px; color: #718096;">${escapeHtml(uq.summary)}</p>`;
        for (const q of uq.questions) {
            html += `
                <div class="quote-box">
                    <strong>${escapeHtml(q.question)}</strong>
                    <div class="quote-author">— @${escapeHtml(q.author || 'anonymous')} • ${q.score || 0} ${isYouTube ? 'likes' : 'pts'}</div>
                    ${q.contentOpportunity ? `<p style="font-size: 12px; color: #48bb78; margin-top: 4px;">${escapeHtml(q.contentOpportunity)}</p>` : ''}
                </div>
            `;
        }
        html += `</div>`;
    }

    // Spam & Promotions
    if (analysis.spamAndPromotions && analysis.spamAndPromotions.flaggedComments?.length > 0) {
        const sp = analysis.spamAndPromotions;
        html += `<div class="section"><h2>Spam & Promotions <span class="label-hint">${sp.flaggedComments.length} flagged</span></h2>`;
        if (sp.summary) html += `<p style="font-size: 13px; color: #718096;">${escapeHtml(sp.summary)}</p>`;
        for (const f of sp.flaggedComments) {
            html += `
                <div class="insight-card" style="border-left-color: ${f.severity === 'high' ? '#e53e3e' : f.severity === 'medium' ? '#d69e2e' : '#a0aec0'};">
                    <span class="priority-badge priority-${f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'low'}">${(f.type || 'spam').replace(/_/g, ' ')}</span>
                    <p style="font-size: 13px; font-style: italic; margin: 6px 0;">"${escapeHtml(f.snippet || '')}"</p>
                    <p style="font-size: 12px; color: #a0aec0;">— @${escapeHtml(f.author || 'anonymous')}${f.reason ? ` • ${escapeHtml(f.reason)}` : ''}</p>
                </div>
            `;
        }
        html += `</div>`;
    }

    return html;
}

/**
 * Get verdict CSS class for PDF
 */
function getVerdictClassForPDF(verdict) {
    if (!verdict) return 'verdict-mixed';
    const v = verdict.toLowerCase();
    if (v.includes('strongly') || v.includes('supported')) return 'verdict-supported';
    if (v.includes('not') || v.includes('weak')) return 'verdict-not-supported';
    return 'verdict-mixed';
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
    content_creator: {
        role: 'Content Creator',
        outcomes: [
            { id: 'rising_viral', label: 'Viral Content Ideas (Rising Creator)', goal: 'Find what people are talking about in comments that has viral content potential. What does the audience want? Use their exact language, not AI-polished words. Support with quantitative proof.' },
            { id: 'rising_audience', label: 'Audience Discovery (Rising Creator)', goal: 'Identify and segment the audience commenting. Who are they? Demographics, interests, patterns. Show quantitative breakdowns with visual insights.' },
            { id: 'established_engage', label: 'Top Questions & Engagement (Established Creator)', goal: 'Find top open questions posted in comments for engagement or content creation. Identify what the audience is asking that creators can address.' },
            { id: 'established_ideas', label: 'New Content Ideas (Established Creator)', goal: 'Find what people are talking about that has viral content potential. What does the audience want? Use their exact language. Support with quantitative proof and insights.' },
            { id: 'general_research', label: 'General Research', goal: 'Do a comprehensive AI analysis of all comments. Support any recommendations with quantitative insights where possible.' },
            { id: 'free_form', label: 'Other (specify your goal)', isCustom: true }
        ]
    },
    marketer: {
        role: 'Marketer',
        outcomes: [
            { id: 'social_content', label: 'Social Media Content Research', goal: 'Research what resonates with the audience for social media content creation (LinkedIn, TikTok, Instagram, Facebook, X, YouTube). Find hooks, angles, and voice of customer language.' },
            { id: 'pain_points', label: 'Pain Points Analysis', goal: 'Identify pain points with products/services. What are people complaining about? What do they wish was different? Find opportunities for marketing material.' },
            { id: 'kvp', label: 'Key Value Proposition Discovery', goal: 'Identify what users value most, what problems they need solved, and what language they use to describe ideal solutions. Help define or refine the key value proposition.' },
            { id: 'general_research', label: 'General Research', goal: 'Do a comprehensive AI analysis of all comments without a specific marketing lens. Support any recommendations with quantitative insights where possible.' },
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

    // If this tab doesn't have outcome sections (e.g., Community Pulse), just set role
    if (!outcomeSection || !outcomeOptions) {
        // Derive role from personaId for tabs without outcome selection
        const roleMap = {
            product_manager: 'Product Manager',
            marketer: 'Marketer',
            content_creator: 'Content Creator',
            custom: 'Researcher'
        };
        updateHiddenFields(tabId, roleMap[personaId] || 'Researcher', '');
        return;
    }

    if (personaId === 'content_creator') {
        // Content Creator - no outcome selection needed, set role directly
        outcomeSection.style.display = 'none';
        updateHiddenFields(tabId, 'Content Creator', 'Analyze comments to find viral content ideas, audience segments, top questions, and content opportunities. Use the audience exact language - not AI polished. Support with quantitative insights.');
    } else if (personaId === 'marketer') {
        // Marketer - no outcome selection needed, set role directly
        outcomeSection.style.display = 'none';
        updateHiddenFields(tabId, 'Marketer', 'Analyze comments to identify pain points, voice of customer language, key value propositions, audience segments, and marketing opportunities. Support with quantitative insights.');
    } else if (personaId === 'custom') {
        // Show custom inputs
        if (outcomeLabel) outcomeLabel.textContent = 'DEFINE YOUR RESEARCH';
        outcomeOptions.innerHTML = `
            <div class="custom-inputs">
                <div class="custom-input-group">
                    <label>Your Role / Persona</label>
                    <input type="text" id="${tabId}CustomRole" placeholder="e.g., Product Manager, UX Researcher, Founder" onchange="updateCustomSelection('${tabId}')">
                </div>
                <div class="custom-input-group">
                    <label>Specific Goal</label>
                    <input type="text" id="${tabId}CustomGoal" placeholder="e.g., Find top 5 budget hiking shoes, Validate market size" onchange="updateCustomSelection('${tabId}')">
                </div>
            </div>
        `;
        outcomeSection.style.display = 'block';
        updateHiddenFields(tabId, 'Custom', '');
    } else if (!personaOutcomes[personaId]) {
        // Unknown persona (e.g., product_manager from Community Pulse) - treat as custom
        updateHiddenFields(tabId, personaId.replace('_', ' '), '');
        return;
    } else {
        // Fallback for any persona with outcomes
        const persona = personaOutcomes[personaId];
        if (outcomeLabel) outcomeLabel.textContent = `SELECT SPECIFIC OUTCOME FOR ${persona.role.toUpperCase()}`;

        outcomeOptions.innerHTML = persona.outcomes.map((outcome, index) => `
            <div class="outcome-option" onclick="selectOutcome('${tabId}', '${personaId}', '${outcome.id}', '${escapeHtml(outcome.goal || outcome.label)}', ${outcome.isCustom || false})">
                <input type="radio" name="${tabId}Outcome" id="${tabId}_${outcome.id}" ${index === 0 ? 'checked' : ''}>
                <span>${outcome.label}</span>
            </div>
        `).join('') + `
            <div id="${tabId}FreeFormInput" class="free-form-input-container" style="display: none; grid-column: 1 / -1;">
                <input type="text" id="${tabId}FreeFormGoal" placeholder="Describe your specific research goal..." class="free-form-goal-input" onchange="updateFreeFormGoal('${tabId}', '${personaId}')" oninput="updateFreeFormGoal('${tabId}', '${personaId}')">
            </div>
        `;

        outcomeSection.style.display = 'block';
        selectOutcome(tabId, personaId, persona.outcomes[0].id, persona.outcomes[0].goal || persona.outcomes[0].label, false);
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
        // Update hidden fields - outcomeLabel now contains the full goal text
        const persona = personaOutcomes[personaId];
        updateHiddenFields(tabId, persona.role, outcomeLabel);
    }

    // Store selected outcome ID for persona-specific output rendering
    if (!window.selectedOutcomeIds) window.selectedOutcomeIds = {};
    window.selectedOutcomeIds[tabId] = outcomeId;
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
