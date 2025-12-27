/**
 * LYRĪON - Cosmic Reader
 * Floating orb with birth chart analysis - WITH ASTROLOGY API INTEGRATION
 */

// ==========================================
// CONFIGURATION - ASTROLOGY API
// ==========================================
const WORKER_URL = "https://api.lyrion.co.uk/readings/astrology"; // Cloudflare Worker URL to proxy requests
// You will send your request to this URL instead of Anthropic directly.
// Using Anthropic's Claude API for astrology interpretations
const ASTROLOGY_API_URL = 'https://api.anthropic.com/v1/messages';
// const WORKER_URL = 'https://lyrion-order-broker.hello-2a3.workers.dev';

// ==========================================
// COSMIC READER STATE
// ==========================================
const CosmicReader = {
    orb: null,
    modal: null,
    initialized: false,
    
    // Zodiac data with date ranges
    zodiacSigns: {
        aries: { 
            name: 'Aries', 
            symbol: '♈', 
            element: 'Fire',
            modality: 'Cardinal',
            ruler: 'Mars',
            dates: { start: [3, 21], end: [4, 19] }
        },
        taurus: { 
            name: 'Taurus', 
            symbol: '♉', 
            element: 'Earth',
            modality: 'Fixed',
            ruler: 'Venus',
            dates: { start: [4, 20], end: [5, 20] }
        },
        gemini: { 
            name: 'Gemini', 
            symbol: '♊', 
            element: 'Air',
            modality: 'Mutable',
            ruler: 'Mercury',
            dates: { start: [5, 21], end: [6, 20] }
        },
        cancer: { 
            name: 'Cancer', 
            symbol: '♋', 
            element: 'Water',
            modality: 'Cardinal',
            ruler: 'Moon',
            dates: { start: [6, 21], end: [7, 22] }
        },
        leo: { 
            name: 'Leo', 
            symbol: '♌', 
            element: 'Fire',
            modality: 'Fixed',
            ruler: 'Sun',
            dates: { start: [7, 23], end: [8, 22] }
        },
        virgo: { 
            name: 'Virgo', 
            symbol: '♍', 
            element: 'Earth',
            modality: 'Mutable',
            ruler: 'Mercury',
            dates: { start: [8, 23], end: [9, 22] }
        },
        libra: { 
            name: 'Libra', 
            symbol: '♎', 
            element: 'Air',
            modality: 'Cardinal',
            ruler: 'Venus',
            dates: { start: [9, 23], end: [10, 22] }
        },
        scorpio: { 
            name: 'Scorpio', 
            symbol: '♏', 
            element: 'Water',
            modality: 'Fixed',
            ruler: 'Pluto',
            dates: { start: [10, 23], end: [11, 21] }
        },
        sagittarius: { 
            name: 'Sagittarius', 
            symbol: '♐', 
            element: 'Fire',
            modality: 'Mutable',
            ruler: 'Jupiter',
            dates: { start: [11, 22], end: [12, 21] }
        },
        capricorn: { 
            name: 'Capricorn', 
            symbol: '♑', 
            element: 'Earth',
            modality: 'Cardinal',
            ruler: 'Saturn',
            dates: { start: [12, 22], end: [1, 19] }
        },
        aquarius: { 
            name: 'Aquarius', 
            symbol: '♒', 
            element: 'Air',
            modality: 'Fixed',
            ruler: 'Uranus',
            dates: { start: [1, 20], end: [2, 18] }
        },
        pisces: { 
            name: 'Pisces', 
            symbol: '♓', 
            element: 'Water',
            modality: 'Mutable',
            ruler: 'Neptune',
            dates: { start: [2, 19], end: [3, 20] }
        }
    }
};

// ==========================================
// INITIALIZE COSMIC READER
// ==========================================
function initCosmicReader() {
    if (CosmicReader.initialized) return;
    
    console.log('🌟 Initializing Cosmic Reader with Astrology API...');
    console.log('API Key available:', !!ASTROLOGY_API_KEY);
    
    CosmicReader.orb = document.getElementById('cosmicOrb');
    CosmicReader.modal = document.getElementById('cosmicModal');
    
    if (!CosmicReader.orb || !CosmicReader.modal) {
        console.error('Cosmic elements not found');
        return;
    }
    
    // Setup orb click
    CosmicReader.orb.addEventListener('click', openCosmicModal);
    
    // Setup modal interactions
    setupCosmicModalInteractions();
    
    CosmicReader.initialized = true;
    console.log('✅ Cosmic Reader initialized with Astrology API');
}

