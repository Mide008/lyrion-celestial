/**
 * LYRĪON - The Oracle
 * Paid astrology readings with Stripe Checkout integration
 */

// ==========================================
// CONFIGURATION
// ==========================================
const STRIPE_PUBLIC_KEY = 'pk_live_51ST0Yr6kwOhs68PfqGUKmqq7hcbKsY60SCK1WLr5vkJLyAqurpFVgZx5oJEPZmXMN3gS6fI8YzLsF4hWQh0qjPHt00tIvM8E5V';
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
    detailed: {
        id: 'detailed',
        name: 'Detailed Reading',
        price: 55.00,
        description: 'Deep exploration of your birth chart and current transits',
        wordCount: '800+ words',
        delivery: '48 hours'
    },
    premium: {
        id: 'premium',
        name: 'Premium Reading',
        price: 125.00,
        description: 'Comprehensive analysis with personalized ritual guidance',
        wordCount: '1,500+ words',
        delivery: '72 hours'
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
    console.log('🔮 Initializing Oracle...');
    console.log('Worker URL:', WORKER_URL);
    
    // Initialize Stripe
    if (typeof Stripe !== 'undefined') {
        stripe = Stripe(STRIPE_PUBLIC_KEY);
        console.log('✅ Stripe initialized');
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
        const button = card.querySelector('.btn');
        
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
    document.getElementById('modalPrice').textContent = `£${selectedTier.price}`;
    
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
// HANDLE FORM SUBMIT
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
    const question = document.getElementById('customerQuestion').value.trim();
    
    console.log('Form data:', { name, email, hasQuestion: !!question });
    
    // Validate
    if (!name || !email) {
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
            question: question || 'No specific question provided',
            tier: selectedTier.id,
            tierName: selectedTier.name,
            price: selectedTier.price,
            wordCount: selectedTier.wordCount,
            birthDate: '',
            birthCity: ''
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
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        // Get response text first
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        if (!response.ok) {
            let errorMessage = 'Failed to create checkout session';
            
            try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error || errorMessage;
                console.error('Error data:', errorData);
            } catch (e) {
                errorMessage = responseText || errorMessage;
                console.error('Could not parse error response');
            }
            
            throw new Error(errorMessage);
        }
        
        // Parse successful response
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Could not parse success response');
            throw new Error('Invalid response from server');
        }
        
        console.log('✅ Checkout session created:', data.sessionId);
        console.log('Checkout URL:', data.url);
        
        // Redirect to Stripe Checkout
        if (data.sessionId && stripe) {
            console.log('🔄 Redirecting to Stripe Checkout...');
            
            const { error } = await stripe.redirectToCheckout({
                sessionId: data.sessionId
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
            buttonText.textContent = 'Continue to Payment';
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