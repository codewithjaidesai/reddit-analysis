// Manage Subscriptions Page Logic

document.addEventListener('DOMContentLoaded', () => {
    initManagePage();
});

let currentSubscriptions = [];
let currentEmail = '';

function initManagePage() {
    const lookupForm = document.getElementById('lookupForm');
    lookupForm.addEventListener('submit', handleLookup);

    // Pre-fill email if saved
    const savedEmail = RadarUtils.getSavedEmail();
    if (savedEmail) {
        document.getElementById('lookupEmail').value = savedEmail;
    }

    // Check for email in URL
    const urlEmail = RadarUtils.getUrlParam('email');
    if (urlEmail) {
        document.getElementById('lookupEmail').value = urlEmail;
        handleLookup(new Event('submit'));
    }
}

async function handleLookup(e) {
    e.preventDefault();

    const email = document.getElementById('lookupEmail').value.trim();
    if (!email) {
        showError('Please enter an email address');
        return;
    }

    const lookupBtn = document.querySelector('.lookup-btn');
    const btnText = lookupBtn.querySelector('.btn-text');
    const btnLoading = lookupBtn.querySelector('.btn-loading');

    // Show loading
    lookupBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'block';

    try {
        const data = await RadarAPI.getSubscriptions(email);
        currentEmail = email;
        currentSubscriptions = data.subscriptions;

        // Save email
        RadarUtils.saveEmail(email);

        if (currentSubscriptions.length === 0) {
            showEmptyState();
        } else {
            showSubscriptions();
        }

    } catch (error) {
        showError(error.message || 'Failed to load subscriptions');
    } finally {
        lookupBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

function showSubscriptions() {
    // Hide other states
    document.getElementById('emailLookup').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';

    // Show subscriptions list
    const listEl = document.getElementById('subscriptionsList');
    listEl.style.display = 'block';

    // Update count
    document.getElementById('subscriptionCount').textContent =
        `${currentSubscriptions.length} active`;

    // Render subscriptions
    const container = document.getElementById('subscriptionsContainer');
    container.innerHTML = '';

    currentSubscriptions.forEach(sub => {
        const card = createSubscriptionCard(sub);
        container.appendChild(card);
    });
}

function createSubscriptionCard(subscription) {
    const card = document.createElement('div');
    card.className = 'subscription-card';
    card.dataset.id = subscription.id;
    card.dataset.token = subscription.unsubscribeToken;

    card.innerHTML = `
        <div class="card-header">
            <span class="subreddit-name">r/${subscription.subreddit}</span>
            <span class="frequency-badge">${capitalizeFirst(subscription.frequency)}</span>
        </div>
        <div class="card-details">
            <div class="detail">
                <span class="detail-label">Focus:</span>
                <span class="focus-topic">${subscription.focusTopic || 'None'}</span>
            </div>
            <div class="detail">
                <span class="detail-label">Last digest:</span>
                <span class="last-sent">${RadarUtils.formatRelativeTime(subscription.lastSentAt)}</span>
            </div>
            <div class="detail">
                <span class="detail-label">Subscribed:</span>
                <span class="created-at">${RadarUtils.formatRelativeTime(subscription.createdAt)}</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="action-btn edit-btn" onclick="editSubscription('${subscription.id}')">
                Edit
            </button>
            <button class="action-btn unsubscribe-btn" onclick="unsubscribeClick('${subscription.unsubscribeToken}', '${subscription.subreddit}')">
                Unsubscribe
            </button>
        </div>
    `;

    return card;
}

function showEmptyState() {
    document.getElementById('emailLookup').style.display = 'none';
    document.getElementById('subscriptionsList').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
}

function showError(message) {
    document.getElementById('subscriptionsList').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'block';
}

function resetLookup() {
    document.getElementById('emailLookup').style.display = 'block';
    document.getElementById('subscriptionsList').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';

    currentSubscriptions = [];
    currentEmail = '';
}

function editSubscription(subscriptionId) {
    // For now, show an alert. In the future, this could open a modal.
    alert('Edit functionality coming soon! For now, you can unsubscribe and resubscribe with new settings.');
}

function unsubscribeClick(token, subreddit) {
    if (confirm(`Are you sure you want to unsubscribe from r/${subreddit}?`)) {
        // Redirect to unsubscribe page with token
        window.location.href = `unsubscribe.html?token=${encodeURIComponent(token)}`;
    }
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
