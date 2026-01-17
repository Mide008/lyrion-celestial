/**
 * LYRĪON - Checkout - WITH FRIEND ACCESS INTEGRATION
 * Stripe payment integration and order processing
 * Now includes friend access discount support
 */

// ==========================================
// CONFIGURATION (from global config)
// ==========================================
const getConfig = () => {
    if (window.LYRION_CONFIG) {
        return window.LYRION_CONFIG;
    }
    
    // Fallback if config.js not loaded - TEST MODE
    console.warn('⚠️ LYRION_CONFIG not found, using fallback');
    return {
        STRIPE_PUBLIC_KEY: 'pk_live_51ST0Yr6kwOhs68PfwI2N6I6rKXBx8TKEvkPdwfR7sLpKQiAiQ09QPLpy1XalDPf9Zrs3SL5DkWxKKQjdZq1JoLoP00QdElzZjF',
        WORKER_URL: 'https://lyrion-order-broker.hello-2a3.workers.dev'
    };
};

// ==========================================
// STRIPE INSTANCE
// ==========================================
let stripe = null;
let elements = null;
let cardElement = null;

// ==========================================
// CHECKOUT STATE (with friend access)
// ==========================================
let checkoutData = {
    cart: null,
    customer: {
        email: '',
        name: '',
        address: {
            line1: '',
            line2: '',
            city: '',
            postal_code: '',
            country: 'GB'
        }
    },
    shipping: 0,
    tax: 0,
    total: 0,
    // Friend access fields
    accessCode: null,
    accessOwner: null,
    accessDiscount: 0,
    discountAmount: 0
};

// ==========================================
// INITIALIZE CHECKOUT
// ==========================================
async function initCheckout() {
    try {
        const config = getConfig();
        console.log('🔧 Checkout config loaded with correct Stripe key');
        
        // Load Stripe
        if (typeof Stripe === 'undefined') {
            throw new Error('Stripe.js not loaded');
        }
        
        stripe = Stripe(config.STRIPE_PUBLIC_KEY);
        console.log('✅ Stripe initialized with key:', config.STRIPE_PUBLIC_KEY.substring(0, 20) + '...');
        
        // Get cart from localStorage
        checkoutData.cart = window.CartAPI ? window.CartAPI.getCart() : getCartFromStorage();
        
        // Check if cart is empty
        if (!checkoutData.cart || checkoutData.cart.items.length === 0) {
            showEmptyCartMessage();
            return;
        }
        
        // Check for active access code
        await loadAccessCode();
        
        // Render order summary
        renderOrderSummary();
        
        // Calculate totals (with discount if applicable)
        calculateTotals();
        
        // Setup Stripe Elements
        setupStripeElements();
        
        // Setup form listeners
        setupFormListeners();
        
    } catch (error) {
        console.error('Error initializing checkout:', error);
        showError('Unable to initialize checkout. Please refresh the page.');
    }
}

// Helper function if CartAPI is not available
function getCartFromStorage() {
    try {
        const cartData = localStorage.getItem('lyrion_cart');
        return cartData ? JSON.parse(cartData) : null;
    } catch (e) {
        console.error('Error reading cart from storage:', e);
        return null;
    }
}

