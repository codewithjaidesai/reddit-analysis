// Subscribe Page Logic

document.addEventListener('DOMContentLoaded', () => {
    initSubscribePage();
});

let currentSubredditInfo = null;

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

    try {
        const data = await RadarAPI.getSubredditInfo(subreddit);
        currentSubredditInfo = data;

        // Update info card
        document.getElementById('subredditTitle').textContent = `r/${data.subreddit.name}`;
        document.getElementById('subscriberCount').textContent = RadarUtils.formatNumber(data.subreddit.subscribers);
        document.getElementById('activityLevel').textContent = RadarUtils.formatActivityLevel(data.activity.level);
        document.getElementById('frequencyReason').textContent = data.activity.reason;

        // Pre-select recommended frequency
        const recommendedFreq = data.activity.recommendedFrequency || 'weekly';
        document.querySelector(`input[name="frequency"][value="${recommendedFreq}"]`).checked = true;

        // Show info card and remaining fields
        infoCard.style.display = 'block';
        document.getElementById('frequencyGroup').style.display = 'block';
        document.getElementById('emailGroup').style.display = 'block';
        document.getElementById('focusGroup').style.display = 'block';
        document.getElementById('formActions').style.display = 'block';

        // Focus email input
        document.getElementById('email').focus();

    } catch (error) {
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
    const frequency = document.querySelector('input[name="frequency"]:checked').value;
    const focusTopic = document.getElementById('focusTopic').value.trim() || null;
    const subreddit = currentSubredditInfo.subreddit.name;

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
        showSuccess(data);

    } catch (error) {
        showError(error.message || 'Failed to subscribe. Please try again.');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

function showSuccess(data) {
    // Hide form, show success
    document.querySelector('.subscribe-form-section').style.display = 'none';
    const successState = document.getElementById('successState');
    successState.style.display = 'block';

    // Update success content
    document.getElementById('successSubreddit').textContent = data.subscription.subreddit;

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

    // Focus subreddit input
    document.getElementById('subreddit').focus();
}