// ==========================================
// SETUP MODAL INTERACTIONS
// ==========================================
function setupCosmicModalInteractions() {
    const modal = CosmicReader.modal;
    const closeBtn = modal.querySelector('.cosmic-modal-close');
    const overlay = modal.querySelector('.cosmic-modal-overlay');
    const form = modal.querySelector('#cosmicForm');
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCosmicModal);
    }
    
    // Close buttons in results
    const closeButtons = modal.querySelectorAll('.cosmic-modal-close');
    closeButtons.forEach(btn => {
        if (btn !== closeBtn) {
            btn.addEventListener('click', closeCosmicModal);
        }
    });

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
        form.addEventListener('submit', handleCosmicFormSubmit);
    }
}

// ==========================================
// OPEN COSMIC MODAL
// ==========================================
function openCosmicModal() {
    CosmicReader.modal.classList.add('active');
    document.body.classList.add('modal-open');
    
    // Reset to step 1
    document.getElementById('cosmicStep1').classList.remove('cosmic-step-hidden');
    document.getElementById('cosmicStep2').classList.add('cosmic-step-hidden');

    // Set max date to today
    const dateInput = document.getElementById('birthDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.max = today;
        dateInput.focus();
    }
}

// ==========================================
// CLOSE COSMIC MODAL
// ==========================================
function closeCosmicModal() {
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
    
    const birthDate = document.getElementById('birthDate').value;
    const birthTime = document.getElementById('birthTime').value;
    const birthCity = document.getElementById('birthCity').value.trim();

    if (!birthDate) {
        showCosmicError('Please enter your birth date');
        return;
    }
    
    if (!birthCity) {
        showCosmicError('Please enter your birth city');
        return;
    }

    // Validate date is not in future
    const today = new Date().toISOString().split('T')[0];
    if (birthDate > today) {
        showCosmicError('Birth date cannot be in the future');
        return;
    }

    // Show loading
    const submitBtn = e.target.querySelector('.cosmic-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Reading the stars...';

    try {
        // First get local sun sign calculation
        const date = new Date(birthDate);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const sunSign = calculateSunSign(month, day);
        const signData = CosmicReader.zodiacSigns[sunSign];
        
        // Show immediate sign info
        const immediateReading = {
            sunSign: signData,
            date: birthDate,
            time: birthTime || 'Unknown',
            location: birthCity,
            reading: {
                essence: `Calculating your ${signData.name} energy...`,
                moon: 'Analyzing lunar influence...',
                rising: 'Determining ascendant patterns...',
                deeper: 'Synthesizing cosmic insights...'
            }
        };
        
        displayCosmicReading(immediateReading);
        document.getElementById('cosmicStep1').classList.add('cosmic-step-hidden');
        document.getElementById('cosmicStep2').classList.remove('cosmic-step-hidden');
        
        // Then fetch AI-powered reading
        const aiReading = await getAIAstrologyReading(birthDate, birthTime, birthCity, signData);
        
        // Update with AI insights
        displayCosmicReading(aiReading);
        
    } catch (error) {
        console.error('Error generating reading:', error);
        
        // Fallback to local calculation if API fails
        const date = new Date(birthDate);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const sunSign = calculateSunSign(month, day);
        const signData = CosmicReader.zodiacSigns[sunSign];
        
        const fallbackReading = {
            sunSign: signData,
            date: birthDate,
            time: birthTime || 'Unknown',
            location: birthCity,
            reading: generateLocalReading(signData, birthDate)
        };
        
        displayCosmicReading(fallbackReading);
        document.getElementById('cosmicStep1').classList.add('cosmic-step-hidden');
        document.getElementById('cosmicStep2').classList.remove('cosmic-step-hidden');
        
        // Show subtle error notice
        showCosmicToast('Using enhanced local calculations', 'info');
        
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ==========================================
// GET AI ASTROLOGY READING
// ==========================================
async function getAIAstrologyReading(birthDate, birthTime, birthCity, signData) {
    try {
        // Parse date for better prompting
        const dateObj = new Date(birthDate);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = dateObj.toLocaleDateString('en-US', options);
        
        // Create a comprehensive prompt for the AI
        const prompt = `As a professional astrologer, provide a personalized cosmic reading for someone born on ${formattedDate}${birthTime ? ' at ' + birthTime : ''} in ${birthCity}.

Their Sun sign is ${signData.name} (${signData.element} element, ${signData.modality} modality, ruled by ${signData.ruler}).

Please provide a reading with these sections:

1. ESSENCE (Sun Sign Analysis): 
   - Core personality traits and strengths
   - How their ${signData.element} element manifests
   - Their ${signData.modality} energy expression

2. LUNAR INFLUENCE (Emotional Landscape):
   - How their emotions likely operate
   - Intuitive gifts and emotional needs
   - Relationship with nurturing and being nurtured

3. RISING PATTERNS (How They're Perceived):
   - First impressions they make
   - Masks or personas they might wear
   - How they initiate and approach life

4. DEEPER COSMIC INSIGHTS:
   - Current celestial weather affecting them
   - Growth opportunities in the next 3 months
   - One key piece of cosmic advice

Make it personal, insightful, and empowering. Use astrological terminology but explain it clearly. Keep each section to 3-4 sentences maximum.`;

        // Call via Cloudflare Worker to protect API key
        const response = await fetch(`${WORKER_URL}/astrology-reading`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                birthData: {
                    date: birthDate,
                    time: birthTime,
                    city: birthCity,
                    sunSign: signData.name,
                    element: signData.element,
                    modality: signData.modality,
                    ruler: signData.ruler
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const aiResponse = await response.json();
        
        // Parse the AI response into sections
        const readingSections = parseAIResponse(aiResponse.content || aiResponse.text || '');
        
        return {
            sunSign: signData,
            date: birthDate,
            time: birthTime || 'Unknown',
            location: birthCity,
            reading: readingSections
        };
        
    } catch (error) {
        console.error('AI astrology reading failed:', error);
        throw error;
    }
}

// ==========================================
// PARSE AI RESPONSE INTO SECTIONS
// ==========================================
function parseAIResponse(aiText) {
    // Default fallback sections
    const sections = {
        essence: "Your cosmic signature reveals unique strengths waiting to be fully expressed.",
        moon: "Your emotional landscape holds intuitive gifts that guide your relationships.",
        rising: "The persona you present to the world conceals deeper spiritual dimensions.",
        deeper: "Current planetary alignments suggest a period of growth and self-discovery."
    };
    
    if (!aiText) return sections;
    
    try {
        // Try to extract sections based on common patterns
        const lines = aiText.split('\n');
        let currentSection = null;
        let sectionText = '';
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.toLowerCase().includes('essence') || trimmedLine.toLowerCase().includes('sun sign')) {
                if (currentSection && sectionText) {
                    sections[currentSection] = sectionText.trim();
                }
                currentSection = 'essence';
                sectionText = '';
            } else if (trimmedLine.toLowerCase().includes('lunar') || trimmedLine.toLowerCase().includes('moon') || trimmedLine.toLowerCase().includes('emotional')) {
                if (currentSection && sectionText) {
                    sections[currentSection] = sectionText.trim();
                }
                currentSection = 'moon';
                sectionText = '';
            } else if (trimmedLine.toLowerCase().includes('rising') || trimmedLine.toLowerCase().includes('perceived') || trimmedLine.toLowerCase().includes('first impression')) {
                if (currentSection && sectionText) {
                    sections[currentSection] = sectionText.trim();
                }
                currentSection = 'rising';
                sectionText = '';
            } else if (trimmedLine.toLowerCase().includes('deeper') || trimmedLine.toLowerCase().includes('insight') || trimmedLine.toLowerCase().includes('cosmic advice')) {
                if (currentSection && sectionText) {
                    sections[currentSection] = sectionText.trim();
                }
                currentSection = 'deeper';
                sectionText = '';
            } else if (currentSection && trimmedLine && !trimmedLine.match(/^\d+\./) && !trimmedLine.match(/^[A-Z][A-Z\s]+:$/)) {
                sectionText += (sectionText ? ' ' : '') + trimmedLine;
            }
        }
        
        // Add the last section
        if (currentSection && sectionText) {
            sections[currentSection] = sectionText.trim();
        }
        
        // Clean up sections (remove any remaining markdown or numbering)
        Object.keys(sections).forEach(key => {
            if (sections[key]) {
                sections[key] = sections[key]
                    .replace(/\*\*/g, '')
                    .replace(/\*/g, '')
                    .replace(/^[0-9]+\.\s*/, '')
                    .replace(/^[A-Z][A-Z\s]+:\s*/, '')
                    .trim();
            }
        });
        
    } catch (error) {
        console.error('Error parsing AI response:', error);
    }
    
    return sections;
}

// ==========================================
// GENERATE LOCAL READING (FALLBACK)
// ==========================================
function generateLocalReading(signData, birthDate) {
    const date = new Date(birthDate);
    const day = date.getDate();
    const isEarly = day <= 10;
    const isMid = day > 10 && day <= 20;
    
    const readings = {
        aries: {
            essence: `Born under Aries, you carry Mars' warrior energy. Your ${signData.element} element gives you initiative and passion. As a ${signData.modality} sign, you initiate new beginnings with courage.`,
            moon: `Your emotional nature seeks action and authenticity. You process feelings quickly but may need to develop patience with deeper emotional currents.`,
            rising: `You likely make strong first impressions as someone decisive and energetic. This rising energy helps you take initiative in life.`,
            deeper: `Current transits favor taking bold steps toward personal goals. The next 3 months bring opportunities for leadership and self-assertion.`
        },
        taurus: {
            essence: `As a Taurus, Venus blesses you with appreciation for beauty and stability. Your ${signData.element} element grounds you in practical reality. ${signData.modality} energy gives you persistence.`,
            moon: `Your emotions are deep and enduring, requiring security and tangible expressions of care. You find comfort in sensory experiences.`,
            rising: `You present as reliable and calm, often appearing more settled than you feel internally. People trust your steady presence.`,
            deeper: `Celestial patterns suggest focusing on building secure foundations. Financial and creative matters are highlighted in the coming months.`
        },
        gemini: {
            essence: `Mercury-ruled Gemini brings intellectual curiosity and adaptability. Your ${signData.element} element gives you social grace and communication skills. ${signData.modality} nature keeps you versatile.`,
            moon: `Your emotional landscape is complex and changeable. You process feelings through conversation and intellectual understanding.`,
            rising: `You appear curious and engaged, often seeming younger than your years. Your quick wit makes you socially agile.`,
            deeper: `Communication and learning opportunities abound. The next quarter favors networking, studying, and expressing your ideas.`
        },
        cancer: {
            essence: `Moon-ruled Cancer carries deep emotional intelligence and nurturing energy. Your ${signData.element} element gives you empathy and intuition. As a ${signData.modality} sign, you initiate emotional cycles.`,
            moon: `You have profound emotional depth and strong connections to home and family. Your feelings guide you like a tidal force.`,
            rising: `You present as caring and protective, often sensing others' needs before they voice them. Your presence feels comforting.`,
            deeper: `Domestic and emotional matters come into focus. The celestial weather favors healing family patterns and creating secure emotional foundations.`
        },
        leo: {
            essence: `Sun-ruled Leo shines with creative expression and leadership. Your ${signData.element} element gives you warmth and enthusiasm. ${signData.modality} energy makes you determined and regal.`,
            moon: `Your emotions are proud and generous. You need recognition and authentic self-expression to feel emotionally fulfilled.`,
            rising: `You make a memorable first impression with confidence and charisma. People notice your presence and creative flair.`,
            deeper: `Creative projects and personal recognition are highlighted. The stars support stepping into leadership roles and sharing your unique gifts.`
        },
        virgo: {
            essence: `Mercury-ruled Virgo brings analytical skill and service orientation. Your ${signData.element} element grounds you in practical details. ${signData.modality} nature makes you adaptable in service.`,
            moon: `Your emotions are processed through analysis and practical care. You feel best when being useful and improving systems.`,
            rising: `You appear competent and organized, often noticed for your attention to detail and helpful nature.`,
            deeper: `Health, work, and service matters come into focus. The coming months favor developing routines, learning new skills, and helpful contributions.`
        },
        libra: {
            essence: `Venus-ruled Libra seeks harmony, beauty, and partnership. Your ${signData.element} element gives you social intelligence and fairness. As a ${signData.modality} sign, you initiate relationships.`,
            moon: `Your emotions seek balance and partnership. You process feelings through relating and creating harmonious environments.`,
            rising: `You present as diplomatic and aesthetically aware. People notice your grace and ability to see multiple perspectives.`,
            deeper: `Relationships and creative collaborations are highlighted. The celestial patterns favor finding balance and making important connections.`
        },
        scorpio: {
            essence: `Pluto-ruled Scorpio transforms through depth and intensity. Your ${signData.element} element gives you emotional power and insight. ${signData.modality} energy makes you determined in transformation.`,
            moon: `Your emotions run deep and powerful, with strong instincts and capacity for rebirth through emotional experiences.`,
            rising: `You present as intense and perceptive, often seeming to see beneath surfaces. Your presence feels magnetic and transformative.`,
            deeper: `Transformational opportunities and deep psychological work are available. The stars support releasing old patterns and embracing personal power.`
        },
        sagittarius: {
            essence: `Jupiter-ruled Sagittarius seeks truth, adventure, and expansion. Your ${signData.element} element gives you optimism and vision. ${signData.modality} nature keeps you adaptable in exploration.`,
            moon: `Your emotions are expansive and freedom-loving. You process feelings through philosophy, travel, and seeking meaning.`,
            rising: `You appear enthusiastic and adventurous, often seeming larger than life with big ideas and optimistic energy.`,
            deeper: `Educational journeys and philosophical expansion are highlighted. The coming months favor travel, learning, and exploring belief systems.`
        },
        capricorn: {
            essence: `Saturn-ruled Capricorn builds structures and achieves mastery. Your ${signData.element} element grounds you in reality and responsibility. As a ${signData.modality} sign, you initiate ambitious projects.`,
            moon: `Your emotions are disciplined and responsible. You find emotional security through achievement and building lasting foundations.`,
            rising: `You present as capable and serious, often appearing older or more responsible than your peers. People trust your competence.`,
            deeper: `Career goals and long-term planning come into focus. The celestial weather supports disciplined effort toward meaningful achievements.`
        },
        aquarius: {
            essence: `Uranus-ruled Aquarius innovates and connects humanity. Your ${signData.element} element gives you intellectual independence and vision. ${signData.modality} energy makes you determined in innovation.`,
            moon: `Your emotions are processed through intellectual frameworks and social causes. You feel connected through ideas and community.`,
            rising: `You appear unique and forward-thinking, often seeming unconventional or ahead of your time with innovative ideas.`,
            deeper: `Community involvement and innovative projects are highlighted. The stars support collaborating with like-minded people for progressive change.`
        },
        pisces: {
            essence: `Neptune-ruled Pisces dreams, heals, and connects spiritually. Your ${signData.element} element gives you empathy and imagination. ${signData.modality} nature makes you adaptable in spiritual realms.`,
            moon: `Your emotions are boundless and compassionate, with strong psychic and intuitive connections to collective feelings.`,
            rising: `You present as gentle and imaginative, often seeming dreamy or spiritually attuned with a mystical presence.`,
            deeper: `Creative, spiritual, and healing pursuits are highlighted. The celestial patterns favor artistic expression, meditation, and compassionate service.`
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
    document.getElementById('cosmicForm').reset();
    
    // Focus on date input
    setTimeout(() => {
        const dateInput = document.getElementById('birthDate');
        if (dateInput) {
            dateInput.focus();
        }
    }, 100);
}

function showCosmicError(message) {
    // Create or show error element
    let errorEl = document.getElementById('cosmicError');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'cosmicError';
        errorEl.style.cssText = `
            background: #FEE;
            color: #C00;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
            border-left: 4px solid #C00;
            animation: fadeIn 0.3s ease;
        `;
        const form = document.getElementById('cosmicForm');
        if (form) {
            form.insertBefore(errorEl, form.firstChild);
        }
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

function showCosmicToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: ${type === 'error' ? '#FEE' : type === 'success' ? '#EFE' : '#EFF'};
        color: ${type === 'error' ? '#C00' : type === 'success' ? '#080' : '#008'};
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
        border-left: 4px solid ${type === 'error' ? '#C00' : type === 'success' ? '#080' : '#008'};
        max-width: 300px;
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
    // Only initialize if we're on a page with the orb
    if (document.getElementById('cosmicOrb')) {
        initCosmicReader();
    }
});

// Export for global access
window.CosmicReader = CosmicReader;
window.tryAnotherDate = tryAnotherDate;