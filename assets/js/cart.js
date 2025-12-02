/**
 * LYRĪON - Shopping Cart
 * Add, remove, update cart items with localStorage persistence
 */

// ==========================================
// CART STATE
// ==========================================
let cart = {
    items: [],
    total: 0
};

// ==========================================
// INITIALIZE CART
// ==========================================
function initCart() {
    // Load cart from localStorage
    const savedCart = window.LyrionUtils.Storage.get('lyrion_cart');
    if (savedCart) {
        cart = savedCart;
    }
    
    // Update UI
    updateCartBadge();
    
    // Set up event listeners
    setupCartListeners();
}

// ==========================================
// SETUP EVENT LISTENERS
// ==========================================
function setupCartListeners() {
    // Cart button - open drawer
    const cartBtn = document.getElementById('cartBtn');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartClose = document.getElementById('cartClose');
    
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            openCart();
        });
    }
    
    if (cartClose) {
        cartClose.addEventListener('click', () => {
            closeCart();
        });
    }
    
    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => {
            closeCart();
        });
    }
    
    // Close cart with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && cartDrawer.classList.contains('active')) {
            closeCart();
        }
    });
}

// ==========================================
// OPEN CART
// ==========================================
function openCart() {
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    
    renderCartItems();
    cartDrawer.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ==========================================
// CLOSE CART
// ==========================================
function closeCart() {
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    
    cartDrawer.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ==========================================
// ADD TO CART
// ==========================================
function addToCart(product, variant = null) {
    // Check if item already exists
    const existingItemIndex = cart.items.findIndex(item => 
        item.sku === product.sku && item.variant === variant
    );
    
    if (existingItemIndex > -1) {
        // Increase quantity
        cart.items[existingItemIndex].quantity += 1;
    } else {
        // Add new item
        cart.items.push({
            sku: product.sku,
            title: product.title,
            price: parseFloat(product.price),
            image: product.image_front,
            variant: variant,
            quantity: 1,
            category: product.category
        });
    }
    
    // Update cart
    calculateTotal();
    saveCart();
    updateCartBadge();
    
    // Show success notification
    window.LyrionUtils.showToast(`${product.title} added to cart`, 'success');
    
    // Animate cart badge
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.style.animation = 'none';
        setTimeout(() => {
            badge.style.animation = 'badge-pop 0.3s ease';
        }, 10);
    }
}

// ==========================================
// REMOVE FROM CART
// ==========================================
function removeFromCart(sku, variant = null) {
    const itemIndex = cart.items.findIndex(item => 
        item.sku === sku && item.variant === variant
    );
    
    if (itemIndex > -1) {
        const removedItem = cart.items[itemIndex];
        cart.items.splice(itemIndex, 1);
        
        calculateTotal();
        saveCart();
        updateCartBadge();
        renderCartItems();
        
        window.LyrionUtils.showToast(`${removedItem.title} removed from cart`, 'info');
    }
}

// ==========================================
// UPDATE QUANTITY
// ==========================================
function updateQuantity(sku, variant, newQuantity) {
    const item = cart.items.find(item => 
        item.sku === sku && item.variant === variant
    );
    
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(sku, variant);
        } else {
            item.quantity = newQuantity;
            calculateTotal();
            saveCart();
            updateCartBadge();
            renderCartItems();
        }
    }
}

// ==========================================
// CALCULATE TOTAL
// ==========================================
function calculateTotal() {
    cart.total = cart.items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);
}

// ==========================================
// SAVE CART TO LOCALSTORAGE
// ==========================================
function saveCart() {
    window.LyrionUtils.Storage.set('lyrion_cart', cart);
}

// ==========================================
// UPDATE CART BADGE
// ==========================================
function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = itemCount;
        badge.style.display = itemCount > 0 ? 'flex' : 'none';
    }
}

// ==========================================
// RENDER CART ITEMS
// ==========================================
function renderCartItems() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalElement = document.getElementById('cartTotal');
    
    if (!cartItemsContainer) return;
    
    // Empty cart state
    if (cart.items.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <p class="cart-empty-text">Your cart is empty</p>
                <a href="shop.html" class="btn btn-primary" onclick="closeCart()">Start Shopping</a>
            </div>
        `;
        
        if (cartTotalElement) {
            cartTotalElement.textContent = '£0.00';
        }
        return;
    }
    
    // Render cart items
    cartItemsContainer.innerHTML = cart.items.map(item => `
        <div class="cart-item" data-sku="${item.sku}" data-variant="${item.variant || ''}">
            <img src="assets/products/${item.image}" 
                 alt="${item.title}" 
                 class="cart-item-image"
                 onerror="this.src='assets/img/placeholder.png'">
            
            <div class="cart-item-details">
                <h4 class="cart-item-title">${item.title}</h4>
                ${item.variant ? `<p class="cart-item-variant">Size: ${item.variant}</p>` : ''}
                <p class="cart-item-price">${window.LyrionUtils.formatPrice(item.price)}</p>
                
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="updateQuantity('${item.sku}', '${item.variant || ''}', ${item.quantity - 1})">−</button>
                    <span class="quantity-value">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity('${item.sku}', '${item.variant || ''}', ${item.quantity + 1})">+</button>
                </div>
                
                <button class="cart-item-remove" onclick="removeFromCart('${item.sku}', '${item.variant || ''}')">
                    Remove
                </button>
            </div>
        </div>
    `).join('');
    
    // Update total
    if (cartTotalElement) {
        cartTotalElement.textContent = window.LyrionUtils.formatPrice(cart.total);
    }
}

// ==========================================
// GET CART FOR CHECKOUT
// ==========================================
function getCart() {
    return cart;
}

// ==========================================
// CLEAR CART
// ==========================================
function clearCart() {
    cart = {
        items: [],
        total: 0
    };
    saveCart();
    updateCartBadge();
    renderCartItems();
}

// ==========================================
// QUICK ADD TO CART (from product cards)
// ==========================================
function quickAddToCart(sku) {
    // Fetch product data
    fetch('data/products.json')
        .then(response => response.json())
        .then(products => {
            const product = products.find(p => p.sku === sku);
            if (product) {
                // If product has variants, need to show size selector first
                if (product.variants && product.variants.length > 0) {
                    // Redirect to product page for size selection
                    window.location.href = `product.html?sku=${sku}`;
                } else {
                    // Add directly to cart
                    addToCart(product);
                }
            } else {
                window.LyrionUtils.showToast('Product not found', 'error');
            }
        })
        .catch(error => {
            console.error('Error adding to cart:', error);
            window.LyrionUtils.showToast('Unable to add to cart', 'error');
        });
}

// ==========================================
// INITIALIZE ON DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initCart();
});

// ==========================================
// EXPOSE FUNCTIONS GLOBALLY
// ==========================================
window.CartAPI = {
    addToCart,
    removeFromCart,
    updateQuantity,
    getCart,
    clearCart,
    openCart,
    closeCart,
    quickAddToCart
};