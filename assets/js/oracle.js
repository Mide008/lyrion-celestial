/**
 * LYRĪON - The Oracle
 * Paid astrology readings with Stripe integration
 */

// ==========================================
// CONFIGURATION
// ==========================================
const STRIPE_PUBLIC_KEY = 'pk_live_51ST0Yr6kwOhs68PfqGUKmqq7hcbKsY60SCK1WLr5vkJLyAqurpFVgZx5oJEPZmXMN3gS6fI8YzLsF4hWQh0qjPHt00tIvM8E5V'; // Same as checkout
const WORKER_URL = 'https://lyrion-order-broker.workers.dev';

// ==========================================
// ORACLE TIERS
// ==========================================
const ORACLE_TIERS = {
    essence: {
        id: 'essence',
        name: 'Essence Reading',
        price: 25.00,
        description: 'A focused insight into your current cosmic alignment',
        wordCount: '300 words',
        delivery: '48 hours'
    },
    detailed: {
        id: 'detailed',
        name: 'Detailed Reading',
        price: 55.00,
        description: 'Deep exploration of your birth chart and current transits',
        wordCount: '800 words',
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
let elements = null;
let cardElement = null;

// ==========================================
// INITIALIZE ORACLE
// ==========================================
async function initOracle() {
    try {
        // Load Stripe
        if (typeof Stripe === 'undefined') {
            throw new Error('Stripe.js not loaded');
        }
        
        stripe = Stripe(STRIPE_PUBLIC_KEY);
        
        // Setup tier selection
        setupTierSelection();
        
        // Setup form listeners
        setupOracleFormListeners();
        
    } catch (error) {
        console.error('Error initializing oracle:', error);
        showError('Unable to initialize oracle. Please refresh the page.');
    }
}

// ==========================================
// SETUP TIER SELECTION
// ==========================================
function setupTierSelection() {
    const tierButtons = document.querySelectorAll('[data-tier]');
    
    tierButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tierId = button.getAttribute('data-tier');
            selectTier(tierId);
        });
    });
}

// ==========================================
// SELECT TIER
// ==========================================
function selectTier(tierId) {
    selectedTier = ORACLE_TIERS[tierId];
    
    if (!selectedTier) return;
    
    // Update UI
    const tierButtons = document.querySelectorAll('[data-tier]');
    tierButtons.forEach(btn => {
        if (btn.getAttribute('data-tier') === tierId) {
            btn.classList.add('active');
            btn.style.borderColor = 'var(--color-gold-primary)';
            btn.style.background = 'rgba(184, 134, 11, 0.05)';
        } else {
            btn.classList.remove('active');
            btn.style.borderColor = '';
            btn.style.background = '';
        }
    });
    
    // Show payment form
    showPaymentForm();
    
    // Update price display
    updatePriceDisplay();
}

// ==========================================
// SHOW PAYMENT FORM
// ==========================================
function showPaymentForm() {
    const paymentSection = document.getElementById('paymentSection');
    
    if (paymentSection) {
        paymentSection.style.display = 'block';
        paymentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Setup Stripe Elements if not already done
    if (!cardElement) {
        setupStripeElements();
    }
}

// ==========================================
// SETUP STRIPE ELEMENTS
// ==========================================
function setupStripeElements() {
    elements = stripe.elements();
    
    const style = {
        base: {
            color: '#0F0D0B',
            fontFamily: '"Inter", sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': {
                color: '#999'
            }
        },
        invalid: {
            color: '#D32F2F',
            iconColor: '#D32F2F'
        }
    };
    
    cardElement = elements.create('card', { style });
    
    const cardElementContainer = document.getElementById('oracle-card-element');
    if (cardElementContainer) {
        cardElement.mount('#oracle-card-element');
    }
    
    cardElement.on('change', (event) => {
        const displayError = document.getElementById('oracle-card-errors');
        if (displayError) {
            displayError.textContent = event.error ? event.error.message : '';
        }
    });
}

// ==========================================
// UPDATE PRICE DISPLAY
// ==========================================
function updatePriceDisplay() {
    const priceElement = document.getElementById('selectedPrice');
    const tierNameElement = document.getElementById('selectedTierName');
    
    if (priceElement && selectedTier) {
        priceElement.textContent = window.LyrionUtils.formatPrice(selectedTier.price);
    }
    
    if (tierNameElement && selectedTier) {
        tierNameElement.textContent = selectedTier.name;
    }
}

// ==========================================
// SETUP FORM LISTENERS
// ==========================================
function setupOracleFormListeners() {
    const oracleForm = document.getElementById('oracleForm');
    
    if (oracleForm) {
        oracleForm.addEventListener('submit', handleOracleSubmit);
    }
    
    // Real-time validation
    const emailInput = document.getElementById('oracleEmail');
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            if (!window.LyrionUtils.validateEmail(emailInput.value)) {
                window.LyrionUtils.showFormError(emailInput, 'Please enter a valid email address');
            } else {
                window.LyrionUtils.clearFormError(emailInput);
            }
        });
    }
    
    // Character counter for question
    const questionTextarea = document.getElementById('oracleQuestion');
    const charCounter = document.getElementById('charCounter');
    
    if (questionTextarea && charCounter) {
        questionTextarea.addEventListener('input', () => {
            const length = questionTextarea.value.length;
            charCounter.textContent = `${length} / 500 characters`;
            
            if (length > 500) {
                charCounter.style.color = 'var(--color-error)';
            } else {
                charCounter.style.color = '#666';
            }
        });
    }
}