// ==========================================
// LOAD ACCESS CODE FROM SESSION
// ==========================================
async function loadAccessCode() {
    try {
        const accessData = JSON.parse(sessionStorage.getItem('lyrion_access') || 'null');
        
        if (accessData && accessData.code) {
            // Verify code is still valid
            const config = getConfig();
            const response = await fetch(`${config.WORKER_URL}/validate-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: accessData.code })
            });
            
            const result = await response.json();
            
            if (result.valid) {
                checkoutData.accessCode = accessData.code;
                checkoutData.accessOwner = result.owner;
                checkoutData.accessDiscount = result.discount || 15;
                
                console.log(`✅ Friend access active: ${checkoutData.accessCode} (${checkoutData.accessDiscount}% off)`);
                
                // Show access badge
                showAccessBadge();
            } else {
                // Code no longer valid, clear from session
                sessionStorage.removeItem('lyrion_access');
                console.log('⚠️ Access code expired or invalid');
            }
        }
    } catch (error) {
        console.error('Error loading access code:', error);
        // Don't fail checkout, just proceed without discount
    }
}

// ==========================================
// SHOW ACCESS BADGE IN CHECKOUT
// ==========================================
function showAccessBadge() {
    const summarySection = document.querySelector('.checkout-summary-section');
    if (!summarySection) return;
    
    // Check if badge already exists
    if (document.getElementById('accessBadge')) return;
    
    const badge = document.createElement('div');
    badge.id = 'accessBadge';
    badge.style.cssText = `
        background: rgba(184, 134, 11, 0.1);
        border: 2px solid var(--color-gold-primary);
        border-radius: var(--radius-sm);
        padding: 1rem;
        margin-bottom: 1.5rem;
        text-align: center;
    `;
    
    badge.innerHTML = `
        <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-gold-primary); font-weight: 600; margin-bottom: 0.25rem;">
            Friend Access Active
        </div>
        <div style="font-size: 0.9rem; color: #666;">
            Tapped in via ${checkoutData.accessOwner}
        </div>
    `;
    
    // Insert at the top of summary section
    const firstChild = summarySection.firstElementChild;
    summarySection.insertBefore(badge, firstChild);
}

// ==========================================
// SETUP STRIPE ELEMENTS
// ==========================================
function setupStripeElements() {
    // Create Elements instance
    elements = stripe.elements();
    
    // Custom styling
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
    
    // Create card element
    cardElement = elements.create('card', { style });
    
    // Mount card element
    const cardElementContainer = document.getElementById('card-element');
    if (cardElementContainer) {
        cardElement.mount('#card-element');
    }
    
    // Handle real-time validation errors
    cardElement.on('change', (event) => {
        const displayError = document.getElementById('card-errors');
        if (displayError) {
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        }
    });
    
    // Add focus class to container
    cardElement.on('focus', () => {
        const container = document.getElementById('cardElementContainer');
        if (container) container.classList.add('focused');
    });
    
    cardElement.on('blur', () => {
        const container = document.getElementById('cardElementContainer');
        if (container) container.classList.remove('focused');
    });
}

// ==========================================
// SETUP FORM LISTENERS
// ==========================================
function setupFormListeners() {
    const checkoutForm = document.getElementById('checkoutForm');
    
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckoutSubmit);
    }
    
    // Real-time validation for email
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            if (!validateEmail(emailInput.value)) {
                showFieldError(emailInput, 'Please enter a valid email address');
            } else {
                clearFieldError(emailInput);
            }
        });
    }
}

// ==========================================
// HANDLE CHECKOUT SUBMIT - WITH ACCESS CODE
// ==========================================
async function handleCheckoutSubmit(e) {
    e.preventDefault();
    
    const config = getConfig();
    const submitBtn = document.getElementById('submitPayment');
    const form = e.target;
    
    // Disable submit button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
    }
    
    try {
        // Validate form
        if (!validateCheckoutForm(form)) {
            throw new Error('Please fill in all required fields');
        }
        
        // Collect customer data
        collectCustomerData(form);
        
        // Prepare request headers (include access code if present)
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (checkoutData.accessCode) {
            headers['x-access-code'] = checkoutData.accessCode;
        }
        
        // Create Stripe Checkout Session via Cloudflare Worker
        const response = await fetch(`${config.WORKER_URL}/create-payment-intent`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                amount: Math.round(checkoutData.total * 100), // Convert to cents
                currency: 'gbp',
                cart: checkoutData.cart,
                customer: checkoutData.customer,
                // Include access code data
                accessCode: checkoutData.accessCode,
                accessDiscount: checkoutData.accessDiscount,
                accessOwner: checkoutData.accessOwner
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create checkout session');
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Checkout failed');
        }
        
        if (!data.sessionId) {
            throw new Error('No session ID received from server');
        }
        
        // Store order for success page (include referral info)
        const orderData = {
            sessionId: data.sessionId,
            amount: checkoutData.total,
            customer: checkoutData.customer,
            items: checkoutData.cart.items,
            timestamp: Date.now(),
            subtotal: checkoutData.cart.total,
            shipping: checkoutData.shipping,
            vat: checkoutData.tax,
            discountAmount: checkoutData.discountAmount
        };
        
        // Add referral info if access code was used
        if (checkoutData.accessCode) {
            orderData.referralCode = checkoutData.accessCode;
            orderData.referralOwner = checkoutData.accessOwner;
        }
        
        localStorage.setItem('last_order', JSON.stringify(orderData));
        
        // Redirect to Stripe Checkout
        if (data.sessionId && stripe) {
            const { error } = await stripe.redirectToCheckout({
                sessionId: data.sessionId
            });
            
            if (error) {
                throw new Error(error.message);
            }
        } else {
            throw new Error('No checkout session ID received');
        }
        
    } catch (error) {
        console.error('Checkout error:', error);
        showError(error.message || 'Payment failed. Please try again.');
        
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Complete Purchase';
        }
    }
}

// ==========================================
// VALIDATE CHECKOUT FORM
// ==========================================
function validateCheckoutForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            showFieldError(field, 'This field is required');
            isValid = false;
        } else {
            clearFieldError(field);
        }
    });
    
    // Validate email
    const emailInput = document.getElementById('email');
    if (emailInput && !validateEmail(emailInput.value)) {
        showFieldError(emailInput, 'Please enter a valid email address');
        isValid = false;
    }
    
    return isValid;
}

function showFieldError(field, message) {
    clearFieldError(field);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.textContent = message;
    errorDiv.style.color = '#D32F2F';
    errorDiv.style.fontSize = '0.85rem';
    errorDiv.style.marginTop = '0.25rem';
    
    field.parentNode.appendChild(errorDiv);
    field.style.borderColor = '#D32F2F';
}

function clearFieldError(field) {
    const existingError = field.parentNode.querySelector('.form-error');
    if (existingError) {
        existingError.remove();
    }
    field.style.borderColor = '';
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ==========================================
// COLLECT CUSTOMER DATA
// ==========================================
function collectCustomerData(form) {
    checkoutData.customer.email = form.email.value.trim();
    checkoutData.customer.name = `${form.firstName.value.trim()} ${form.lastName.value.trim()}`;
    checkoutData.customer.address.line1 = form.address1.value.trim();
    checkoutData.customer.address.line2 = form.address2?.value.trim() || '';
    checkoutData.customer.address.city = form.city.value.trim();
    checkoutData.customer.address.postal_code = form.postcode.value.trim();
    checkoutData.customer.address.country = form.country.value;
}

// ==========================================
// CALCULATE TOTALS (WITH FRIEND DISCOUNT)
// ==========================================
function calculateTotals() {
    let subtotal = checkoutData.cart.total;
    
    // Apply friend access discount FIRST (before shipping/tax)
    if (checkoutData.accessDiscount > 0) {
        checkoutData.discountAmount = subtotal * (checkoutData.accessDiscount / 100);
        subtotal = subtotal - checkoutData.discountAmount;
        console.log(`💰 Friend discount applied: ${checkoutData.accessDiscount}% (£${checkoutData.discountAmount.toFixed(2)} off)`);
    }
    
    // Calculate shipping (£4.95 always - NO free shipping threshold)
    checkoutData.shipping = 4.95;
    
    // Calculate tax (20% VAT on subtotal + shipping)
    const taxableAmount = subtotal + checkoutData.shipping;
    checkoutData.tax = taxableAmount * 0.20;
    
    // Calculate total
    checkoutData.total = subtotal + checkoutData.shipping + checkoutData.tax;
    
    // Update UI
    updateTotalsDisplay();
}

// ==========================================
// UPDATE TOTALS DISPLAY (WITH DISCOUNT ROW)
// ==========================================
function updateTotalsDisplay() {
    const orderTotals = document.querySelector('.order-totals');
    if (!orderTotals) return;
    
    // Build totals HTML with discount row if applicable
    let totalsHTML = `
        <div class="total-row">
            <span>Subtotal</span>
            <span id="subtotal">${formatPrice(checkoutData.cart.total)}</span>
        </div>
    `;
    
    // Add discount row if friend access is active
    if (checkoutData.discountAmount > 0) {
        totalsHTML += `
            <div class="total-row" style="color: var(--color-gold-primary);">
                <span>Friend Access (${checkoutData.accessDiscount}%)</span>
                <span>-${formatPrice(checkoutData.discountAmount)}</span>
            </div>
        `;
    }
    
    totalsHTML += `
        <div class="total-row">
            <span>Shipping</span>
            <span id="shipping">${formatPrice(checkoutData.shipping)}</span>
        </div>
        
        <div class="total-row">
            <span>VAT (20%)</span>
            <span id="tax">${formatPrice(checkoutData.tax)}</span>
        </div>
        
        <div class="total-row grand-total">
            <span>Total</span>
            <span id="total">${formatPrice(checkoutData.total)}</span>
        </div>
    `;
    
    orderTotals.innerHTML = totalsHTML;
}

function formatPrice(price) {
    return `£${parseFloat(price).toFixed(2)}`;
}

// ==========================================
// RENDER ORDER SUMMARY
// ==========================================
function renderOrderSummary() {
    const orderSummary = document.getElementById('orderSummary');
    
    if (!orderSummary || !checkoutData.cart) return;
    
    orderSummary.innerHTML = checkoutData.cart.items.map(item => `
        <div class="order-item">
            <img src="assets/products/${item.image || 'placeholder.png'}" 
                 alt="${item.title}"
                 class="order-item-image"
                 onerror="this.src='assets/img/placeholder.png'">
            <div style="flex: 1;">
                <h4 style="margin: 0 0 0.25rem 0; font-size: 1rem;">${item.title}</h4>
                ${item.variant ? `<p style="margin: 0; font-size: 0.9rem; color: #666;">${item.variant}</p>` : ''}
                <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: #666;">Qty: ${item.quantity}</p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0; font-weight: 600; color: var(--color-gold-primary);">
                    ${formatPrice(item.price * item.quantity)}
                </p>
            </div>
        </div>
    `).join('');
}

// ==========================================
// SHOW EMPTY CART MESSAGE
// ==========================================
function showEmptyCartMessage() {
    const container = document.querySelector('.container');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;">🛒</div>
                <h2 style="margin-bottom: 1rem;">Your cart is empty</h2>
                <p style="color: #666; margin-bottom: 2rem;">Add some celestial essentials to get started</p>
                <a href="shop.html" class="btn btn-primary">Shop Now</a>
            </div>
        `;
    }
}

// ==========================================
// SHOW ERROR MESSAGE
// ==========================================
function showError(message) {
    const errorContainer = document.getElementById('checkout-errors');
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
    // Only run on checkout page
    if (document.getElementById('checkoutForm')) {
        // Load Stripe.js
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = initCheckout;
        script.onerror = () => {
            showError('Failed to load payment system. Please refresh the page.');
        };
        document.head.appendChild(script);
    }
});