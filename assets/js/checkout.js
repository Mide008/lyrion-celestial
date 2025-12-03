/**
 * LYRĪON - Checkout
 * Stripe payment integration and order processing
 */

// ==========================================
// CONFIGURATION
// ==========================================
const STRIPE_PUBLIC_KEY = 'pk_live_51SUJRkEdr82NVcSeGDkHpcpmUdS7OZzESMQ5JZESZsc9YY74FoTtk2p9LFKYafg4VmjvsXOVO0IHsi2fSyh81xA600RctJAeto'; // Replace with your actual publishable key
const WORKER_URL = 'https://lyrion-order-broker.hello-2a3.workers.dev'; // Replace with your Cloudflare Worker URL

// ==========================================
// STRIPE INSTANCE
// ==========================================
let stripe = null;
let elements = null;
let cardElement = null;

// ==========================================
// CHECKOUT STATE
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
    total: 0
};

// ==========================================
// INITIALIZE CHECKOUT
// ==========================================
async function initCheckout() {
    try {
        // Load Stripe
        if (typeof Stripe === 'undefined') {
            throw new Error('Stripe.js not loaded');
        }
        
        stripe = Stripe(STRIPE_PUBLIC_KEY);
        
        // Get cart from localStorage
        checkoutData.cart = window.CartAPI.getCart();
        
        // Check if cart is empty
        if (!checkoutData.cart || checkoutData.cart.items.length === 0) {
            showEmptyCartMessage();
            return;
        }
        
        // Render order summary
        renderOrderSummary();
        
        // Calculate totals
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
        if (event.error) {
            displayError.textContent = event.error.message;
        } else {
            displayError.textContent = '';
        }
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
            if (!window.LyrionUtils.validateEmail(emailInput.value)) {
                window.LyrionUtils.showFormError(emailInput, 'Please enter a valid email address');
            } else {
                window.LyrionUtils.clearFormError(emailInput);
            }
        });
    }
}

// ==========================================
// HANDLE CHECKOUT SUBMIT
// ==========================================
async function handleCheckoutSubmit(e) {
    e.preventDefault();
    
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
        
        // Create payment intent via Cloudflare Worker
        const paymentIntent = await createPaymentIntent();
        
        // Confirm card payment
        const { error, paymentIntent: confirmedPayment } = await stripe.confirmCardPayment(
            paymentIntent.client_secret,
            {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: checkoutData.customer.name,
                        email: checkoutData.customer.email,
                        address: {
                            line1: checkoutData.customer.address.line1,
                            line2: checkoutData.customer.address.line2,
                            city: checkoutData.customer.address.city,
                            postal_code: checkoutData.customer.address.postal_code,
                            country: checkoutData.customer.address.country
                        }
                    }
                }
            }
        );
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Payment successful
        handlePaymentSuccess(confirmedPayment);
        
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
            window.LyrionUtils.showFormError(field, 'This field is required');
            isValid = false;
        } else {
            window.LyrionUtils.clearFormError(field);
        }
    });
    
    // Validate email
    const emailInput = document.getElementById('email');
    if (emailInput && !window.LyrionUtils.validateEmail(emailInput.value)) {
        window.LyrionUtils.showFormError(emailInput, 'Please enter a valid email address');
        isValid = false;
    }
    
    return isValid;
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
// CREATE PAYMENT INTENT
// ==========================================
async function createPaymentIntent() {
    const response = await fetch(`${WORKER_URL}/create-payment-intent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: Math.round(checkoutData.total * 100), // Convert to cents
            currency: 'gbp',
            cart: checkoutData.cart,
            customer: checkoutData.customer
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create payment intent');
    }
    
    return await response.json();
}

// ==========================================
// HANDLE PAYMENT SUCCESS
// ==========================================
function handlePaymentSuccess(paymentIntent) {
    // Clear cart
    window.CartAPI.clearCart();
    
    // Store order details for confirmation page
    window.LyrionUtils.Storage.set('last_order', {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        customer: checkoutData.customer,
        items: checkoutData.cart.items,
        timestamp: Date.now()
    });
    
    // Redirect to success page
    window.location.href = 'checkout-success.html';
}

// ==========================================
// CALCULATE TOTALS
// ==========================================
function calculateTotals() {
    const subtotal = checkoutData.cart.total;
    
    // Calculate shipping (free over £75, otherwise £4.95)
    checkoutData.shipping = subtotal >= 75 ? 0 : 4.95;
    
    // Calculate tax (20% VAT for UK)
    const taxableAmount = subtotal + checkoutData.shipping;
    checkoutData.tax = taxableAmount * 0.20;
    
    // Calculate total
    checkoutData.total = subtotal + checkoutData.shipping + checkoutData.tax;
    
    // Update UI
    updateTotalsDisplay();
}

// ==========================================
// UPDATE TOTALS DISPLAY
// ==========================================
function updateTotalsDisplay() {
    const subtotalElement = document.getElementById('subtotal');
    const shippingElement = document.getElementById('shipping');
    const taxElement = document.getElementById('tax');
    const totalElement = document.getElementById('total');
    
    if (subtotalElement) {
        subtotalElement.textContent = window.LyrionUtils.formatPrice(checkoutData.cart.total);
    }
    
    if (shippingElement) {
        shippingElement.textContent = checkoutData.shipping === 0 
            ? 'FREE' 
            : window.LyrionUtils.formatPrice(checkoutData.shipping);
    }
    
    if (taxElement) {
        taxElement.textContent = window.LyrionUtils.formatPrice(checkoutData.tax);
    }
    
    if (totalElement) {
        totalElement.textContent = window.LyrionUtils.formatPrice(checkoutData.total);
    }
}

// ==========================================
// RENDER ORDER SUMMARY
// ==========================================
function renderOrderSummary() {
    const orderSummary = document.getElementById('orderSummary');
    
    if (!orderSummary || !checkoutData.cart) return;
    
    orderSummary.innerHTML = checkoutData.cart.items.map(item => `
        <div style="display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #eee;">
            <img src="assets/products/${item.image}" 
                 alt="${item.title}"
                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;"
                 onerror="this.src='assets/img/placeholder.png'">
            <div style="flex: 1;">
                <h4 style="margin: 0 0 0.25rem 0; font-size: 1rem;">${item.title}</h4>
                ${item.variant ? `<p style="margin: 0; font-size: 0.9rem; color: #666;">Size: ${item.variant}</p>` : ''}
                <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: #666;">Qty: ${item.quantity}</p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0; font-weight: 600; color: var(--color-gold-primary);">
                    ${window.LyrionUtils.formatPrice(item.price * item.quantity)}
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
    window.LyrionUtils.showToast(message, 'error');
    
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
// APPLY DISCOUNT CODE
// ==========================================
async function applyDiscountCode(code) {
    try {
        const response = await fetch(`${WORKER_URL}/validate-discount`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code.toUpperCase(),
                cart: checkoutData.cart
            })
        });
        
        if (!response.ok) {
            throw new Error('Invalid discount code');
        }
        
        const discount = await response.json();
        
        // Apply discount
        checkoutData.discount = discount;
        calculateTotals();
        
        window.LyrionUtils.showToast('Discount applied successfully!', 'success');
        
    } catch (error) {
        window.LyrionUtils.showToast(error.message, 'error');
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

// ==========================================
// EXPOSE FUNCTIONS GLOBALLY
// ==========================================
window.CheckoutAPI = {
    applyDiscountCode,
    calculateTotals
};