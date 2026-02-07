// Unsubscribe Page Logic
// 1-step unsubscribe: automatically unsubscribes on page load

document.addEventListener('DOMContentLoaded', () => {
    initUnsubscribePage();
});

let currentToken = null;
let currentSubscription = null;

async function initUnsubscribePage() {
    // Get token from URL
    currentToken = RadarUtils.getUrlParam('token');

    if (!currentToken) {
        showError('Invalid unsubscribe link. No token provided.');
        return;
    }

    // First check subscription status, then auto-unsubscribe if active
    try {
        const data = await RadarAPI.getUnsubscribeInfo(currentToken);
        currentSubscription = data.subscription;

        if (!currentSubscription.isActive) {
            showAlreadyUnsubscribed();
            return;
        }

        // Auto-unsubscribe immediately
        await RadarAPI.unsubscribe(currentToken);
        showSuccess();

    } catch (error) {
        showError(error.message || 'Could not process this unsubscribe request.');
    }
}

function showSuccess() {
    hideAllStates();

    document.getElementById('unsubSubreddit').textContent = currentSubscription.subreddit;
    document.getElementById('successState').style.display = 'block';

    // Set up resubscribe button
    document.getElementById('resubscribeBtn').addEventListener('click', handleResubscribe);
}

async function handleResubscribe() {
    const resubscribeBtn = document.getElementById('resubscribeBtn');
    resubscribeBtn.disabled = true;
    resubscribeBtn.textContent = 'Resubscribing...';

    try {
        await RadarAPI.resubscribe(currentToken);

        // Show inline confirmation instead of alert
        resubscribeBtn.textContent = 'Resubscribed!';
        resubscribeBtn.style.background = 'var(--success, #10b981)';
        setTimeout(() => {
            window.location.href = 'manage.html';
        }, 1000);

    } catch (error) {
        alert(error.message || 'Failed to resubscribe. Please try again.');
        resubscribeBtn.disabled = false;
        resubscribeBtn.textContent = 'Resubscribe';
    }
}

function showAlreadyUnsubscribed() {
    hideAllStates();
    document.getElementById('alreadyUnsubState').style.display = 'block';

    // Set up resubscribe button
    document.getElementById('resubscribeBtn2').addEventListener('click', handleResubscribe2);
}

async function handleResubscribe2() {
    const resubscribeBtn = document.getElementById('resubscribeBtn2');
    resubscribeBtn.disabled = true;
    resubscribeBtn.textContent = 'Resubscribing...';

    try {
        await RadarAPI.resubscribe(currentToken);
        resubscribeBtn.textContent = 'Resubscribed!';
        resubscribeBtn.style.background = 'var(--success, #10b981)';
        setTimeout(() => {
            window.location.href = 'manage.html';
        }, 1000);

    } catch (error) {
        alert(error.message || 'Failed to resubscribe. Please try again.');
        resubscribeBtn.disabled = false;
        resubscribeBtn.textContent = 'Resubscribe';
    }
}

function showError(message) {
    hideAllStates();
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'block';
}

function hideAllStates() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('successState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('alreadyUnsubState').style.display = 'none';
}
