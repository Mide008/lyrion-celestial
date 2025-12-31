/**
 * LYRĪON - Cosmic Reader - SIMPLIFIED WORKING VERSION
 * Floating orb with birth chart analysis - WITH ASTROLOGY API INTEGRATION
 */

// ==========================================
// CONFIGURATION - ASTROLOGY API
// ==========================================
const COSMIC_WORKER_URL = "https://lyrion-order-broker.hello-2a3.workers.dev";

// ==========================================
// COSMIC READER STATE
// ==========================================
const CosmicReader = {
    orb: null,
    modal: null,
    initialized: false,
    
    // Zodiac data with date ranges
    zodiacSigns: {
        aries: { name: 'Aries', symbol: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'Mars' },
        taurus: { name: 'Taurus', symbol: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus' },
        gemini: { name: 'Gemini', symbol: '♊', element: 'Air', modality: 'Mutable', ruler: 'Mercury' },
        cancer: { name: 'Cancer', symbol: '♋', element: 'Water', modality: 'Cardinal', ruler: 'Moon' },
        leo: { name: 'Leo', symbol: '♌', element: 'Fire', modality: 'Fixed', ruler: 'Sun' },
        virgo: { name: 'Virgo', symbol: '♍', element: 'Earth', modality: 'Mutable', ruler: 'Mercury' },
        libra: { name: 'Libra', symbol: '♎', element: 'Air', modality: 'Cardinal', ruler: 'Venus' },
        scorpio: { name: 'Scorpio', symbol: '♏', element: 'Water', modality: 'Fixed', ruler: 'Pluto' },
        sagittarius: { name: 'Sagittarius', symbol: '♐', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter' },
        capricorn: { name: 'Capricorn', symbol: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn' },
        aquarius: { name: 'Aquarius', symbol: '♒', element: 'Air', modality: 'Fixed', ruler: 'Uranus' },
        pisces: { name: 'Pisces', symbol: '♓', element: 'Water', modality: 'Mutable', ruler: 'Neptune' }
    }
};

// ==========================================
// VALIDATION FUNCTIONS (ULTRA SIMPLE)
// ==========================================
function validateBirthDate(dateStr) {
    console.log('VALIDATE DATE INPUT:', dateStr);
    
    if (!dateStr || dateStr.trim() === '') {
        console.error('DATE IS EMPTY!');
        return false;
    }
    
    // Just check if it's a valid date string
    const date = new Date(dateStr);
    const isValid = !isNaN(date.getTime());
    
    console.log('Date validation result:', isValid, 'Parsed as:', date);
    return isValid;
}

function validateBirthCity(city) {
    const isValid = city && city.trim().length > 0;
    console.log('City validation:', city, '->', isValid);
    return isValid;
}

// ==========================================
// INITIALIZE COSMIC READER
// ==========================================
function initCosmicReader() {
    if (CosmicReader.initialized) return;
    
    console.log('🌟 INITIALIZING COSMIC READER');
    
    CosmicReader.orb = document.getElementById('cosmicOrb');
    CosmicReader.modal = document.getElementById('cosmicModal');
    
    if (!CosmicReader.orb || !CosmicReader.modal) {
        console.error('Cosmic elements not found!');
        return;
    }
    
    // Setup orb click
    CosmicReader.orb.addEventListener('click', openCosmicModal);
    
    // Setup modal interactions
    setupCosmicModalInteractions();
    
    CosmicReader.initialized = true;
    console.log('✅ COSMIC READER INITIALIZED');
}

// ==========================================
// SETUP MODAL INTERACTIONS
// ==========================================
function setupCosmicModalInteractions() {
    const modal = CosmicReader.modal;
    const closeBtn = modal.querySelector('.cosmic-modal-close');
    const overlay = modal.querySelector('.cosmic-modal-overlay');
    const form = document.getElementById('cosmicForm');
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCosmicModal);
    }
    
    // Click overlay to close
    if (overlay) {
        overlay.addEventListener('click', closeCosmicModal);
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeCosmicModal();
        }
    });

    // Form submission
    if (form) {
        console.log('Found form, setting up submit handler');
        
        // DEBUG: Get initial input values
        const dateInput = document.getElementById('birthDate');
        const cityInput = document.getElementById('birthCity');
        const timeInput = document.getElementById('birthTime');
        
        console.log('Initial input states:');
        console.log('Date input:', dateInput?.value);
        console.log('City input:', cityInput?.value);
        console.log('Time input:', timeInput?.value);
        
        // Add input event listeners for debugging
        if (dateInput) {
            dateInput.addEventListener('input', (e) => {
                console.log('Date input changed:', e.target.value);
            });
        }
        
        if (cityInput) {
            cityInput.addEventListener('input', (e) => {
                console.log('City input changed:', e.target.value);
            });
        }
        
        form.addEventListener('submit', handleCosmicFormSubmit);
        
        // DEBUG: Log all form inputs
        const inputs = form.querySelectorAll('input, textarea');
        console.log('Form inputs found:', inputs.length);
        inputs.forEach(input => {
            console.log(`Input: ${input.id || input.name || 'unnamed'}`, {
                type: input.type,
                value: input.value,
                required: input.required,
                id: input.id,
                name: input.name
            });
        });
    } else {
        console.error('FORM NOT FOUND: #cosmicForm');
    }
}

