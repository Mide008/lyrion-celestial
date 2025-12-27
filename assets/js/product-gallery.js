/**
 * LYRĪON - Product Gallery
 * Multi-image viewer for product pages
 */

// ==========================================
// PRODUCT GALLERY STATE
// ==========================================
const ProductGallery = {
    currentProduct: null,
    currentImageIndex: 0,
    images: [],
    touchStartX: 0,
    touchEndX: 0
};

// ==========================================
// INITIALIZE PRODUCT GALLERY
// ==========================================
function initProductGallery(product) {
    ProductGallery.currentProduct = product;
    
    // Collect all available images
    ProductGallery.images = [
        product.image_front,
        product.image_back,
        product.image_side,
        product.image_detail
    ].filter(Boolean); // Remove null/undefined
    
    if (ProductGallery.images.length === 0) {
        console.warn('No images available for product');
        return;
    }
    
    ProductGallery.currentImageIndex = 0;
    
    // Render gallery
    renderProductGallery();
    
    // Setup interactions
    setupGalleryInteractions();
    
    console.log(`✅ Product gallery initialized with ${ProductGallery.images.length} images`);
}

// ==========================================
// RENDER PRODUCT GALLERY
// ==========================================
function renderProductGallery() {
    const container = document.querySelector('.product-images-section');
    if (!container) return;
    
    const images = ProductGallery.images;
    
    container.innerHTML = `
        <div class="main-product-image">
            <img id="mainProductImage" 
                 src="assets/products/${images[0]}" 
                 alt="${ProductGallery.currentProduct.title}"
                 onerror="this.src='assets/img/placeholder.png'">
            ${images.length > 1 ? `
                <button class="gallery-nav gallery-prev" aria-label="Previous image">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <button class="gallery-nav gallery-next" aria-label="Next image">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </button>
                <div class="gallery-indicators">
                    ${images.map((_, index) => `
                        <button class="gallery-indicator ${index === 0 ? 'active' : ''}" 
                                data-index="${index}"
                                aria-label="View image ${index + 1}"></button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        
        ${images.length > 1 ? `
            <div class="product-thumbnails">
                ${images.map((img, index) => `
                    <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                         data-index="${index}">
                        <img src="assets/products/${img}" 
                             alt="${ProductGallery.currentProduct.title}"
                             onerror="this.src='assets/img/placeholder.png'">
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

// ==========================================
// SETUP GALLERY INTERACTIONS
// ==========================================
function setupGalleryInteractions() {
    // Thumbnail clicks
    document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
        thumb.addEventListener('click', () => {
            changeImage(index);
        });
    });
    
    // Navigation buttons
    const prevBtn = document.querySelector('.gallery-prev');
    const nextBtn = document.querySelector('.gallery-next');
    
    if (prevBtn) prevBtn.addEventListener('click', () => changeImage(ProductGallery.currentImageIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => changeImage(ProductGallery.currentImageIndex + 1));
    
    // Indicator clicks
    document.querySelectorAll('.gallery-indicator').forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            changeImage(index);
        });
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNav);
    
    // Touch/swipe support
    const mainImage = document.getElementById('mainProductImage');
    if (mainImage) {
        mainImage.addEventListener('touchstart', handleTouchStart, { passive: true });
        mainImage.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    // Image zoom on click (desktop)
    if (mainImage && window.innerWidth > 768) {
        mainImage.style.cursor = 'zoom-in';
        mainImage.addEventListener('click', () => {
            mainImage.classList.toggle('zoomed');
            mainImage.style.cursor = mainImage.classList.contains('zoomed') ? 'zoom-out' : 'zoom-in';
        });
    }
}

// ==========================================
// CHANGE IMAGE
// ==========================================
function changeImage(newIndex) {
    const images = ProductGallery.images;
    
    // Wrap around
    if (newIndex < 0) newIndex = images.length - 1;
    if (newIndex >= images.length) newIndex = 0;
    
    ProductGallery.currentImageIndex = newIndex;
    
    // Update main image with fade
    const mainImg = document.getElementById('mainProductImage');
    if (mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(() => {
            mainImg.src = `assets/products/${images[newIndex]}`;
            mainImg.style.opacity = '1';
        }, 200);
    }
    
    // Update thumbnails
    document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === newIndex);
    });
    
    // Update indicators
    document.querySelectorAll('.gallery-indicator').forEach((indicator, index) => {
        indicator.classList.toggle('active', index === newIndex);
    });
}

// ==========================================
// KEYBOARD NAVIGATION
// ==========================================
function handleKeyboardNav(e) {
    if (!ProductGallery.images || ProductGallery.images.length <= 1) return;
    
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        changeImage(ProductGallery.currentImageIndex - 1);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        changeImage(ProductGallery.currentImageIndex + 1);
    }
}

// ==========================================
// TOUCH/SWIPE SUPPORT
// ==========================================
function handleTouchStart(e) {
    ProductGallery.touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    ProductGallery.touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const minSwipeDistance = 50;
    const diff = ProductGallery.touchStartX - ProductGallery.touchEndX;
    
    if (Math.abs(diff) < minSwipeDistance) return;
    
    if (diff > 0) {
        // Swiped left - next image
        changeImage(ProductGallery.currentImageIndex + 1);
    } else {
        // Swiped right - previous image
        changeImage(ProductGallery.currentImageIndex - 1);
    }
}

// Export for global access
window.ProductGallery = {
    init: initProductGallery,
    changeImage: changeImage
};