// ==========================================
// HANDLE ORACLE SUBMIT
// ==========================================
async function handleOracleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitOracle');
    const form = e.target;
    
    // Check if tier is selected
    if (!selectedTier) {
        showError('Please select a reading tier');
        return;
    }
    
    // Disable submit button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
    }
    
    try {
        // Validate form
        if (!validateOracleForm(form)) {
            throw new Error('Please fill in all required fields');
        }
        
        // Collect form data
        const formData = {
            name: form.oracleName.value.trim(),
            email: form.oracleEmail.value.trim(),
            birthdate: form.birthdate?.value || '',
            birthtime: form.birthtime?.value || '',
            birthplace: form.birthplace?.value || '',
            question: form.oracleQuestion.value.trim(),
            tier: selectedTier.id,
            amount: selectedTier.price
        };
        
        // Create payment intent
        const paymentIntent = await createOraclePaymentIntent(formData);
        
        // Confirm card payment
        const { error, paymentIntent: confirmedPayment } = await stripe.confirmCardPayment(
            paymentIntent.client_secret,
            {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: formData.name,
                        email: formData.email
                    }
                }
            }
        );
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Payment successful
        handleOracleSuccess(formData, confirmedPayment);
        
    } catch (error) {
        console.error('Oracle submission error:', error);
        showError(error.message || 'Submission failed. Please try again.');
        
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit & Pay';
        }
    }
}

// ==========================================
// VALIDATE ORACLE FORM
// ==========================================
function validateOracleForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            window.LyrionUtils.showFormError(field, 'This field is required');
            isValid = false;
        } else {
            window.LyrionUtils.clearFormError(field);
        }
    });
    
    // Validate email
    const emailInput = form.oracleEmail;
    if (emailInput && !window.LyrionUtils.validateEmail(emailInput.value)) {
        window.LyrionUtils.showFormError(emailInput, 'Please enter a valid email address');
        isValid = false;
    }
    
    // Validate question length
    const questionInput = form.oracleQuestion;
    if (questionInput && questionInput.value.length > 500) {
        window.LyrionUtils.showFormError(questionInput, 'Question must be under 500 characters');
        isValid = false;
    }
    
    return isValid;
}

// ==========================================
// CREATE ORACLE PAYMENT INTENT
// ==========================================
async function createOraclePaymentIntent(formData) {
    const response = await fetch(`${WORKER_URL}/create-oracle-payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: Math.round(formData.amount * 100), // Convert to cents
            currency: 'gbp',
            oracle_data: formData,
            tier: selectedTier
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create payment');
    }
    
    return await response.json();
}

// ==========================================
// HANDLE ORACLE SUCCESS
// ==========================================
function handleOracleSuccess(formData, paymentIntent) {
    // Store order details
    window.LyrionUtils.Storage.set('oracle_order', {
        id: paymentIntent.id,
        tier: selectedTier,
        customer: {
            name: formData.name,
            email: formData.email
        },
        delivery: selectedTier.delivery,
        timestamp: Date.now()
    });
    
    // Show success message
    showSuccessMessage();
}

// ==========================================
// SHOW SUCCESS MESSAGE
// ==========================================
function showSuccessMessage() {
    const container = document.querySelector('.container');
    
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; max-width: 600px; margin: 0 auto;">
                <div style="font-size: 4rem; margin-bottom: 1.5rem; color: var(--color-gold-primary);">✦</div>
                <h2 style="margin-bottom: 1rem; font-family: var(--font-serif);">Your Reading is On Its Way</h2>
                <p style="font-size: 1.1rem; line-height: 1.8; color: #666; margin-bottom: 2rem;">
                    Thank you for consulting the Oracle. Your personalized ${selectedTier.name.toLowerCase()} will be delivered to your email within ${selectedTier.delivery}.
                </p>
                <div style="background: var(--color-cream-dark); padding: 2rem; border-radius: 8px; margin-bottom: 2rem;">
                    <p style="font-size: 0.95rem; color: #666; margin-bottom: 1rem;">
                        <strong>What to expect:</strong>
                    </p>
                    <ul style="text-align: left; color: #666; line-height: 1.8; max-width: 400px; margin: 0 auto;">
                        <li>Email confirmation sent immediately</li>
                        <li>Reading delivered within ${selectedTier.delivery}</li>
                        <li>${selectedTier.wordCount} of personalized insights</li>
                        <li>PDF format for easy saving and printing</li>
                    </ul>
                </div>
                <p style="color: #999; font-size: 0.9rem; margin-bottom: 2rem;">
                    Order ID: <strong>${Date.now().toString(36).toUpperCase()}</strong>
                </p>
                <a href="index.html" class="btn btn-primary">Return Home</a>
            </div>
        `;
    }
}

// ==========================================
// SHOW ERROR MESSAGE
// ==========================================
function showError(message) {
    window.LyrionUtils.showToast(message, 'error');
    
    const errorContainer = document.getElementById('oracle-errors');
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div style="background: #FFEBEE; color: #C62828; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
                ${message}
            </div>
        `;
        
        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ==========================================
// INITIALIZE ON DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Only run on oracle page
    if (document.getElementById('oracleForm')) {
        // Load Stripe.js
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = initOracle;
        script.onerror = () => {
            showError('Failed to load payment system. Please refresh the page.');
        };
        document.head.appendChild(script);
    }
});

// ==========================================
// EXPOSE FUNCTIONS GLOBALLY
// ==========================================
window.OracleAPI = {
    selectTier,
    ORACLE_TIERS
};

// ==========================================
// QUICK TIER SELECTION WITH MODAL
// ==========================================
function setupQuickTierSelection() {
    document.querySelectorAll('[data-tier]').forEach(card => {
        card.addEventListener('click', function() {
            const tierId = this.getAttribute('data-tier');
            window.OracleAPI.selectTier(tierId);
        });
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('oracleForm')) {
        initOracle();
    }
    setupQuickTierSelection();
});