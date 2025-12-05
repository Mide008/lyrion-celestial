/**
 * LYRĪON - Global Configuration
 * Centralized Stripe keys and API endpoints
 */

const LYRION_CONFIG = {
    // Stripe Keys - LIVE MODE
    STRIPE_PUBLIC_KEY: 'pk_live_51ST0Yr6kwOhs68PfwI2N6I6rKXBx8TKEvkPdwfR7sLpKQiAiQ09QPLpy1XalDPf9Zrs3SL5DkWxKKQjdZq1JoLoP00QdElzZjF',
    
    // Stripe Keys - TEST MODE (for testing without real charges)
    // Uncomment these and comment out the LIVE keys above to test
    // STRIPE_PUBLIC_KEY: 'pk_test_51ST0Yr6kwOhs68PfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    
    // Cloudflare Worker URL
    WORKER_URL: 'https://lyrion-order-broker.hello-2a3.workers.dev',
    
    // Base URL
    BASE_URL: 'https://lyrion.co.uk',
    
    // API Endpoints
    ENDPOINTS: {
        CONTACT: '/contact',
        PRODUCT_CHECKOUT: '/create-payment-intent',
        ORACLE_CHECKOUT: '/create-oracle-session',
        HEALTH: '/health'
    }
};

// Make config available globally
window.LYRION_CONFIG = LYRION_CONFIG;

// Log configuration on load (for debugging - remove in production)
console.log('🔧 LYRĪON Config loaded:', {
    hasStripeKey: !!LYRION_CONFIG.STRIPE_PUBLIC_KEY,
    keyPrefix: LYRION_CONFIG.STRIPE_PUBLIC_KEY.substring(0, 20) + '...',
    workerUrl: LYRION_CONFIG.WORKER_URL,
    baseUrl: LYRION_CONFIG.BASE_URL
});