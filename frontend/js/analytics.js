// Analytics tracking utility (Mixpanel)

const Analytics = {
    /**
     * Track a custom event
     */
    track(eventName, properties = {}) {
        try {
            if (typeof mixpanel !== 'undefined') {
                mixpanel.track(eventName, properties);
            }
        } catch (e) {
            console.warn('Analytics tracking error:', e);
        }
    },

    // ---- Main App Events ----

    trackTabSwitch(tabName) {
        this.track('Tab Switched', { tab: tabName });
    },

    trackAnalyzeUrl(url, role, goal) {
        this.track('URL Analysis Started', {
            has_role: !!role,
            has_goal: !!goal
        });
    },

    trackAnalyzeUrlComplete(url, commentCount) {
        this.track('URL Analysis Completed', {
            comment_count: commentCount
        });
    },

    trackSearchByTopic(researchQuestion, timeRange, limit, searchMethod) {
        this.track('Topic Search Started', {
            time_range: timeRange,
            result_limit: limit,
            search_method: searchMethod,
            has_research_question: !!researchQuestion
        });
    },

    trackSearchByTopicComplete(resultCount, prescreenedCount) {
        this.track('Topic Search Completed', {
            results_found: resultCount,
            prescreened_count: prescreenedCount
        });
    },

    trackSearchSubreddit(subreddit, timeRange, limit) {
        this.track('Subreddit Search Started', {
            subreddit: subreddit,
            time_range: timeRange,
            result_limit: limit
        });
    },

    trackSearchSubredditComplete(subreddit, resultCount) {
        this.track('Subreddit Search Completed', {
            subreddit: subreddit,
            results_found: resultCount
        });
    },

    trackPostsAnalyzed(source, postCount) {
        this.track('Posts Analyzed', {
            source: source,
            post_count: postCount
        });
    },

    trackCommunityPulse(subreddit, depth) {
        this.track('Community Pulse Started', {
            subreddit: subreddit,
            depth: depth
        });
    },

    trackCommunityPulseComplete(subreddit) {
        this.track('Community Pulse Completed', {
            subreddit: subreddit
        });
    },

    trackReanalyze(persona, outcome) {
        this.track('Re-analysis Started', {
            persona: persona,
            outcome: outcome
        });
    },

    trackContentGenerated(contentType, tone, length) {
        this.track('Content Generated', {
            content_type: contentType,
            tone: tone,
            length: length
        });
    },

    trackExportPDF(exportType) {
        this.track('PDF Exported', { type: exportType });
    },

    trackDownloadRawData() {
        this.track('Raw Data Downloaded');
    },

    trackCopyContent(contentType) {
        this.track('Content Copied', { content_type: contentType });
    },

    trackAnalysisTabSwitch(tabName) {
        this.track('Analysis Tab Switched', { tab: tabName });
    },

    trackAnalysisHistorySwitch(index, total) {
        this.track('Analysis History Navigated', {
            index: index,
            total_analyses: total
        });
    },

    trackError(action, errorMessage) {
        this.track('Error Occurred', {
            action: action,
            error: errorMessage
        });
    },

    // ---- Content Radar Events ----

    trackSubredditCheck(subreddit) {
        this.track('Subreddit Checked', { subreddit: subreddit });
    },

    trackSubscribe(subreddit, frequency, hasFocusTopic) {
        this.track('Subscription Created', {
            subreddit: subreddit,
            frequency: frequency,
            has_focus_topic: hasFocusTopic
        });
    },

    trackSubscriptionLookup(subscriptionCount) {
        this.track('Subscriptions Looked Up', {
            subscription_count: subscriptionCount
        });
    },

    trackUnsubscribe(subreddit) {
        this.track('Unsubscribed', { subreddit: subreddit });
    },

    trackResubscribe(subreddit) {
        this.track('Resubscribed', { subreddit: subreddit });
    },

    trackPreviewDigest(subreddit) {
        this.track('Preview Digest Requested', { subreddit: subreddit });
    }
};
