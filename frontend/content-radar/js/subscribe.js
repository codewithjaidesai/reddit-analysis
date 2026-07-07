// Subscribe Page Logic

document.addEventListener('DOMContentLoaded', () => {
    initSubscribePage();
});

let currentSubredditInfo = null;
let autocompleteTimeout = null;

// Per-type input labels — the same input serves all four radar types
const RADAR_TYPE_COPY = {
    subreddit: {
        heading: 'Subscribe to a Community',
        subtitle: 'A weekly pulse of one subreddit, delivered to your inbox',
        label: 'Which subreddit do you want to follow?',
        prefix: 'r/',
        placeholder: 'artificialintelligence',
        hint: 'Popular: artificialintelligence, recipes, WeightLossAdvice, menopause',
        showCheck: true,
        showFocus: true
    },
    topic: {
        heading: 'Set Up a Topic Radar',
        subtitle: 'Track a topic across all of Reddit — new discussions in your inbox',
        label: 'What topic do you want to track across Reddit?',
        prefix: '🔍',
        placeholder: 'ai video editing tools',
        hint: 'A weekly digest of genuinely relevant discussions — quiet weeks are skipped, never padded',
        showCheck: false,
        showFocus: false
    },
    leads: {
        heading: 'Set Up a Lead Radar',
        subtitle: 'Get alerted when people ask for what you offer',
        label: 'What product or service category do you offer?',
        prefix: '🎯',
        placeholder: 'social media scheduling tool',
        hint: 'We watch for fresh posts from people actively looking for this — with a suggested way to help',
        showCheck: false,
        showFocus: false
    },
    learning: {
        heading: 'Set Up a Learning Digest',
        subtitle: 'Learn a subject from the best threads, in the writers’ own words',
        label: 'What subject do you want to learn about?',
        prefix: '🧠',
        placeholder: 'roman history',
        hint: 'The best explanations, surprising facts, and expert corrections — quoted verbatim from top threads',
        showCheck: false,
        showFocus: false
    }
};

function getSelectedRadarType() {
    return document.querySelector('input[name="radarType"]:checked')?.value || 'subreddit';
}

function applyRadarTypeUI(type) {
    const copy = RADAR_TYPE_COPY[type] || RADAR_TYPE_COPY.subreddit;
    const heading = document.getElementById('subscribeHeading');
    const subtitle = document.getElementById('subscribeSubtitle');
    const label = document.getElementById('targetLabel');
    const prefix = document.getElementById('targetPrefix');
    const hint = document.getElementById('targetHint');
    const input = document.getElementById('subreddit');
    const checkBtn = document.getElementById('checkSubreddit');
    const infoCard = document.getElementById('subredditInfo');
    const freqGroup = document.getElementById('frequencyGroup');
    const emailGroup = document.getElementById('emailGroup');
    const focusGroup = document.getElementById('focusGroup');
    const formActions = document.getElementById('formActions');

    if (heading) heading.textContent = copy.heading;
    if (subtitle) subtitle.textContent = copy.subtitle;
    if (label) label.textContent = copy.label;
    if (prefix) prefix.textContent = copy.prefix;
    if (hint) hint.textContent = copy.hint;
    if (input) input.placeholder = copy.placeholder;
    if (checkBtn) checkBtn.style.display = copy.showCheck ? '' : 'none';
    hideAutocomplete();

    if (!copy.showCheck) {
        // Query radars skip the subreddit check step — show the whole form
        // (frequency, email, subscribe button) immediately
        currentSubredditInfo = null;
        if (infoCard) infoCard.style.display = 'none';
        if (freqGroup) freqGroup.style.display = 'block';
        if (emailGroup) emailGroup.style.display = 'block';
        if (focusGroup) focusGroup.style.display = copy.showFocus ? 'block' : 'none';
        if (formActions) formActions.style.display = 'block';
    } else {
        // Community radar reveals the form only after a successful Check —
        // re-hide everything unless a subreddit is already verified
        const checked = !!currentSubredditInfo;
        if (infoCard) infoCard.style.display = checked ? 'block' : 'none';
        if (freqGroup) freqGroup.style.display = checked ? 'block' : 'none';
        if (emailGroup) emailGroup.style.display = checked ? 'block' : 'none';
        if (focusGroup) focusGroup.style.display = checked ? 'block' : 'none';
        if (formActions) formActions.style.display = checked ? 'block' : 'none';
    }
}