// ==========================================
// OPEN COSMIC MODAL
// ==========================================
function openCosmicModal() {
    console.log('OPENING MODAL');
    
    CosmicReader.modal.classList.add('active');
    document.body.classList.add('modal-open');
    
    // Reset to step 1
    document.getElementById('cosmicStep1').classList.remove('cosmic-step-hidden');
    document.getElementById('cosmicStep2').classList.add('cosmic-step-hidden');

    // FIX: Create manual date input if HTML5 date input doesn't work
    const dateInput = document.getElementById('birthDate');
    if (dateInput) {
        // Set max date to today
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        dateInput.max = todayStr;
        console.log('Date input configured. Max date:', todayStr);
        
        // Force focus and select
        setTimeout(() => {
            dateInput.focus();
            dateInput.select();
        }, 100);
    }
}

// ==========================================
// CLOSE COSMIC MODAL
// ==========================================
function closeCosmicModal() {
    console.log('CLOSING MODAL');
    
    CosmicReader.modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    
    // Reset form
    const form = document.getElementById('cosmicForm');
    if (form) {
        form.reset();
    }
}

// ==========================================
// HANDLE FORM SUBMIT WITH ASTROLOGY API
// ==========================================
async function handleCosmicFormSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🚀 FORM SUBMITTED');
    console.log('Event target:', e.target);
    console.log('Event target elements:', e.target.elements);
    
    // DEBUG: Check ALL possible ways to get values
    console.log('=== DEBUGGING INPUT VALUES ===');
    
    // Check by ID
    const dateById = document.getElementById('birthDate');
    const cityById = document.getElementById('birthCity');
    console.log('By ID - date:', dateById?.value, 'city:', cityById?.value);
    
    // Check by name
    const dateByName = document.querySelector('[name="birthDate"]');
    const cityByName = document.querySelector('[name="birthCity"]');
    console.log('By name - date:', dateByName?.value, 'city:', cityByName?.value);
    
    // Check form elements collection
    if (e.target.elements) {
        console.log('Form elements collection:');
        for (let i = 0; i < e.target.elements.length; i++) {
            const el = e.target.elements[i];
            if (el.name || el.id) {
                console.log(`  ${el.name || el.id}: "${el.value}"`);
            }
        }
    }
    
    // ULTIMATE FIX: Get values DIRECTLY from the visible inputs with multiple fallbacks
    let birthDate = '';
    let birthCity = '';
    
    // METHOD 1: Query selector with all possible selectors
    const dateSelectors = [
        '#birthDate',
        '[name="birthDate"]',
        '[name="birth-date"]',
        'input[type="date"]',
        '.birth-date-input',
        'input[name*="date"]'
    ];
    
    const citySelectors = [
        '#birthCity',
        '[name="birthCity"]',
        '[name="birth-city"]',
        'input[type="text"][name*="city"]',
        'input[name*="city"]',
        '.birth-city-input'
    ];
    
    // Try all date selectors
    for (const selector of dateSelectors) {
        const el = document.querySelector(selector);
        if (el && el.value) {
            birthDate = el.value;
            console.log(`Found date with selector "${selector}":`, birthDate);
            break;
        }
    }
    
    // Try all city selectors
    for (const selector of citySelectors) {
        const el = document.querySelector(selector);
        if (el && el.value) {
            birthCity = el.value.trim();
            console.log(`Found city with selector "${selector}":`, birthCity);
            break;
        }
    }
    
    // METHOD 2: If still empty, try to find ANY input in the form
    if (!birthDate || !birthCity) {
        const allInputs = document.querySelectorAll('#cosmicForm input');
        console.log('All form inputs:', allInputs.length);
        allInputs.forEach((input, index) => {
            console.log(`Input ${index}:`, {
                id: input.id,
                name: input.name,
                type: input.type,
                value: input.value,
                placeholder: input.placeholder
            });
            
            // Smart detection based on input properties
            if (!birthDate && (
                input.type === 'date' || 
                input.id?.includes('date') || 
                input.name?.includes('date') ||
                input.placeholder?.includes('date')
            )) {
                birthDate = input.value;
                console.log('Detected as date input:', birthDate);
            }
            
            if (!birthCity && (
                input.type === 'text' || 
                input.id?.includes('city') || 
                input.name?.includes('city') ||
                input.placeholder?.includes('city')
            )) {
                birthCity = input.value.trim();
                console.log('Detected as city input:', birthCity);
            }
        });
    }
    
    console.log('FINAL EXTRACTED VALUES - Date:', birthDate, 'City:', birthCity);
    
    // SIMPLE VALIDATION
    if (!birthDate || birthDate.trim() === '') {
        showCosmicError('Please select your birth date from the calendar');
        // Show calendar
        if (dateById && dateById.type === 'date') {
            try {
                dateById.showPicker ? dateById.showPicker() : dateById.focus();
            } catch (err) {
                console.log('Could not show picker:', err);
            }
        }
        return;
    }
    
    if (!birthCity || birthCity.trim() === '') {
        showCosmicError('Please enter your birth city');
        if (cityById) cityById.focus();
        return;
    }
    
    // Show loading
    const submitBtn = e.target.querySelector('.cosmic-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Reading the stars...';
    
    // Clear any previous errors
    clearCosmicError();
    
    console.log('✅ Starting reading generation with:', birthDate, birthCity);
    
    try {
        // Calculate sun sign
        const date = new Date(birthDate);
        console.log('Parsed date:', date);
        
        if (isNaN(date.getTime())) {
            // Try alternative date format
            const dateParts = birthDate.split(/[-\/]/);
            if (dateParts.length === 3) {
                // Try different parsing
                const altDate = new Date(`${dateParts[2]}-${dateParts[0]}-${dateParts[1]}`);
                if (!isNaN(altDate.getTime())) {
                    date = altDate;
                    console.log('Parsed with alternative format:', date);
                }
            }
            
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date format. Please use YYYY-MM-DD or MM/DD/YYYY');
            }
        }
        
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const sunSign = calculateSunSign(month, day);
        const signData = CosmicReader.zodiacSigns[sunSign];
        
        console.log('Sun sign calculated:', sunSign, signData);
        
        // Show immediate loading reading
        const immediateReading = {
            sunSign: signData,
            date: birthDate,
            time: 'Unknown',
            location: birthCity,
            reading: {
                essence: `Analyzing your ${signData.name} Sun energy...`,
                moon: 'Calculating lunar influences...',
                rising: 'Determining ascendant patterns...',
                deeper: 'Synthesizing cosmic insights...'
            }
        };
        
        displayCosmicReading(immediateReading);
        document.getElementById('cosmicStep1').classList.add('cosmic-step-hidden');
        document.getElementById('cosmicStep2').classList.remove('cosmic-step-hidden');
        
        // Try to get AI reading
        try {
            const aiReading = await getAIAstrologyReading(birthDate, '', birthCity, signData);
            console.log('✅ AI reading received');
            displayCosmicReading(aiReading);
        } catch (aiError) {
            console.warn('AI reading failed, using local:', aiError);
            // Use local reading as fallback
            const localReading = {
                sunSign: signData,
                date: birthDate,
                time: 'Unknown',
                location: birthCity,
                reading: generateLocalReading(signData, birthDate)
            };
            displayCosmicReading(localReading);
            showCosmicToast('Using local astrological calculations', 'info');
        }
        
    } catch (error) {
        console.error('❌ Reading generation failed:', error);
        showCosmicError(`Error: ${error.message}. Please try a different date format (YYYY-MM-DD or MM/DD/YYYY).`);
        
        // Reset form
        document.getElementById('cosmicStep1').classList.remove('cosmic-step-hidden');
        document.getElementById('cosmicStep2').classList.add('cosmic-step-hidden');
        
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ==========================================
// GET AI ASTROLOGY READING
// ==========================================
async function getAIAstrologyReading(birthDate, birthTime, birthCity, signData) {
    console.log('Calling AI astrology API...');
    
    const prompt = `As a professional astrologer, provide a short cosmic reading for someone born on ${birthDate} in ${birthCity}.

Sun sign: ${signData.name} (${signData.element} element, ${signData.modality} modality, ruled by ${signData.ruler}).

Provide 4 short sections:
1. ESSENCE: Core personality
2. LUNAR INFLUENCE: Emotional nature  
3. RISING PATTERNS: How they're perceived
4. DEEPER INSIGHTS: Current cosmic advice

Keep each section to 2-3 sentences. Be insightful and empowering.`;

    try {
        const response = await fetch(`${COSMIC_WORKER_URL}/astrology-reading`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                birthData: {
                    date: birthDate,
                    city: birthCity,
                    sunSign: signData.name
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const aiResponse = await response.json();
        const content = aiResponse.content || aiResponse.text || '';
        
        return {
            sunSign: signData,
            date: birthDate,
            time: birthTime || 'Unknown',
            location: birthCity,
            reading: parseAIResponse(content)
        };
        
    } catch (error) {
        console.error('AI astrology error:', error);
        throw error;
    }
}

// ==========================================
// PARSE AI RESPONSE
// ==========================================
function parseAIResponse(aiText) {
    const sections = {
        essence: "Your cosmic essence reveals unique strengths waiting to be expressed.",
        moon: "Your emotional landscape guides your relationships and intuition.",
        rising: "The persona you show the world conceals deeper spiritual dimensions.",
        deeper: "Current celestial patterns suggest a period of growth and self-discovery."
    };
    
    if (!aiText) return sections;
    
    // Simple parsing
    const lines = aiText.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
        const trimmed = line.trim().toLowerCase();
        
        if (trimmed.includes('essence') || trimmed.includes('core') || trimmed.includes('sun')) {
            currentSection = 'essence';
            sections.essence = line.replace(/^[0-9\.\s]+/, '').trim();
        } else if (trimmed.includes('lunar') || trimmed.includes('moon') || trimmed.includes('emotional')) {
            currentSection = 'moon';
            sections.moon = line.replace(/^[0-9\.\s]+/, '').trim();
        } else if (trimmed.includes('rising') || trimmed.includes('perceived') || trimmed.includes('first')) {
            currentSection = 'rising';
            sections.rising = line.replace(/^[0-9\.\s]+/, '').trim();
        } else if (trimmed.includes('deeper') || trimmed.includes('insight') || trimmed.includes('advice')) {
            currentSection = 'deeper';
            sections.deeper = line.replace(/^[0-9\.\s]+/, '').trim();
        } else if (currentSection && trimmed && !trimmed.match(/^\d/)) {
            sections[currentSection] += ' ' + trimmed;
        }
    }
    
    return sections;
}

// ==========================================
// GENERATE LOCAL READING
// ==========================================
function generateLocalReading(signData, birthDate) {
    const readings = {
        aries: {
            essence: `As an Aries Sun, you're a natural leader with Mars' warrior energy. Your Fire element gives you passion and initiative.`,
            moon: `Your emotions are direct and action-oriented. You process feelings quickly and value authenticity.`,
            rising: `You make strong first impressions as someone decisive and energetic, ready to take on challenges.`,
            deeper: `Current transits favor bold new beginnings. The next 3 months bring opportunities for leadership.`
        },
        taurus: {
            essence: `As a Taurus Sun, Venus blesses you with appreciation for beauty and stability. Your Earth element keeps you grounded.`,
            moon: `Your emotions are deep and enduring. You need security and tangible expressions of care.`,
            rising: `You present as reliable and calm. People trust your steady, practical presence.`,
            deeper: `Focus on building secure foundations. Financial and creative matters are highlighted.`
        },
        gemini: {
            essence: `As a Gemini Sun, Mercury gives you intellectual curiosity and communication skills. Your Air element makes you social.`,
            moon: `Your emotions are complex and changeable. You process feelings through conversation and ideas.`,
            rising: `You appear curious and engaged, often seeming younger than your years with quick wit.`,
            deeper: `Communication and learning opportunities abound. Network and share your ideas.`
        }
    };
    
    return readings[signData.name.toLowerCase()] || readings.aries;
}

// ==========================================
// CALCULATE SUN SIGN
// ==========================================
function calculateSunSign(month, day) {
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'pisces';
    return 'aries';
}

// ==========================================
// DISPLAY COSMIC READING
// ==========================================
function displayCosmicReading(data) {
    const resultsContainer = document.querySelector('#cosmicStep2 .cosmic-results');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="cosmic-results-header">
            <div class="cosmic-sign-icon">${data.sunSign.symbol}</div>
            <h2>${data.sunSign.name} Sun</h2>
            <p class="cosmic-element">${data.sunSign.element} · ${data.sunSign.modality} · Ruled by ${data.sunSign.ruler}</p>
        </div>
        
        <div class="cosmic-reading-content">
            <div class="reading-section">
                <h3>Your Essence</h3>
                <p>${data.reading.essence}</p>
            </div>
            
            <div class="reading-section">
                <h3>Lunar Influence</h3>
                <p>${data.reading.moon}</p>
            </div>
            
            <div class="reading-section">
                <h3>Rising Patterns</h3>
                <p>${data.reading.rising}</p>
            </div>
            
            <div class="reading-section reading-deeper">
                <h3>Deeper Cosmic Insights</h3>
                <p>${data.reading.deeper}</p>
            </div>
            
            <div class="cosmic-cta">
                <p class="cosmic-cta-text">
                    This cosmic snapshot reveals your celestial blueprint. For a complete natal chart analysis, 
                    transit forecasts, and personalized guidance from our expert readers...
                </p>
                
                <div class="cosmic-actions">
                    <a href="oracle.html" class="btn btn-primary">Explore Full Readings</a>
                    <button onclick="tryAnotherDate()" class="btn btn-outline">Try Another Date</button>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function tryAnotherDate() {
    document.getElementById('cosmicStep2').classList.add('cosmic-step-hidden');
    document.getElementById('cosmicStep1').classList.remove('cosmic-step-hidden');
    
    const form = document.getElementById('cosmicForm');
    if (form) form.reset();
    
    // Focus on date input
    setTimeout(() => {
        const dateInput = document.getElementById('birthDate');
        if (dateInput) {
            dateInput.focus();
            dateInput.select();
        }
    }, 100);
}

function showCosmicError(message) {
    console.error('SHOWING ERROR:', message);
    
    // Remove any existing error
    clearCosmicError();
    
    // Create new error
    const errorEl = document.createElement('div');
    errorEl.id = 'cosmicError';
    errorEl.style.cssText = `
        background: #FEE;
        color: #C00;
        padding: 12px 16px;
        border-radius: 6px;
        margin: 15px 0;
        border-left: 4px solid #C00;
        font-size: 14px;
        animation: fadeIn 0.3s ease;
        position: relative;
    `;
    
    errorEl.innerHTML = `
        <strong>⚠️ Error:</strong> ${message}
        <button onclick="clearCosmicError()" style="
            position: absolute;
            right: 10px;
            top: 10px;
            background: none;
            border: none;
            color: #C00;
            cursor: pointer;
            font-size: 18px;
        ">×</button>
    `;
    
    const form = document.getElementById('cosmicForm');
    if (form) {
        form.insertBefore(errorEl, form.firstChild);
    }
}

function clearCosmicError() {
    const errorEl = document.getElementById('cosmicError');
    if (errorEl && errorEl.parentNode) {
        errorEl.parentNode.removeChild(errorEl);
    }
}

function showCosmicToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'error' ? '#FEE' : type === 'success' ? '#EFE' : '#EFF'};
        color: ${type === 'error' ? '#C00' : type === 'success' ? '#080' : '#008'};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
        border-left: 4px solid ${type === 'error' ? '#C00' : type === 'success' ? '#080' : '#008'};
        max-width: 300px;
        font-size: 14px;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// ==========================================
// INITIALIZE ON DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 COSMIC READER: DOM Loaded');
    
    if (document.getElementById('cosmicOrb')) {
        console.log('🎯 Found cosmic orb, initializing...');
        initCosmicReader();
    }
});

// Export for global access
window.CosmicReader = CosmicReader;
window.tryAnotherDate = tryAnotherDate;
window.clearCosmicError = clearCosmicError;