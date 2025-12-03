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

POST BODY:
${post.selftext || '[No body text - link or image post]'}

═══════════════════════════════════════════════════════════════════════════
HIGH-VALUE COMMENTS (${valuableComments.length} comments)
═══════════════════════════════════════════════════════════════════════════

`;

    valuableComments.forEach((comment, index) => {
        output += `
────────────────────────────────────────────────────────────────────────────
COMMENT #${index + 1}
────────────────────────────────────────────────────────────────────────────
Author: u/${comment.author}
Score: ${comment.score} upvotes${comment.awards > 0 ? ` | Awards: ${comment.awards}` : ''}

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
            <h1>📄 ${escapeHtml(post.title)}</h1>

            <div class="meta">
                Posted by u/${escapeHtml(post.author)} •
                ${post.score} upvotes •
                ${post.num_comments} comments
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

            ${valuableComments.map((comment, index) => `
                <div class="comment">
                    <div class="comment-header">
                        #${index + 1} • u/${escapeHtml(comment.author)} • ${comment.score} upvotes${comment.awards > 0 ? ` • ${comment.awards} awards` : ''}
                    </div>
                    <div class="comment-body">${escapeHtml(comment.body)}</div>
                </div>
            `).join('')}

            <div class="meta" style="margin-top: 30px; text-align: center; font-size: 12px;">
                Exported: ${new Date().toLocaleString()}<br>
                Reddit Analyzer v2.0
            </div>

            <div class="no-print" style="position: fixed; top: 20px; right: 20px;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    🖨️ Print / Save as PDF
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
