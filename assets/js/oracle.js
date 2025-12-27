/**
 * LYRĪON - The Oracle - FIXED VERSION
 * Paid astrology readings with Stripe Checkout integration
 * Corrected Stripe key and redirect logic
 */

// ==========================================
// CONFIGURATION - CORRECTED KEYS
// ==========================================
const STRIPE_PUBLIC_KEY = 'pk_test_51ST0Yr6kwOhs68PfSXjUplI8TAPdMwBDl5p30sKEQkJxZo41A9LQ9aNmmBZW8UYKJpMKL64RTkDzVUEIy29DzVcj00o4lmv3Ga';
const WORKER_URL = 'https://lyrion-order-broker.hello-2a3.workers.dev';

// ==========================================
// ORACLE TIERS
// ==========================================
const ORACLE_TIERS = {
    essence: {
        id: 'essence',
        name: 'Essence Reading',
        price: 25.00,
        description: 'A focused insight into your current cosmic alignment',
        wordCount: '300+ words',
        delivery: '48 hours'
    },
    transit: {
        id: 'transit',
        name: 'Transit Forecast',
        price: 45.00,
        description: 'Current planetary transits affecting your chart',
        wordCount: '600+ words',
        delivery: '24 hours'
    },
    detailed: {
        id: 'detailed',
        name: 'Detailed Reading',
        price: 55.00,
        description: 'Deep exploration of your birth chart and current transits',
        wordCount: '800+ words',
        delivery: '48 hours'
    },
    chiron: {
        id: 'chiron',
        name: 'Chiron Wound Healing',
        price: 55.00,
        description: 'Explore your deepest wounds and path to healing',
        wordCount: '750+ words',
        delivery: '48 hours'
    },
    career: {
        id: 'career',
        name: 'Career & Purpose',
        price: 65.00,
        description: 'Discover your vocational calling and professional path',
        wordCount: '900+ words',
        delivery: '48 hours'
    },
    lifepath: {
        id: 'lifepath',
        name: 'Life Path Reading',
        price: 75.00,
        description: 'Understand your soul\'s journey and destiny',
        wordCount: '1,000+ words',
        delivery: '48 hours'
    },
    natal: {
        id: 'natal',
        name: 'Natal Chart Blueprint',
        price: 85.00,
        description: 'Complete analysis of your birth chart foundations',
        wordCount: '1,200+ words',
        delivery: '48 hours'
    },
    synastry: {
        id: 'synastry',
        name: 'Relationship Synastry',
        price: 95.00,
        description: 'Compatibility analysis between two birth charts',
        wordCount: '1,400+ words',
        delivery: '72 hours'
    },
    premium: {
        id: 'premium',
        name: 'Premium Reading',
        price: 125.00,
        description: 'Comprehensive analysis with personalized ritual guidance',
        wordCount: '1,500+ words',
        delivery: '72 hours'
    },
    blueprint: {
        id: 'blueprint',
        name: 'Full Cosmic Blueprint',
        price: 185.00,
        description: 'The ultimate guide to your cosmic design',
        wordCount: '2,500+ words',
        delivery: '96 hours'
    }
};

// ==========================================
// ORACLE STATE
// ==========================================
let selectedTier = null;
let stripe = null;

// ==========================================
// INITIALIZE ORACLE
// ==========================================
function initOracle() {
    console.log('🔮 Initializing Oracle with correct Stripe key...');
    console.log('Stripe Key:', STRIPE_PUBLIC_KEY.substring(0, 20) + '...');
    console.log('Worker URL:', WORKER_URL);
    
    // Initialize Stripe
    if (typeof Stripe !== 'undefined') {
        stripe = Stripe(STRIPE_PUBLIC_KEY);
        console.log('✅ Stripe initialized with correct key');
    } else {
        console.error('❌ Stripe.js not loaded');
        showError('Payment system failed to load. Please refresh the page.');
        return;
    }
    
    // Setup tier selection
    setupTierSelection();
    
    // Setup modal handlers
    setupModalHandlers();
    
    console.log('✅ Oracle initialized successfully');
}

// ==========================================
// SETUP TIER SELECTION
// ==========================================
function setupTierSelection() {
    const tierCards = document.querySelectorAll('.tier-card');
    console.log(`Found ${tierCards.length} tier cards`);
    
    tierCards.forEach(card => {
        const button = card.querySelector('.tier-select-btn');
        
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const tierId = card.getAttribute('data-tier');
                console.log('🎯 Tier button clicked:', tierId);
                
                if (tierId && ORACLE_TIERS[tierId]) {
                    selectTier(tierId);
                } else {
                    console.error('Invalid tier ID:', tierId);
                }
            });
        }
    });
}

// ==========================================
// SELECT TIER
// ==========================================
function selectTier(tierId) {
    selectedTier = ORACLE_TIERS[tierId];
    
    if (!selectedTier) {
        console.error('Invalid tier:', tierId);
        return;
    }
    
    console.log('Selected tier:', selectedTier);
    
    // Update modal content
    document.getElementById('modalTierName').textContent = selectedTier.name;
    document.getElementById('modalTierDescription').textContent = selectedTier.description;
    document.getElementById('modalSelectedTier').textContent = selectedTier.name;
    document.getElementById('modalPrice').textContent = `£${selectedTier.price.toFixed(2)}`;
    
    // Show modal
    openModal();
}

