// State management
let currentAnalysis = null;

// DOM Elements
const urlInput = document.getElementById('redditUrl');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusSection = document.getElementById('statusSection');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const resultsSection = document.getElementById('resultsSection');
const extractedDataCard = document.getElementById('extractedDataCard');
const extractedDataContent = document.getElementById('extractedDataContent');
const insightsCard = document.getElementById('insightsCard');
const insightsContent = document.getElementById('insightsContent');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');

// Event Listeners
analyzeBtn.addEventListener('click', handleAnalyze);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAnalyze();
    }
});

/**
 * Main analysis handler
 */
async function handleAnalyze() {
    const url = urlInput.value.trim();

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
    setButtonLoading(true);
    showStatus('Initializing analysis...', 10);

    try {
        // Call the full analysis endpoint
        const result = await callAPI(API_CONFIG.endpoints.full, { url });

        if (!result.success) {
            throw new Error(result.error || 'Analysis failed');
        }

        // Display results
        showStatus('Analysis complete!', 100);
        await sleep(500);
        displayResults(result);

    } catch (error) {
        console.error('Analysis error:', error);
        showError(error.message || 'An unexpected error occurred');
    } finally {
        setButtonLoading(false);
    }
}

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
 * Display analysis results
 */
function displayResults(result) {
    hideAll();

    const { extractedData, insights } = result;

    // Show extracted data
    if (extractedData) {
        displayExtractedData(extractedData);
    }

    // Show insights
    if (insights && insights.aiAnalysis) {
        displayInsights(insights.aiAnalysis);
    }

    resultsSection.style.display = 'block';
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
                <span>${post.score} upvotes</span> •
                <span>${post.num_comments} comments</span>
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
                    <div class="stat-value">${extractionStats.averageScore}</div>
                    <div class="stat-label">Avg Score</div>
                </div>
            </div>
        </div>
    `;

    extractedDataContent.innerHTML = html;
    extractedDataCard.style.display = 'block';
}

/**
 * Display AI insights
 */
function displayInsights(analysisText) {
    const formattedHtml = formatMarkdown(analysisText);
    insightsContent.innerHTML = formattedHtml;
    insightsCard.style.display = 'block';
}

/**
 * Format markdown to HTML
 */
function formatMarkdown(text) {
    if (!text) return '';

    // Escape HTML first
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Format markdown
    html = html
        // Headers
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bullet lists
        .replace(/^\• (.*$)/gm, '<li>$1</li>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        // Tables (markdown tables)
        .replace(/(?:^|\n)\|(.+)\|[ \t]*\n\|[-:\s|]+\|[ \t]*\n((?:\|.+\|[ \t]*(?:\n|$))+)/gm, function(match, header, rows) {
            let tableHtml = '<table>';

            // Header
            const headers = header.split('|').map(h => h.trim()).filter(h => h);
            if (headers.length > 0) {
                tableHtml += '<thead><tr>';
                headers.forEach(h => {
                    tableHtml += `<th>${h}</th>`;
                });
                tableHtml += '</tr></thead>';
            }

            // Rows
            tableHtml += '<tbody>';
            const rowLines = rows.trim().split('\n').filter(line => line.trim());
            rowLines.forEach((row) => {
                const cells = row.split('|').map(c => c.trim()).filter(c => c);
                if (cells.length > 0) {
                    tableHtml += '<tr>';
                    cells.forEach(cell => {
                        tableHtml += `<td>${cell}</td>`;
                    });
                    tableHtml += '</tr>';
                }
            });

            tableHtml += '</tbody></table>';
            return '\n' + tableHtml + '\n';
        })
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    return '<p>' + html + '</p>';
}

/**
 * Show status message
 */
function showStatus(message, progress) {
    hideAll();
    statusText.textContent = message;
    progressBar.style.width = progress + '%';
    statusSection.style.display = 'block';
}

/**
 * Show error message
 */
function showError(message) {
    hideAll();
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
}

/**
 * Hide all sections
 */
function hideAll() {
    statusSection.style.display = 'none';
    resultsSection.style.display = 'none';
    extractedDataCard.style.display = 'none';
    insightsCard.style.display = 'none';
    errorSection.style.display = 'none';
}

/**
 * Set button loading state
 */
function setButtonLoading(loading) {
    analyzeBtn.disabled = loading;
    const btnText = analyzeBtn.querySelector('.btn-text');
    const btnLoader = analyzeBtn.querySelector('.btn-loader');

    if (loading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
    } else {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

/**
 * Utility: Sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS for stats display
const style = document.createElement('style');
style.textContent = `
    .data-summary h3 {
        color: var(--primary);
        margin-bottom: 10px;
    }

    .meta {
        color: var(--text-secondary);
        font-size: 0.9rem;
    }

    .stats {
        display: flex;
        gap: 20px;
        justify-content: space-around;
        padding: 20px;
        background: white;
        border-radius: 8px;
        border: 1px solid var(--border);
    }

    .stat-item {
        text-align: center;
    }

    .stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--primary);
    }

    .stat-label {
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin-top: 5px;
    }
`;
document.head.appendChild(style);
