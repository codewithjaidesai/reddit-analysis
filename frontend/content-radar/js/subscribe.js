// Subscribe Page Logic

document.addEventListener('DOMContentLoaded', () => {
    initSubscribePage();
});

let currentSubredditInfo = null;
let autocompleteTimeout = null;

function initSubscribePage() {
    const form = document.getElementById('subscribeForm');
    const checkBtn = document.getElementById('checkSubreddit');
    const subredditInput = document.getElementById('subreddit');

    // Check subreddit button
    checkBtn.addEventListener('click', checkSubreddit);

    // Also check on Enter in subreddit input
    subredditInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkSubreddit();
        }
    });

    // Autocomplete on typing
    subredditInput.addEventListener('input', (e) => {
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

    // Check for pre-filled subreddit from URL
    const urlSubreddit = RadarUtils.getUrlParam('subreddit');
    if (urlSubreddit) {
        subredditInput.value = urlSubreddit;
        checkSubreddit();
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

    if (!currentSubredditInfo) {
        showError('Please check the subreddit first');
        return;
    }

    const email = document.getElementById('email').value.trim();
    const frequency = document.querySelector('input[name="frequency"]:checked')?.value || 'weekly';
    const focusTopic = document.getElementById('focusTopic').value.trim() || null;

    // Safely get subreddit name
    const subreddit = currentSubredditInfo.subreddit?.name ||
                      currentSubredditInfo.subreddit?.subreddit ||
                      document.getElementById('subreddit').value.trim().replace(/^r\//, '');

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
        const data = await RadarAPI.subscribe(email, subreddit, frequency, focusTopic);

        // Save email for convenience
        RadarUtils.saveEmail(email);

        // Show success state
        showSuccess(data, subreddit);

    } catch (error) {
        console.error('Subscribe error:', error);
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

    // Store unsubscribe token for potential use
    if (data.unsubscribeToken) {
        sessionStorage.setItem('lastUnsubscribeToken', data.unsubscribeToken);
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
}