// ==========================================
// MODAL HANDLERS
// ==========================================
function setupModalHandlers() {
    const modal = document.getElementById('paymentModal');
    const closeBtn = document.getElementById('closeModal');
    const form = document.getElementById('oraclePaymentForm');
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Click outside to close
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Form submission
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

function openModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal opened');
    }
}

function closeModal() {
    const modal = document.getElementById('paymentModal');
    const form = document.getElementById('oraclePaymentForm');
    const errorDiv = document.getElementById('modalErrors');
    
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (form) {
        form.reset();
    }
    
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
    
    console.log('✅ Modal closed');
}

// ==========================================
// HANDLE FORM SUBMIT - FIXED REDIRECT LOGIC
// ==========================================
async function handleFormSubmit(e) {
    e.preventDefault();
    
    console.log('📋 Form submitted');
    
    const button = document.getElementById('checkoutButton');
    const buttonText = document.getElementById('buttonText');
    const errorDiv = document.getElementById('modalErrors');
    
    // Get form data
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const birthDate = document.getElementById('birthDate').value;
    const birthTime = document.getElementById('birthTime').value;
    const birthCity = document.getElementById('birthCity').value.trim();
    const question = document.getElementById('customerQuestion').value.trim();
    
    console.log('Form data:', { name, email, birthDate, hasQuestion: !!question });
    
    // Validate
    if (!name || !email || !birthDate) {
        showError('Please fill in all required fields');
        return;
    }
    
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    if (!selectedTier) {
        showError('Please select a reading tier');
        return;
    }
    
    // Disable button
    if (button) {
        button.disabled = true;
    }
    if (buttonText) {
        buttonText.innerHTML = '<span class="spinner"></span> Creating checkout...';
    }
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    try {
        console.log('🚀 Creating Stripe Checkout Session...');
        
        const requestData = {
            name: name,
            email: email,
            birthDate: birthDate,
            birthTime: birthTime || '',
            birthCity: birthCity || '',
            question: question || 'No specific question provided',
            tier: selectedTier.id,
            tierName: selectedTier.name,
            price: selectedTier.price,
            wordCount: selectedTier.wordCount
        };
        
        console.log('Request data:', requestData);
        console.log('Sending to:', `${WORKER_URL}/create-oracle-session`);
        
        // Create Stripe Checkout Session via Cloudflare Worker
        const response = await fetch(`${WORKER_URL}/create-oracle-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            let errorMessage = 'Failed to create checkout session';
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                console.error('Error data:', errorData);
            } catch (e) {
                const errorText = await response.text();
                errorMessage = errorText || errorMessage;
                console.error('Could not parse error response');
            }
            
            throw new Error(errorMessage);
        }
        
        // Parse successful response
        const result = await response.json();
        console.log('✅ Checkout session response:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Checkout session creation failed');
        }
        
        if (!result.sessionId) {
            throw new Error('No session ID received from server');
        }
        
        console.log('✅ Checkout session created:', result.sessionId);
        
        // Store order for success page
        localStorage.setItem('oracle_order', JSON.stringify({
            tier: selectedTier.name,
            price: selectedTier.price,
            customer: { name, email },
            birthDate: birthDate,
            birthTime: birthTime || 'Not provided',
            birthCity: birthCity || 'Not provided',
            question: question || 'No specific question',
            timestamp: Date.now(),
            delivery: selectedTier.delivery,
            sessionId: result.sessionId
        }));
        
        // FIXED: Only use stripe.redirectToCheckout(), NEVER use result.url
        if (result.sessionId && stripe) {
            console.log('🔄 Redirecting to Stripe Checkout with session ID...');
            
            const { error } = await stripe.redirectToCheckout({
                sessionId: result.sessionId
            });
            
            if (error) {
                console.error('Stripe redirect error:', error);
                throw new Error(error.message);
            }
        } else {
            console.error('Missing sessionId or stripe object');
            throw new Error('Invalid session data received');
        }
        
    } catch (error) {
        console.error('❌ Checkout error:', error);
        console.error('Error stack:', error.stack);
        
        showError(error.message || 'Payment processing failed. Please try again.');
        
        // Re-enable button
        if (button) {
            button.disabled = false;
        }
        if (buttonText) {
            buttonText.textContent = 'Pay with Card';
        }
    }
}

// ==========================================
// VALIDATION HELPERS
// ==========================================
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(message) {
    console.error('Showing error:', message);
    
    const errorDiv = document.getElementById('modalErrors');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Also show toast if available
    if (window.LyrionUtils && window.LyrionUtils.showToast) {
        window.LyrionUtils.showToast(message, 'error');
    }
}

// ==========================================
// INITIALIZE ON DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded');
    
    // Check if we're on the oracle page
    if (document.getElementById('paymentModal')) {
        console.log('🔮 Oracle page detected');
        
        // Wait for Stripe to load
        if (typeof Stripe !== 'undefined') {
            initOracle();
        } else {
            console.log('⏳ Waiting for Stripe.js...');
            // Wait a bit for Stripe to load
            setTimeout(() => {
                if (typeof Stripe !== 'undefined') {
                    initOracle();
                } else {
                    console.error('❌ Stripe.js failed to load');
                    showError('Payment system not available. Please refresh the page.');
                }
            }, 1000);
        }
    }
});

// ==========================================
// EXPOSE API
// ==========================================
window.OracleAPI = {
    selectTier,
    ORACLE_TIERS
};