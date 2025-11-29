// API Configuration
const API_CONFIG = {
    // Change this to your deployed backend URL
    // For local development: 'http://localhost:3000'
    // For Vercel: 'https://your-project.vercel.app'
    // For Railway: 'https://your-project.up.railway.app'
    baseUrl: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://your-backend-url-here.vercel.app', // UPDATE THIS!

    endpoints: {
        extract: '/api/analyze/extract',
        insights: '/api/analyze/insights',
        full: '/api/analyze/full'
    }
};
