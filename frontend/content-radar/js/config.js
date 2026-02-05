// Content Radar API Configuration

const RADAR_CONFIG = {
    // Backend API URL - frontend is hosted separately from backend
    baseUrl: 'https://reddit-analysis.vercel.app',

    endpoints: {
        subscribe: '/api/radar/subscribe',
        subscriptions: '/api/radar/subscriptions',
        unsubscribe: '/api/radar/unsubscribe',
        resubscribe: '/api/radar/resubscribe',
        subredditInfo: '/api/radar/subreddit',
        digestLatest: '/api/radar/digest',
        health: '/api/radar/health'
    }
};

// API Helper Functions
const RadarAPI = {
    /**
     * Subscribe to a subreddit digest
     */
    async subscribe(email, subreddit, frequency = 'weekly', focusTopic = null) {
        const response = await fetch(`${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.subscribe}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, subreddit, frequency, focusTopic })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to subscribe');
        }
        return data;
    },

    /**
     * Get all subscriptions for an email
     */
    async getSubscriptions(email) {
        const response = await fetch(
            `${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.subscriptions}?email=${encodeURIComponent(email)}`
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to get subscriptions');
        }
        return data;
    },

    /**
     * Get subscription info by unsubscribe token
     */
    async getUnsubscribeInfo(token) {
        const response = await fetch(
            `${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.unsubscribe}?token=${encodeURIComponent(token)}`
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Subscription not found');
        }
        return data;
    },

    /**
     * Unsubscribe using token
     */
    async unsubscribe(token, reason = null) {
        const response = await fetch(`${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.unsubscribe}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, reason })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to unsubscribe');
        }
        return data;
    },

    /**
     * Resubscribe using token
     */
    async resubscribe(token) {
        const response = await fetch(`${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.resubscribe}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to resubscribe');
        }
        return data;
    },

    /**
     * Get subreddit info with activity classification
     */
    async getSubredditInfo(subreddit) {
        const response = await fetch(
            `${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.subredditInfo}/${encodeURIComponent(subreddit)}`
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Subreddit not found');
        }
        return data;
    },

    /**
     * Get latest cached digest for a subreddit
     */
    async getLatestDigest(subreddit) {
        const response = await fetch(
            `${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.digestLatest}/${encodeURIComponent(subreddit)}/latest`
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'No digest found');
        }
        return data;
    },

    /**
     * Check API health
     */
    async healthCheck() {
        try {
            const response = await fetch(`${RADAR_CONFIG.baseUrl}${RADAR_CONFIG.endpoints.health}`);
            const data = await response.json();
            return data.success && data.database === 'connected';
        } catch {
            return false;
        }
    }
};

// Utility Functions
const RadarUtils = {
    /**
     * Format subscriber count
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    },

    /**
     * Format activity level
     */
    formatActivityLevel(level) {
        const levels = {
            high: '🔴 High',
            medium: '🟡 Medium',
            low: '🟢 Low',
            unknown: '⚪ Unknown'
        };
        return levels[level] || levels.unknown;
    },

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    },

    /**
     * Format relative time
     */
    formatRelativeTime(dateString) {
        if (!dateString) return 'Never';

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    /**
     * Get URL parameter
     */
    getUrlParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    /**
     * Store email in localStorage for convenience
     */
    saveEmail(email) {
        localStorage.setItem('radar_email', email);
    },

    /**
     * Get stored email
     */
    getSavedEmail() {
        return localStorage.getItem('radar_email');
    }
};
