// Unsubscribe Page Logic

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

    // Load subscription info
    try {
        const data = await RadarAPI.getUnsubscribeInfo(currentToken);
        currentSubscription = data.subscription;

        if (!currentSubscription.isActive) {
            // Already unsubscribed
            showAlreadyUnsubscribed();
        } else {
            // Show confirmation
            showConfirmation();
        }

    } catch (error) {
        showError(error.message || 'Could not find this subscription.');
    }
}

function showConfirmation() {
    hideAllStates();

    // Update UI with subscription details
    document.getElementById('subredditName').textContent = currentSubscription.subreddit;
    document.getElementById('frequencyText').textContent =
        `${capitalizeFirst(currentSubscription.frequency || 'Weekly')} digest`;

    document.getElementById('confirmState').style.display = 'block';

    // Set up confirm button
    document.getElementById('confirmUnsubscribe').addEventListener('click', handleUnsubscribe);
}

async function handleUnsubscribe() {
    const confirmBtn = document.getElementById('confirmUnsubscribe');
    const btnText = confirmBtn.querySelector('.btn-text');
    const btnLoading = confirmBtn.querySelector('.btn-loading');

    // Show loading
    confirmBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';

    try {
        await RadarAPI.unsubscribe(currentToken);
        showSuccess();

    } catch (error) {
        alert(error.message || 'Failed to unsubscribe. Please try again.');
    } finally {
        confirmBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

function showSuccess() {
    hideAllStates();

    document.getElementById('unsubSubreddit').textContent = currentSubscription.subreddit;
    document.getElementById('successState').style.display = 'block';

    // Set up feedback submission
    document.getElementById('submitFeedback').addEventListener('click', submitFeedback);

    // Set up resubscribe button
    document.getElementById('resubscribeBtn').addEventListener('click', handleResubscribe);
}

async function submitFeedback() {
    const selectedReason = document.querySelector('input[name="reason"]:checked');

    if (!selectedReason) {
        alert('Please select a reason');
        return;
    }

    // In a real implementation, you'd send this to the server
    // For now, just show a thank you message
    const feedbackSection = document.querySelector('.feedback-section');
    feedbackSection.innerHTML = '<p style="color: var(--success);">Thank you for your feedback!</p>';
}

async function handleResubscribe() {
    const resubscribeBtn = document.getElementById('resubscribeBtn');
    resubscribeBtn.disabled = true;
    resubscribeBtn.textContent = 'Resubscribing...';

    try {
        await RadarAPI.resubscribe(currentToken);

        // Show success message and redirect
        alert('Successfully resubscribed!');
        window.location.href = 'manage.html';

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
    document.getElementById('resubscribeBtn2').addEventListener('click', handleResubscribe);
}

function showError(message) {
    hideAllStates();
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'block';
}

function hideAllStates() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('confirmState').style.display = 'none';
    document.getElementById('successState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('alreadyUnsubState').style.display = 'none';
}

function pauseSubscription() {
    // TODO: Implement pause functionality
    alert('Pause functionality coming soon!');
}

function changeFrequency() {
    // TODO: Implement frequency change
    alert('Frequency change coming soon! For now, please unsubscribe and resubscribe with new settings.');
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
