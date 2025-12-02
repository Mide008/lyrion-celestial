/**
 * LYRĪON - Shop Page
 * Product loading, filtering, and sorting functionality
 */

// ==========================================
// SHOP STATE
// ==========================================
let shopState = {
    products: [],
    filteredProducts: [],
    filters: {
        category: 'all',
        zodiac: 'all'
    },
    sort: 'newest',
    loading: true
};

// ==========================================
// INITIALIZE SHOP
// ==========================================
async function initShop() {
    try {
        showLoadingState();
        
        // Load products
        await loadProducts();
        
        // Setup event listeners
        setupShopListeners();
        
        // Apply initial filters and render
        applyFilters();
        
        hideLoadingState();
        
    } catch (error) {
        console.error('Error initializing shop:', error);
        showErrorState('Unable to load products. Please try again later.');
    }
}

// ==========================================
// LOAD PRODUCTS
// ==========================================
async function loadProducts() {
    try {
        const response = await fetch('data/products.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const products = await response.json();
        
        // Validate products data
        if (!Array.isArray(products)) {
            throw new Error('Invalid products data format');
        }
        
        shopState.products = products.map(product => ({
            ...product,
            // Ensure price is a number
            price: parseFloat(product.price) || 0,
            compare_at_price: parseFloat(product.compare_at_price) || 0,
            // Ensure image path is correct
            image_front: product.image_front || 'placeholder.png'
        }));
        
        console.log(`Loaded ${shopState.products.length} products`);
        
    } catch (error) {
        console.error('Error loading products:', error);
        throw error;
    }
}

// ==========================================
// SETUP EVENT LISTENERS
// ==========================================
function setupShopListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', handleFilterClick);
    });
    
    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', handleSortChange);
    }
    
    // Clear filters
    const clearFilters = document.getElementById('clearFilters');
    if (clearFilters) {
        clearFilters.addEventListener('click', clearAllFilters);
    }
    
    // Mobile filter toggle
    const filterToggle = document.getElementById('filterToggle');
    const filtersContainer = document.getElementById('filtersContainer');
    
    if (filterToggle && filtersContainer) {
        filterToggle.addEventListener('click', () => {
            filtersContainer.classList.toggle('active');
        });
    }
    
    // Close mobile filters when clicking outside
    document.addEventListener('click', (e) => {
        if (filtersContainer && filtersContainer.classList.contains('active') &&
            !filtersContainer.contains(e.target) &&
            !filterToggle.contains(e.target)) {
            filtersContainer.classList.remove('active');
        }
    });
}

// ==========================================
// HANDLE FILTER CLICK
// ==========================================
function handleFilterClick(e) {
    const btn = e.currentTarget;
    const filterType = btn.dataset.filter;
    const filterValue = btn.dataset.value;
    
    if (!filterType || !filterValue) return;
    
    // Update active state
    document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');
    
    // Update filters
    shopState.filters[filterType] = filterValue;
    
    // Apply filters
    applyFilters();
}

// ==========================================
// HANDLE SORT CHANGE
// ==========================================
function handleSortChange(e) {
    shopState.sort = e.target.value;
    applyFilters();
}

// ==========================================
// CLEAR ALL FILTERS
// ==========================================
function clearAllFilters() {
    // Reset all filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.value === 'all') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Reset sort
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = 'newest';
    }
    
    // Reset state
    shopState.filters = {
        category: 'all',
        zodiac: 'all'
    };
    shopState.sort = 'newest';
    
    // Apply filters
    applyFilters();
}

// ==========================================
// APPLY FILTERS AND SORT
// ==========================================
function applyFilters() {
    // Filter products
    let filtered = shopState.products.filter(product => {
        // Category filter
        if (shopState.filters.category !== 'all' && 
            product.category !== shopState.filters.category) {
            return false;
        }
        
        // Zodiac filter
        if (shopState.filters.zodiac !== 'all' && 
            product.zodiac_sign !== shopState.filters.zodiac) {
            return false;
        }
        
        return true;
    });
    
    // Sort products
    filtered = sortProducts(filtered, shopState.sort);
    
    shopState.filteredProducts = filtered;
    
    // Render products
    renderProducts();
    
    // Update product count
    updateProductCount();
}

// ==========================================
// SORT PRODUCTS
// ==========================================
function sortProducts(products, sortType) {
    const sorted = [...products];
    
    switch (sortType) {
        case 'price-low':
            return sorted.sort((a, b) => a.price - b.price);
            
        case 'price-high':
            return sorted.sort((a, b) => b.price - a.price);
            
        case 'name-asc':
            return sorted.sort((a, b) => a.title.localeCompare(b.title));
            
        case 'name-desc':
            return sorted.sort((a, b) => b.title.localeCompare(a.title));
            
        case 'newest':
        default:
            return sorted; // Keep original order for newest
    }
}

