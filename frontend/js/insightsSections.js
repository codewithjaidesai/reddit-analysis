// Shared insight section renderers — single source of truth for the
// new-schema analysis sections. Used by:
//   - displayCombinedResults (app.js) — multi-post / topic search flow
//   - displayStructuredInsights (ui.js) — single URL / YouTube flow
// Each builder returns an HTML string ('' when the section has no data).
// opts: { tag: 'h2'|'h3', cls: wrapper class } — defaults match the main flow.

const InsightSections = (() => {

    function sec(opts, title, inner, extraCls = '', subtitle = '') {
        const tag = opts?.tag || 'h2';
        const cls = opts?.cls || 'analysis-section';
        const titleCls = opts?.titleCls ? ` class="${opts.titleCls}"` : (tag === 'h2' ? ' class="section-title"' : '');
        return `
            <div class="${cls} ${extraCls}">
                <${tag}${titleCls}>${title}</${tag}>
                ${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ''}
                ${inner}
            </div>
        `;
    }

    function verdict(structured, opts) {
        const v = structured.theVerdict;
        if (!v) return '';
        const inner = `
            <div class="verdict-card verdict-${v.confidence || 'medium'}">
                <div class="verdict-answer">${escapeHtml(v.answer || '')}</div>
                <div class="verdict-meta">
                    <span class="confidence-badge confidence-${v.confidence || 'medium'}">${(v.confidence || 'medium').toUpperCase()} CONFIDENCE</span>
                    ${v.basis ? `<span class="verdict-basis">${escapeHtml(v.basis)}</span>` : ''}
                </div>
                ${v.keyDataPoints && v.keyDataPoints.length > 0 ? `
                    <div class="verdict-data-points">
                        ${v.keyDataPoints.map(dp => `
                            <div class="verdict-dp">
                                <span class="verdict-dp-arrow">→</span>
                                <span>${escapeHtml(dp)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        return sec(opts, 'THE VERDICT', inner, 'verdict-section');
    }

    function whatBlewUp(structured, opts) {
        const items = structured.whatBlewUp;
        if (!items || items.length === 0) return '';
        const inner = `
            <div class="blew-up-list">
                ${items.map(item => `
                    <div class="blew-up-item">
                        <div class="blew-up-hook">${escapeHtml(item.hook)}</div>
                        ${item.detail ? `<div class="blew-up-detail">${escapeHtml(item.detail)}</div>` : ''}
                        ${item.source ? `<span class="blew-up-source">${escapeHtml(item.source)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        return sec(opts, 'WHAT BLEW UP', inner, 'blew-up-section');
    }

    function actionable(structured, opts) {
        if (!structured.actionableContent || structured.actionableContent.length === 0) return '';

        const tag = opts?.tag || 'h2';
        const cls = opts?.cls || 'analysis-section';
        const titleCls = opts?.titleCls ? ` class="${opts.titleCls}"` : (tag === 'h2' ? ' class="section-title section-title-accent"' : '');
        let out = '';
        const sections = [...structured.actionableContent].sort((a, b) => (a.priority || 99) - (b.priority || 99));

        sections.forEach((section, sIdx) => {
            const items = section.items || [];
            out += `<div class="${cls} actionable-section">
                <${tag}${titleCls}>${escapeHtml(section.sectionTitle || 'Actionable Insights')}</${tag}>`;

            if (section.sectionType === 'phases') {
                out += items.map((item, i) => `
                    <div class="actionable-card actionable-phase">
                        <div class="actionable-card-header">
                            <span class="actionable-label">${escapeHtml(item.label || 'Phase ' + (i + 1))}</span>
                            ${item.meta?.duration ? `<span class="actionable-meta">${escapeHtml(item.meta.duration)}</span>` : ''}
                            ${item.meta?.region ? `<span class="actionable-meta">${escapeHtml(item.meta.region)}</span>` : ''}
                        </div>
                        ${item.description ? `<p class="actionable-desc">${escapeHtml(item.description)}</p>` : ''}
                        ${item.details && item.details.length > 0 ? `<ul class="actionable-details">${item.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
                        ${item.tags && item.tags.length > 0 ? `<div class="actionable-tags">${item.tags.map(t => `<span class="actionable-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                    </div>
                `).join('');

            } else if (section.sectionType === 'picks') {
                out += items.map((item, i) => `
                    <div class="actionable-card actionable-pick ${i === 0 ? 'actionable-pick-top' : ''}">
                        <div class="actionable-card-header">
                            <span class="actionable-label">#${i + 1} ${escapeHtml(item.label)}</span>
                            ${item.meta?.price ? `<span class="actionable-price">${escapeHtml(item.meta.price)}</span>` : ''}
                            ${item.meta?.rating ? `<span class="actionable-rating">${escapeHtml(item.meta.rating)}</span>` : ''}
                        </div>
                        ${item.description ? `<p class="actionable-desc">${escapeHtml(item.description)}</p>` : ''}
                        ${item.details && item.details.length > 0 ? `<ul class="actionable-details actionable-details-muted">${item.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
                    </div>
                `).join('');

            } else if (section.sectionType === 'comparison') {
                out += `<div class="actionable-card actionable-comparison">
                    <table class="actionable-table">
                        ${items.map(item => `
                            <tr>
                                <td class="actionable-table-label">${escapeHtml(item.label)}</td>
                                ${(item.details || []).map(d => `<td>${escapeHtml(d)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </table>
                </div>`;

            } else if (section.sectionType === 'checklist') {
                out += `<div class="actionable-card">
                    ${items.map(item => `
                        <div class="actionable-check-item">
                            <span class="actionable-check-box">☐</span>
                            <div>
                                <span class="actionable-check-label">${escapeHtml(item.label)}</span>
                                ${item.description ? `<p class="actionable-check-desc">${escapeHtml(item.description)}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>`;

            } else if (section.sectionType === 'info') {
                out += `<div class="actionable-card">
                    ${items.map(item => `
                        <div class="actionable-info-row">
                            <span class="actionable-info-key">${escapeHtml(item.label)}</span>
                            <span class="actionable-info-value">${escapeHtml(item.description || '')}</span>
                        </div>
                    `).join('')}
                </div>`;

            } else {
                // Default: tips/advice list (also handles unknown types)
                out += items.map(item => `
                    <div class="actionable-card actionable-tip">
                        <span class="actionable-label">${escapeHtml(item.label)}</span>
                        ${item.description ? `<p class="actionable-desc">${escapeHtml(item.description)}</p>` : ''}
                        ${item.details && item.details.length > 0 ? `<ul class="actionable-details actionable-details-muted">${item.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
                    </div>
                `).join('');
            }

            out += `</div>`;
        });

        return out;
    }

    function trenches(structured, opts) {
        const items = structured.fromTheTrenches;
        if (!items || items.length === 0) return '';
        const inner = `
            <div class="trenches-list">
                ${items.map(item => `
                    <div class="trenches-item">
                        <div class="trenches-insight">${escapeHtml(item.insight)}</div>
                        <div class="trenches-meta">
                            <span class="trenches-author">@${escapeHtml(item.author || 'anon')}</span>
                            ${item.score ? `<span class="trenches-score">${item.score} pts</span>` : ''}
                            ${item.source ? `<span class="trenches-source">${escapeHtml(item.source)}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        return sec(opts, 'FROM THE TRENCHES', inner, 'trenches-section', 'Real data, numbers, and tools people actually shared');
    }

    function asking(structured, opts) {
        const items = structured.whatTheyreAsking;
        if (!items || items.length === 0) return '';
        const inner = `
            <div class="asking-list">
                ${items.map(q => `
                    <div class="asking-item">
                        <div class="asking-question">${escapeHtml(q.question)}</div>
                        <div class="asking-meta">
                            <span class="asking-author">@${escapeHtml(q.author || 'anon')}</span>
                            ${q.score ? `<span class="asking-score">${q.score} pts</span>` : ''}
                        </div>
                        ${q.demandSignal ? `<div class="asking-demand">${escapeHtml(q.demandSignal)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        return sec(opts, "WHAT THEY'RE ASKING", inner, 'asking-section', 'Questions ranked by demand signal');
    }

    function debate(structured, opts) {
        const d = structured.theDebate;
        if (!d || !d.topic) return '';
        const side = (label, s) => `
            <div class="debate-side side-${label.toLowerCase()}">
                <div class="debate-side-label">Side ${label}</div>
                <div class="debate-position">${escapeHtml(s?.position || '')}</div>
                ${s?.quotes ? s.quotes.map(q => `
                    <div class="debate-quote">
                        <span class="debate-quote-text">"${escapeHtml(q.text)}"</span>
                        <span class="debate-quote-meta">@${escapeHtml(q.author || 'anon')} · ${q.score || 0} pts</span>
                    </div>
                `).join('') : ''}
            </div>
        `;
        const inner = `
            <div class="debate-topic">${escapeHtml(d.topic)}</div>
            <div class="debate-sides">
                ${side('A', d.sideA)}
                <div class="debate-vs">VS</div>
                ${side('B', d.sideB)}
            </div>
        `;
        return sec(opts, 'THE DEBATE', inner, 'debate-section');
    }

    function rankedThemes(structured, opts) {
        const themes = structured.rankedThemes;
        if (!themes || themes.length === 0) return '';
        const inner = `
            <div class="ranked-themes-list">
                ${themes.map(theme => `
                    <div class="ranked-theme-card">
                        <div class="ranked-theme-header">
                            <span class="ranked-theme-rank">#${theme.rank || '?'}</span>
                            <span class="ranked-theme-name">${escapeHtml(theme.theme)}</span>
                            <div class="ranked-theme-stats">
                                <span class="ranked-theme-mentions">${theme.mentions || 0}x mentioned</span>
                                ${theme.postsFoundIn ? `<span class="ranked-theme-posts">${theme.postsFoundIn} posts</span>` : ''}
                                <span class="sentiment-badge sentiment-${theme.sentiment || 'neutral'}">${theme.sentiment || 'neutral'}</span>
                            </div>
                        </div>
                        <div class="ranked-theme-oneliner">${escapeHtml(theme.oneLiner || '')}</div>
                        ${theme.topQuote ? `
                            <div class="ranked-theme-quote">
                                <span class="quote-icon">"</span>
                                <span class="ranked-theme-quote-text">"${escapeHtml(theme.topQuote.text || '')}"</span>
                                <span class="ranked-theme-quote-meta">@${escapeHtml(theme.topQuote.author || 'anon')} · ${theme.topQuote.score || 0} pts</span>
                            </div>
                        ` : ''}
                        ${theme.nuance ? `<div class="ranked-theme-nuance">${escapeHtml(theme.nuance)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        return sec(opts, 'RANKED THEMES', inner, '', 'Stack-ranked by mention frequency across posts');
    }

    function worthQuoting(structured, opts) {
        const items = structured.worthQuoting;
        if (!items || items.length === 0) return '';
        const inner = `
            <div class="quotes-grid">
                ${items.map(q => `
                    <div class="quote-card quote-${(q.category || 'insight').toLowerCase()}">
                        <span class="quote-type-badge">${(q.category || 'INSIGHT').toUpperCase()}</span>
                        <div class="quote-icon">"</div>
                        <p class="quote-text">"${escapeHtml(q.quote)}"</p>
                        <div class="quote-footer">
                            <span class="quote-source">@${escapeHtml(q.author || 'anon')}</span>
                            ${q.score ? `<span class="quote-score">${q.score} pts</span>` : ''}
                        </div>
                        ${q.context ? `<p class="quote-context">${escapeHtml(q.context)}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        return sec(opts, 'WORTH QUOTING', inner);
    }

    function funny(structured, opts) {
        const items = structured.funnyAndMemorable;
        if (!items || items.length === 0) return '';
        const inner = `
            <div class="funny-list">
                ${items.map(f => `
                    <div class="funny-item">
                        <div class="funny-quote">"${escapeHtml(f.quote)}"</div>
                        <div class="funny-meta">
                            <span class="funny-author">@${escapeHtml(f.author || 'anon')}</span>
                            ${f.score ? `<span class="funny-score">${f.score} pts</span>` : ''}
                        </div>
                        ${f.context ? `<div class="funny-context">${escapeHtml(f.context)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        return sec(opts, 'FUNNY & MEMORABLE', inner, 'funny-section');
    }

    function soWhat(structured, opts) {
        const s = structured.soWhat;
        if (!s || !s.signal) return '';
        const inner = `
            <div class="sowhat-card">
                <div class="sowhat-signal">${escapeHtml(s.signal)}</div>
                ${s.implications && s.implications.length > 0 ? `
                    <div class="sowhat-implications">
                        ${s.implications.map(imp => `
                            <div class="sowhat-implication">
                                <span class="sowhat-arrow">→</span>
                                <span>${escapeHtml(imp)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        return sec(opts, 'SO WHAT', inner, 'sowhat-section');
    }

    function exploreNext(structured, opts) {
        const items = structured.exploreNext;
        if (!items || items.length === 0) return '';
        const angleLabels = {
            deeper: 'GO DEEPER',
            adjacent: 'ADJACENT TOPIC',
            contrarian: 'CONTRARIAN TAKE',
            audience: 'AUDIENCE SEGMENT'
        };
        const inner = `
            <div class="explore-next-list">
                ${items.map(s => `
                    <button class="explore-next-card" onclick="runSuggestedSearch(this.dataset.query)" data-query="${escapeHtml(s.query || '')}">
                        <div class="explore-next-header">
                            <span class="explore-next-angle angle-${escapeHtml(s.angle || 'deeper')}">${angleLabels[s.angle] || 'GO DEEPER'}</span>
                            <span class="explore-next-run">Search →</span>
                        </div>
                        <div class="explore-next-query">${escapeHtml(s.query || '')}</div>
                        ${s.why ? `<div class="explore-next-why">${escapeHtml(s.why)}</div>` : ''}
                    </button>
                `).join('')}
            </div>
        `;
        return sec(opts, 'EXPLORE NEXT', inner, 'explore-next-section', 'Follow-up research suggested by what this data revealed — click to run');
    }

    function confidence(structured, opts) {
        const conf = structured.confidence;
        if (!conf) return '';
        const inner = `
            <div class="confidence-card confidence-${conf.level || 'medium'}">
                <span class="confidence-level">${(conf.level || 'medium').toUpperCase()}</span>
                <span class="confidence-reason">${escapeHtml(conf.dataQuality || conf.reason || '')}</span>
            </div>
            <div class="confidence-details">
                ${conf.totalComments ? `<span class="confidence-stat">${conf.totalComments.toLocaleString()} comments analyzed</span>` : ''}
                ${conf.postsAnalyzed ? `<span class="confidence-stat">${conf.postsAnalyzed} posts</span>` : ''}
                ${conf.relevantComments ? `<span class="confidence-stat">${conf.relevantComments} relevant</span>` : ''}
            </div>
            ${conf.caveats && conf.caveats.length > 0 ? `
                <div class="confidence-caveats">
                    ${conf.caveats.map(c => `<div class="confidence-caveat">${escapeHtml(c)}</div>`).join('')}
                </div>
            ` : ''}
        `;
        return sec(opts, 'CONFIDENCE', inner);
    }

    return {
        verdict, whatBlewUp, actionable, trenches, asking, debate,
        rankedThemes, worthQuoting, funny, soWhat, exploreNext, confidence
    };
})();
