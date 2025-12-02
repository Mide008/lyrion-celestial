/**
 * LYRĪON - Live Search
 * Real-time product search with instant results
 */

// ==========================================
// SEARCH STATE
// ==========================================
let allProducts = [];
let searchTimeout = null;

// ==========================================
// INITIALIZE SEARCH
// ==========================================
async function initSearch() {
    try {
        // Load all products
        const response = await fetch('data/products.json');
        allProducts = await response.json();
        
        // Set up event listeners
        setupSearchListeners();
    } catch (error) {
        console.error('Error loading products for search:', error);
    }
}

// ==========================================
// SETUP EVENT LISTENERS
// ==========================================
function setupSearchListeners() {
    const searchBtn = document.getElementById('searchBtn');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchClose = document.getElementById('searchClose');
    const searchInput = document.getElementById('searchInput');
    
    // Open search overlay
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            openSearch();
        });
    }
    
    // Close search overlay
    if (searchClose) {
        searchClose.addEventListener('click', () => {
            closeSearch();
        });
    }
    
    // Close on overlay click
    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                closeSearch();
            }
        });
    }
    
    // Close with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchOverlay && searchOverlay.style.display === 'block') {
            closeSearch();
        }
    });
    
    // Search input with debounce
    if (searchInput) {
        searchInput.addEventListener('input', window.LyrionUtils.debounce((e) => {
            performSearch(e.target.value);
        }, 300));
        
        // Handle Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    // Redirect to shop with search query
                    window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
                }
            }
        });
    }
}

// ==========================================
// OPEN SEARCH OVERLAY
// ==========================================
function openSearch() {
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    
    if (searchOverlay) {
        searchOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Focus input after animation
        setTimeout(() => {
            if (searchInput) {
                searchInput.focus();
            }
        }, 100);
    }
}

// ==========================================
// CLOSE SEARCH OVERLAY
// ==========================================
function closeSearch() {
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (searchOverlay) {
        searchOverlay.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Clear input and results
    if (searchInput) {
        searchInput.value = '';
    }
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('active');
    }
}

// ==========================================
// PERFORM SEARCH
// ==========================================
function performSearch(query) {
    const searchResults = document.getElementById('searchResults');
    
    if (!searchResults) return;
    
    // Clear if query is empty
    if (!query || query.trim().length < 2) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('active');
        return;
    }
    
    query = query.toLowerCase().trim();
    
    // Search across multiple fields
    const results = allProducts.filter(product => {
        const searchableText = [
            product.title,
            product.description,
            product.category,
            product.zodiac_sign,
            ...(product.tags || [])
        ].join(' ').toLowerCase();
        
        return searchableText.includes(query);
    });
    
    // Render results
    renderSearchResults(results, query);
}

// ==========================================
// RENDER SEARCH RESULTS
// ==========================================
function renderSearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    
    if (!searchResults) return;
    
    // No results
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--color-cream);">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">No products found for "${query}"</p>
                <a href="shop.html" class="btn btn-outline" onclick="closeSearch()" style="border-color: var(--color-gold-accent); color: var(--color-cream);">
                    Browse All Products
                </a>
            </div>
        `;
        searchResults.classList.add('active');
        return;
    }
    
    // Limit to 8 results in overlay
    const limitedResults = results.slice(0, 8);
    
    searchResults.innerHTML = `
        <div style="max-height: 500px; overflow-y: auto;">
            ${limitedResults.map(product => `
                <a href="product.html?sku=${product.sku}" 
                   class="search-result-item"
                   onclick="closeSearch()">
                    <img src="assets/products/${product.image_front}" 
                         alt="${product.title}"
                         class="search-result-image"
                         onerror="this.src='assets/img/placeholder.png'">
                    <div class="search-result-info">
                        <div class="search-result-title">${highlightQuery(product.title, query)}</div>
                        <div style="font-size: 0.85rem; color: var(--color-gold-accent); margin-bottom: 0.25rem;">
                            ${product.category}${product.zodiac_sign && product.zodiac_sign !== 'None' ? ` • ${product.zodiac_sign}` : ''}
                        </div>
                        <div class="search-result-price">${window.LyrionUtils.formatPrice(product.price)}</div>
                    </div>
                </a>
            `).join('')}
        </div>
        
        ${results.length > 8 ? `
            <div style="padding: 1rem; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
                <a href="shop.html?search=${encodeURIComponent(query)}" 
                   class="btn btn-outline"
                   onclick="closeSearch()"
                   style="border-color: var(--color-gold-accent); color: var(--color-cream);">
                    View All ${results.length} Results
                </a>
            </div>
        ` : ''}
    `;
    
    searchResults.classList.add('active');
}

// ==========================================
// HIGHLIGHT SEARCH QUERY IN RESULTS
// ==========================================
function highlightQuery(text, query) {
    if (!query || query.length < 2) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span style="background: var(--color-gold-accent); color: var(--color-ink); padding: 0 2px; border-radius: 2px;">$1</span>');
}

// ==========================================
// SEARCH FROM SHOP PAGE (URL PARAMS)
// ==========================================
function getSearchQueryFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('search');
}

// ==========================================
// FILTER PRODUCTS BY SEARCH QUERY
// ==========================================
function filterProductsBySearch(products, query) {
    if (!query || query.trim().length < 2) {
        return products;
    }
    
    query = query.toLowerCase().trim();
    
    return products.filter(product => {
        const searchableText = [
            product.title,
            product.description,
            product.category,
            product.zodiac_sign,
            ...(product.tags || [])
        ].join(' ').toLowerCase();
        
        return searchableText.includes(query);
    });
}

// ==========================================
// SEARCH SUGGESTIONS (ZODIAC SIGNS)
// ==========================================
const zodiacSuggestions = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 
    'Leo', 'Virgo', 'Libra', 'Scorpio', 
    'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

function getSearchSuggestions(query) {
    if (!query || query.length < 2) return [];
    
    query = query.toLowerCase();
    
    // Search zodiac signs
    const zodiacMatches = zodiacSuggestions.filter(sign => 
        sign.toLowerCase().includes(query)
    );
    
    // Search categories
    const categoryMatches = ['Men', 'Women', 'Moon Girls', 'Star Boys', 'Home', 'Accessories']
        .filter(cat => cat.toLowerCase().includes(query));
    
    return [...zodiacMatches, ...categoryMatches];
}

// ==========================================
// KEYBOARD NAVIGATION IN SEARCH RESULTS
// ==========================================
let selectedResultIndex = -1;

function setupKeyboardNavigation() {
    const searchInput = document.getElementById('searchInput');
    
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            const results = document.querySelectorAll('.search-result-item');
            
            if (results.length === 0) return;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedResultIndex = Math.min(selectedResultIndex + 1, results.length - 1);
                updateSelectedResult(results);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
                updateSelectedResult(results);
            } else if (e.key === 'Enter' && selectedResultIndex >= 0) {
                e.preventDefault();
                results[selectedResultIndex].click();
            }
        });
    }
}

function updateSelectedResult(results) {
    results.forEach((result, index) => {
        if (index === selectedResultIndex) {
            result.style.background = 'rgba(184, 134, 11, 0.2)';
            result.scrollIntoView({ block: 'nearest' });
        } else {
            result.style.background = '';
        }
    });
}

// ==========================================
// INITIALIZE ON DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    setupKeyboardNavigation();
});

// ==========================================
// EXPOSE FUNCTIONS GLOBALLY
// ==========================================
window.SearchAPI = {
    performSearch,
    getSearchQueryFromURL,
    filterProductsBySearch,
    openSearch,
    closeSearch
};