function initSubscribePage() {
    const form = document.getElementById('subscribeForm');
    const checkBtn = document.getElementById('checkSubreddit');
    const subredditInput = document.getElementById('subreddit');

    // Radar type switching
    document.querySelectorAll('input[name="radarType"]').forEach(radio => {
        radio.addEventListener('change', () => applyRadarTypeUI(getSelectedRadarType()));
    });

    // Check subreddit button
    checkBtn.addEventListener('click', checkSubreddit);

    // Also check on Enter in subreddit input (community radar only)
    subredditInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (getSelectedRadarType() === 'subreddit') checkSubreddit();
        }
    });

    // Autocomplete on typing (community radar only)
    subredditInput.addEventListener('input', (e) => {
        if (getSelectedRadarType() !== 'subreddit') {
            hideAutocomplete();
            return;
        }
        const value = e.target.value.trim();
        if (value.length >= 2) {
            // Debounce autocomplete
            clearTimeout(autocompleteTimeout);
            autocompleteTimeout = setTimeout(() => {
                showAutocomplete(value);
            }, 300);
        } else {
            hideAutocomplete();
        }
    });

    // Hide autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.subreddit-input-wrapper')) {
            hideAutocomplete();
        }
    });

    // Form submission
    form.addEventListener('submit', handleSubmit);

    // Pre-fill email if saved
    const savedEmail = RadarUtils.getSavedEmail();
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
    }

    // Pre-fill from URL: ?type=topic&query=... (e.g. "Watch this topic" from the main app)
    const urlType = RadarUtils.getUrlParam('type');
    const urlQuery = RadarUtils.getUrlParam('query');
    if (urlType && RADAR_TYPE_COPY[urlType] && urlType !== 'subreddit') {
        const radio = document.querySelector(`input[name="radarType"][value="${urlType}"]`);
        if (radio) radio.checked = true;
        applyRadarTypeUI(urlType);
        if (urlQuery) subredditInput.value = urlQuery;
    } else {
        // Check for pre-filled subreddit from URL
        const urlSubreddit = RadarUtils.getUrlParam('subreddit');
        if (urlSubreddit) {
            subredditInput.value = urlSubreddit;
            checkSubreddit();
        }
    }

    // Create autocomplete container
    createAutocompleteContainer();
}

function createAutocompleteContainer() {
    const wrapper = document.querySelector('.subreddit-input-wrapper');
    if (!wrapper.querySelector('.autocomplete-dropdown')) {
        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-top: none;
            border-radius: 0 0 8px 8px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 100;
            display: none;
        `;
        wrapper.style.position = 'relative';
        wrapper.appendChild(dropdown);
    }
}

async function showAutocomplete(query) {
    const dropdown = document.querySelector('.autocomplete-dropdown');
    if (!dropdown) return;

    try {
        // Use Reddit's search API for subreddit suggestions
        const response = await fetch(
            `${RADAR_CONFIG.baseUrl}/api/search/subreddit-autocomplete?q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
            // Fallback: show popular suggestions that match
            const popular = ['artificialintelligence', 'recipes', 'WeightLossAdvice', 'menopause',
                           'productivity', 'Fitness', 'personalfinance', 'technology', 'cooking',
                           'nutrition', 'selfimprovement', 'Entrepreneur', 'startups', 'SaaS'];
            const matches = popular.filter(s => s.toLowerCase().includes(query.toLowerCase()));

            if (matches.length > 0) {
                renderAutocomplete(matches.slice(0, 5));
            } else {
                hideAutocomplete();
            }
            return;
        }

        const data = await response.json();
        if (data.subreddits && data.subreddits.length > 0) {
            renderAutocomplete(data.subreddits.slice(0, 5));
        } else {
            hideAutocomplete();
        }
    } catch (err) {
        // On error, show popular matches
        const popular = ['artificialintelligence', 'recipes', 'WeightLossAdvice', 'menopause'];
        const matches = popular.filter(s => s.toLowerCase().includes(query.toLowerCase()));
        if (matches.length > 0) {
            renderAutocomplete(matches);
        } else {
            hideAutocomplete();
        }
    }
}

