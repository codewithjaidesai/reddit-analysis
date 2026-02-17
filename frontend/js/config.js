// API Configuration
//
// INSTRUCTIONS FOR NON-CODERS:
// After you deploy the backend to Vercel, you'll get a URL.
// Replace the URL below with your actual backend URL.
//
// Example: If your backend is at https://reddit-analyzer-xyz.vercel.app
// Change the line below to:
// baseUrl: 'https://reddit-analyzer-xyz.vercel.app',

const API_CONFIG = {
    // Backend URL - Updated: 2025-12-03
    baseUrl: 'https://reddit-analysis.vercel.app',

    endpoints: {
        extract: '/api/analyze/extract',
        insights: '/api/analyze/insights',
        full: '/api/analyze/full',
        combined: '/api/analyze/combined',
        auto: '/api/analyze/auto',
        reanalyze: '/api/analyze/reanalyze',
        generate: '/api/analyze/generate',
        prescreen: '/api/search/prescreen',
        userAnalysis: '/api/analyze/user'
    }
};
