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
    // 👇 PASTE YOUR BACKEND URL HERE (between the quotes)
    baseUrl: 'PASTE_YOUR_BACKEND_URL_HERE',

    endpoints: {
        extract: '/api/analyze/extract',
        insights: '/api/analyze/insights',
        full: '/api/analyze/full'
    }
};