function renderAutocomplete(subreddits) {
    const dropdown = document.querySelector('.autocomplete-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = subreddits.map(sub => {
        // Handle both string and object formats
        const name = typeof sub === 'string' ? sub : sub.name;
        const subscribers = typeof sub === 'object' && sub.subscribers
            ? ` (${formatSubCount(sub.subscribers)})`
            : '';

        return `
            <div class="autocomplete-item" onclick="selectSubreddit('${name}')" style="
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid var(--border);
                transition: background 0.2s;
            " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
                <span style="color: var(--text-primary)">r/${name}</span>
                <span style="color: var(--text-muted); font-size: 0.85em;">${subscribers}</span>
            </div>
        `;
    }).join('');

    dropdown.style.display = 'block';
}

function formatSubCount(count) {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M members';
    if (count >= 1000) return (count / 1000).toFixed(0) + 'K members';
    return count + ' members';
}

function hideAutocomplete() {
    const dropdown = document.querySelector('.autocomplete-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

function selectSubreddit(name) {
    document.getElementById('subreddit').value = name;
    hideAutocomplete();
    checkSubreddit();
}

async function checkSubreddit() {
    const subredditInput = document.getElementById('subreddit');
    const subreddit = subredditInput.value.trim().replace(/^r\//, '');

    if (!subreddit) {
        showError('Please enter a subreddit name');
        return;
    }

    const checkBtn = document.getElementById('checkSubreddit');
    const infoCard = document.getElementById('subredditInfo');

    // Show loading state
    checkBtn.disabled = true;
    checkBtn.textContent = '...';
    hideError();
    hideAutocomplete();

    try {
        const data = await RadarAPI.getSubredditInfo(subreddit);

        // Check for API error
        if (!data.success) {
            throw new Error(data.error || 'Subreddit not found');
        }

        currentSubredditInfo = data;
        Analytics.trackSubredditCheck(subreddit);

        // Safely get subreddit name
        const subName = data.subreddit?.name || data.subreddit?.subreddit || subreddit;
        const subscribers = data.subreddit?.subscribers || 0;
        const activityLevel = data.activity?.level || 'unknown';
        const reason = data.activity?.reason || 'Weekly digest recommended.';
        const recommendedFreq = data.activity?.recommendedFrequency || 'weekly';

        // Update info card
        document.getElementById('subredditTitle').textContent = `r/${subName}`;
        document.getElementById('subscriberCount').textContent = RadarUtils.formatNumber(subscribers);
        document.getElementById('activityLevel').textContent = RadarUtils.formatActivityLevel(activityLevel);
        document.getElementById('frequencyReason').textContent = reason;

        // Pre-select recommended frequency
        const freqRadio = document.querySelector(`input[name="frequency"][value="${recommendedFreq}"]`);
        if (freqRadio) freqRadio.checked = true;

        // Show info card and remaining fields
        infoCard.style.display = 'block';
        document.getElementById('frequencyGroup').style.display = 'block';
        document.getElementById('emailGroup').style.display = 'block';
        document.getElementById('focusGroup').style.display = 'block';
        document.getElementById('formActions').style.display = 'block';

        // Focus email input
        document.getElementById('email').focus();

    } catch (error) {
        console.error('Check subreddit error:', error);
        showError(error.message || `Could not find r/${subreddit}`);
        currentSubredditInfo = null;
        infoCard.style.display = 'none';
    } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check';
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    const radarType = getSelectedRadarType();
    const isQueryRadar = radarType !== 'subreddit';

    if (!isQueryRadar && !currentSubredditInfo) {
        showError('Please check the subreddit first');
        return;
    }

    const email = document.getElementById('email').value.trim();
    const frequency = document.querySelector('input[name="frequency"]:checked')?.value || 'weekly';
    const focusTopic = document.getElementById('focusTopic')?.value.trim() || null;

    // Target: query text for query radars, checked subreddit name for community radar
    const rawInput = document.getElementById('subreddit').value.trim();
    const subreddit = isQueryRadar
        ? rawInput
        : (currentSubredditInfo.subreddit?.name ||
           currentSubredditInfo.subreddit?.subreddit ||
           rawInput.replace(/^r\//, ''));

    if (isQueryRadar && subreddit.length < 3) {
        showError('Please enter at least 3 characters');
        return;
    }

    // Validate email
    if (!email || !email.includes('@')) {
        showError('Please enter a valid email address');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    hideError();

    try {
        const data = await RadarAPI.subscribe(email, subreddit, frequency, focusTopic, radarType);

        // Save email for convenience
        RadarUtils.saveEmail(email);

        // Show success state
        showSuccess(data, subreddit);
        Analytics.trackSubscribe(`${radarType}:${subreddit}`, frequency, !!focusTopic);

    } catch (error) {
        console.error('Subscribe error:', error);
        Analytics.trackError('subscribe', error.message);
        showError(error.message || 'Failed to subscribe. Please try again.');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

function showSuccess(data, fallbackSubreddit) {
    // Hide form, show success
    document.querySelector('.subscribe-form-section').style.display = 'none';
    const successState = document.getElementById('successState');
    successState.style.display = 'block';

    // Update success content - use fallback if needed
    const subName = data.subscription?.subreddit || fallbackSubreddit;
    document.getElementById('successSubreddit').textContent = subName;

    // Update email status message based on whether email was sent
    const emailIcon = document.getElementById('emailStatusIcon');
    const emailTitle = document.getElementById('emailStatusTitle');
    const emailText = document.getElementById('emailStatusText');

    if (data.welcomeEmailSent) {
        emailIcon.textContent = '📬';
        emailTitle.textContent = 'Check your inbox!';
        emailText.textContent = 'We sent you a welcome email with what to expect.';
    } else {
        emailIcon.textContent = '📅';
        emailTitle.textContent = 'You\'re all set!';
        emailText.textContent = 'Your first digest will arrive on the scheduled day.';
    }

    // Format next digest date
    if (data.nextDigestDate) {
        document.getElementById('nextDigestDate').textContent = RadarUtils.formatDate(data.nextDigestDate);
    }

    // Store subscription info for preview digest
    if (data.unsubscribeToken) {
        sessionStorage.setItem('lastUnsubscribeToken', data.unsubscribeToken);
    }
    if (data.subscription?.id) {
        sessionStorage.setItem('lastSubscriptionId', data.subscription.id);
    }
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    errorText.textContent = message;
    errorEl.style.display = 'flex';
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function resetForm() {
    // Reset to initial state
    document.querySelector('.subscribe-form-section').style.display = 'block';
    document.getElementById('successState').style.display = 'none';

    // Clear form
    document.getElementById('subreddit').value = '';
    document.getElementById('focusTopic').value = '';

    // Hide optional sections
    document.getElementById('subredditInfo').style.display = 'none';
    document.getElementById('frequencyGroup').style.display = 'none';
    document.getElementById('emailGroup').style.display = 'none';
    document.getElementById('focusGroup').style.display = 'none';
    document.getElementById('formActions').style.display = 'none';

    // Reset state
    currentSubredditInfo = null;
    hideError();
    hideAutocomplete();

    // Focus subreddit input
    document.getElementById('subreddit').focus();

    // Reset preview section
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
        previewSection.style.display = 'block';
        const previewBtn = document.getElementById('sendPreviewBtn');
        if (previewBtn) {
            previewBtn.disabled = false;
            previewBtn.querySelector('.btn-text').style.display = 'block';
            previewBtn.querySelector('.btn-loading').style.display = 'none';
        }
        const previewResult = document.getElementById('previewResult');
        if (previewResult) {
            previewResult.style.display = 'none';
        }
    }
}

// Send preview digest
async function sendPreviewDigest() {
    Analytics.trackPreviewDigest('unknown');
    const subscriptionId = sessionStorage.getItem('lastSubscriptionId');
    const token = sessionStorage.getItem('lastUnsubscribeToken');

    if (!subscriptionId && !token) {
        showPreviewResult(false, 'No subscription found. Please subscribe first.');
        return;
    }

    const btn = document.getElementById('sendPreviewBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');
    const previewResult = document.getElementById('previewResult');

    // Show loading state
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    previewResult.style.display = 'none';

    try {
        const response = await fetch(`${RADAR_CONFIG.baseUrl}/api/radar/send-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subscriptionId: subscriptionId,
                token: token
            })
        });

        const data = await response.json();

        if (data.success) {
            showPreviewResult(true, 'Digest sent! Check your inbox in a minute.');
            // Hide the preview section after success
            setTimeout(() => {
                document.getElementById('previewSection').style.display = 'none';
            }, 5000);
        } else {
            throw new Error(data.error || 'Failed to send preview');
        }

    } catch (error) {
        console.error('Preview error:', error);
        showPreviewResult(false, error.message || 'Failed to send preview. Please try again.');
        btn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

function showPreviewResult(success, message) {
    const previewResult = document.getElementById('previewResult');
    previewResult.className = `preview-result ${success ? 'success' : 'error'}`;
    previewResult.textContent = message;
    previewResult.style.display = 'block';
}