// ==========================================
// RENDER PRODUCTS
// ==========================================
function renderProducts() {
    const container = document.getElementById('productGrid');
    if (!container) return;
    
    if (shopState.filteredProducts.length === 0) {
        container.innerHTML = `
            <div class="no-products" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">✨</div>
                <h3 style="margin-bottom: 1rem; color: var(--color-ink);">No products found</h3>
                <p style="color: #666; margin-bottom: 2rem;">Try adjusting your filters or browse all categories</p>
                <button class="btn btn-primary" onclick="clearAllFilters()">Show All Products</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = shopState.filteredProducts.map(product => `
        <div class="product-card fade-in">
            <div class="product-image">
                <img src="assets/products/${product.image_front}" 
                     alt="${product.title}"
                     loading="lazy"
                     style="opacity: 1; transition: opacity 0.3s ease;"
                     onerror="this.src='assets/img/placeholder.png'">
                ${product.compare_at_price > 0 ? '<span class="product-badge">Sale</span>' : ''}
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-title">${product.title}</h3>
                <div class="product-price">
                    <span class="price-current">${window.LyrionUtils.formatPrice(product.price)}</span>
                    ${product.compare_at_price > 0 ? 
                        `<span class="price-compare">${window.LyrionUtils.formatPrice(product.compare_at_price)}</span>` : 
                        ''}
                </div>
                <p class="product-description">${product.description}</p>
                <div class="product-actions">
                    <a href="product.html?sku=${product.sku}" class="btn btn-primary btn-full">View Details</a>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// UPDATE PRODUCT COUNT
// ==========================================
function updateProductCount() {
    const countElement = document.getElementById('productCount');
    if (countElement) {
        countElement.textContent = shopState.filteredProducts.length;
    }
}

// ==========================================
// LOADING STATES
// ==========================================
function showLoadingState() {
    const container = document.getElementById('productGrid');
    if (container) {
        container.innerHTML = `
            <div class="product-card">
                <div class="product-image">
                    <div class="skeleton skeleton-image"></div>
                </div>
                <div class="product-info">
                    <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width: 40%;"></div>
                </div>
            </div>
            <div class="product-card">
                <div class="product-image">
                    <div class="skeleton skeleton-image"></div>
                </div>
                <div class="product-info">
                    <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width: 40%;"></div>
                </div>
            </div>
            <div class="product-card">
                <div class="product-image">
                    <div class="skeleton skeleton-image"></div>
                </div>
                <div class="product-info">
                    <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width: 40%;"></div>
                </div>
            </div>
            <div class="product-card">
                <div class="product-image">
                    <div class="skeleton skeleton-image"></div>
                </div>
                <div class="product-info">
                    <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width: 40%;"></div>
                </div>
            </div>
        `;
    }
    
    shopState.loading = true;
}

function hideLoadingState() {
    shopState.loading = false;
}

// ==========================================
// ERROR STATE
// ==========================================
function showErrorState(message) {
    const container = document.getElementById('productGrid');
    if (container) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">⚠️</div>
                <h3 style="margin-bottom: 1rem; color: var(--color-ink);">Unable to Load Products</h3>
                <p style="color: #666; margin-bottom: 2rem;">${message}</p>
                <button class="btn btn-primary" onclick="initShop()">Try Again</button>
            </div>
        `;
    }
}

// ==========================================
// URL PARAMETERS HANDLING
// ==========================================
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Category from URL
    const category = urlParams.get('category');
    if (category) {
        const categoryBtn = document.querySelector(`[data-filter="category"][data-value="${category}"]`);
        if (categoryBtn) {
            categoryBtn.click();
        }
    }
    
    // Zodiac from URL
    const zodiac = urlParams.get('zodiac');
    if (zodiac) {
        const zodiacBtn = document.querySelector(`[data-filter="zodiac"][data-value="${zodiac}"]`);
        if (zodiacBtn) {
            zodiacBtn.click();
        }
    }
}

// ==========================================
// INITIALIZE ON DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Only run on shop page
    if (document.getElementById('productGrid')) {
        initShop().then(() => {
            // Handle URL parameters after initialization
            handleUrlParameters();
        });
    }
});

// ==========================================
// EXPOSE FUNCTIONS GLOBALLY
// ==========================================
window.ShopAPI = {
    initShop,
    applyFilters,
    clearAllFilters
};