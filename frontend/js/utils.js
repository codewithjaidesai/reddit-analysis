// Utility functions

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
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format engagement tier badge
 */
function getEngagementBadge(tier) {
    const badges = {
        viral: '<span class="engagement-badge engagement-viral">⭐ VIRAL</span>',
        high: '<span class="engagement-badge engagement-high">🔥 High Engagement</span>',
        medium: '<span class="engagement-badge engagement-medium">📈 Medium</span>',
        low: '<span class="engagement-badge engagement-low">Low</span>'
    };
    return badges[tier] || '';
}

/**
 * Format large numbers
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}
