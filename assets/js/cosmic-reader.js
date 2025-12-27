/**
 * LYRĪON - Cosmic Reader
 * Floating orb with birth chart analysis - MOBILE FIXED
 */

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
            ruler: 'Mars',
            dates: { start: [3, 21], end: [4, 19] }
        },
        taurus: { 
            name: 'Taurus', 
            symbol: '♉', 
            element: 'Earth',
            ruler: 'Venus',
            dates: { start: [4, 20], end: [5, 20] }
        },
        gemini: { 
            name: 'Gemini', 
            symbol: '♊', 
            element: 'Air',
            ruler: 'Mercury',
            dates: { start: [5, 21], end: [6, 20] }
        },
        cancer: { 
            name: 'Cancer', 
            symbol: '♋', 
            element: 'Water',
            ruler: 'Moon',
            dates: { start: [6, 21], end: [7, 22] }
        },
        leo: { 
            name: 'Leo', 
            symbol: '♌', 
            element: 'Fire',
            ruler: 'Sun',
            dates: { start: [7, 23], end: [8, 22] }
        },
        virgo: { 
            name: 'Virgo', 
            symbol: '♍', 
            element: 'Earth',
            ruler: 'Mercury',
            dates: { start: [8, 23], end: [9, 22] }
        },
        libra: { 
            name: 'Libra', 
            symbol: '♎', 
            element: 'Air',
            ruler: 'Venus',
            dates: { start: [9, 23], end: [10, 22] }
        },
        scorpio: { 
            name: 'Scorpio', 
            symbol: '♏', 
            element: 'Water',
            ruler: 'Pluto',
            dates: { start: [10, 23], end: [11, 21] }
        },
        sagittarius: { 
            name: 'Sagittarius', 
            symbol: '♐', 
            element: 'Fire',
            ruler: 'Jupiter',
            dates: { start: [11, 22], end: [12, 21] }
        },
        capricorn: { 
            name: 'Capricorn', 
            symbol: '♑', 
            element: 'Earth',
            ruler: 'Saturn',
            dates: { start: [12, 22], end: [1, 19] }
        },
        aquarius: { 
            name: 'Aquarius', 
            symbol: '♒', 
            element: 'Air',
            ruler: 'Uranus',
            dates: { start: [1, 20], end: [2, 18] }
        },
        pisces: { 
            name: 'Pisces', 
            symbol: '♓', 
            element: 'Water',
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
    
    console.log('🌟 Initializing Cosmic Reader...');
    
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
    console.log('✅ Cosmic Reader initialized');
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

    // Focus on date input
    setTimeout(() => {
        const dateInput = document.getElementById('birthDate');
        if (dateInput) {
            dateInput.focus();
        }
    }, 300);
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
// HANDLE FORM SUBMIT
// ==========================================
async function handleCosmicFormSubmit(e) {
    e.preventDefault();
    
    const birthDate = document.getElementById('birthDate').value;
    const birthTime = document.getElementById('birthTime').value;
    const birthCity = document.getElementById('birthCity').value;

    if (!birthDate) {
        alert('Please enter your birth date');
        return;
    }

    // Show loading
    const submitBtn = e.target.querySelector('.cosmic-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Reading the stars...';

    try {
        // Simulate loading for smooth UX
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generate reading
        const reading = generateCosmicReading(birthDate, birthTime, birthCity);
        
        // Display results
        displayCosmicReading(reading);
        
        // Switch to results step
        document.getElementById('cosmicStep1').classList.add('cosmic-step-hidden');
        document.getElementById('cosmicStep2').classList.remove('cosmic-step-hidden');
        
    } catch (error) {
        console.error('Error generating reading:', error);
        alert('Unable to generate reading. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ==========================================
// GENERATE COSMIC READING
// ==========================================
function generateCosmicReading(birthDate, birthTime, birthCity) {
    const date = new Date(birthDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Calculate sun sign
    const sunSign = calculateSunSign(month, day);
    const signData = CosmicReader.zodiacSigns[sunSign];

    // Generate reading based on sun sign
    const readings = {
        aries: {
            essence: "Born under the Aries sun, you carry the fire of creation itself. Mars, your celestial guardian, has inscribed courage into your cosmic DNA. Yet the stars reveal something deeper lurking beneath your warrior spirit.",
            moon: "Your moon's placement whispers secrets of emotional needs you've never fully acknowledged. There's a vulnerability here that your fierce exterior shields from the world—a tenderness that seeks expression.",
            rising: "Your rising sign masks a truth the world has yet to see. The persona you present is but one facet of a multidimensional soul. There's power in the aspects of yourself you keep hidden.",
            deeper: "The complete story lives in your natal chart—a map the universe drew the moment you took your first breath. Planetary aspects reveal timing, challenges, and the unique gifts only you can bring to this world."
        },
        taurus: {
            essence: "Born under Taurus, you are Earth incarnate—grounded, sensual, enduring. Venus, your celestial guardian, has woven beauty and desire into every fiber of your being. But there's a complexity here the sun sign alone cannot capture.",
            moon: "Your moon placement reveals emotional depths that contradict your steady exterior. There's a restlessness within, a longing for something more than material security can provide.",
            rising: "The face you show the world is carefully curated, isn't it? Your rising sign speaks of masks worn for protection, of a soul that learned early to guard its most precious truths.",
            deeper: "Your natal chart holds keys to unlocking patterns you've carried across lifetimes. The nodes reveal your soul's purpose, the path you're meant to walk in this incarnation."
        },
        gemini: {
            essence: "Gemini sun—you are the cosmic messenger, Mercury's child, blessed and burdened with a mind that never rests. Your duality is both gift and curse, allowing you to see all sides while finding it difficult to land on one.",
            moon: "But your moon... ah, here lies the secret emotional landscape you rarely show. There's a depth here that your quick wit and clever words often mask. A need for connection that goes beyond intellectual stimulation.",
            rising: "Your rising sign creates the first impression, and oh, how different it is from the inner truth. The world sees one version of you while your soul harbors complexities they could never imagine.",
            deeper: "The complete picture—your houses, aspects, transits—tells a story of transformation waiting to unfold. There are talents untapped, wounds unhealed, destinies unclaimed."
        },
        cancer: {
            essence: "Cancer sun, ruled by the Moon herself—you are emotion made flesh, intuition given form. Your sensitivity is a superpower the world often misunderstands. You feel everything, absorb everything, remember everything.",
            moon: "Your moon placement adds another layer to your already oceanic emotional nature. There are patterns here, inherited from your lineage, that shape how you nurture and need to be nurtured.",
            rising: "The shell you present to the world—your rising sign—protects the soft, vulnerable creature within. But what if that shell is also a prison? What if the real you is waiting to emerge?",
            deeper: "Your natal chart reveals cycles of emotional growth, periods of retreat and emergence. The transits currently affecting you speak of transformation, of shedding old protective mechanisms that no longer serve."
        },
        leo: {
            essence: "Leo sun—you are the Sun's beloved child, born to shine, to create, to inspire. Your natural radiance draws others to you like moths to flame. But leadership isn't always easy, is it? The crown weighs heavy sometimes.",
            moon: "Your moon placement reveals the private moments, the times when you doubt your own light. There's a vulnerability here that your regal exterior works hard to conceal—a need for validation that runs deeper than most know.",
            rising: "Your rising sign is the performance, the role you play so convincingly. But who are you when the audience leaves? When the spotlight dims? That's where your real power lies.",
            deeper: "The full natal chart illuminates your path to authentic self-expression. There are creative gifts waiting to be claimed, leadership qualities begging to be refined, and a legacy unique to you."
        },
        virgo: {
            essence: "Virgo sun, Mercury's earth-bound child—you see what others miss, fix what others ignore, perfect what others abandon. Your analytical mind is a gift, but it can also be a labyrinth of overthinking and self-criticism.",
            moon: "Your moon placement suggests emotional patterns you've tried to organize, systematize, perfect. But emotions aren't meant to be controlled, are they? There's healing in surrender.",
            rising: "The image you project—your rising sign—is one of capability and composure. But beneath that competent exterior lives a soul that sometimes feels overwhelmed by the task of making sense of an imperfect world.",
            deeper: "Your complete chart reveals the path to self-acceptance, to embracing imperfection, to finding peace in the process rather than the outcome. There are spiritual gifts here, healing abilities waiting to be awakened."
        },
        libra: {
            essence: "Libra sun, ruled by Venus—you are harmony seeking harmony, beauty recognizing beauty, justice pursuing justice. Your gift is seeing all sides, but this blessing can become a curse when you lose sight of your own truth.",
            moon: "Your moon placement reveals how you process emotions through the lens of relationship. But what about your relationship with yourself? There's work to be done here, boundaries to be drawn.",
            rising: "Your rising sign presents charm and diplomacy to the world. People see grace, but they don't always see the inner struggle, the constant weighing of options, the fear of making the wrong choice.",
            deeper: "The full natal chart shows you the path to authentic partnership—first with yourself, then with others. There are soul contracts written in your seventh house, karmic relationships that will teach you who you truly are."
        },
        scorpio: {
            essence: "Scorpio sun, child of Pluto's depths—you are intensity incarnate, transformation personified, power wrapped in mystery. You feel everything so deeply it sometimes threatens to consume you. This is both your gift and your challenge.",
            moon: "Your moon placement adds layers to your already complex emotional nature. There are wounds here, deep ones, that you've buried rather than healed. But what we resist persists, doesn't it?",
            rising: "Your rising sign is the mask, the protective coloring that keeps the vultures at bay. But it also keeps out the light. The real you is so much more than the mystery you project.",
            deeper: "Your complete chart reveals cycles of death and rebirth, of shedding skins and emerging transformed. There's shamanic power here, the ability to guide others through their own darkness because you've navigated your own."
        },
        sagittarius: {
            essence: "Sagittarius sun, Jupiter's wandering philosopher—you are the seeker, the adventurer, the eternal student of life's grand university. Your optimism is infectious, but sometimes it's also a defense against facing deeper truths.",
            moon: "Your moon placement suggests an emotional restlessness, a feeling that happiness is always just over the next horizon. But what if everything you seek is already within you?",
            rising: "The persona you project—your rising sign—is one of freedom and adventure. But does anyone see the moments when you feel trapped? When the walls close in and even vast horizons feel too small?",
            deeper: "Your full chart reveals the quest you're truly on—not external adventures but the hero's journey within. There's wisdom to be claimed, teachings to be shared, a higher purpose waiting to be embraced."
        },
        capricorn: {
            essence: "Capricorn sun, Saturn's disciplined child—you are the mountain climber, the goal achiever, the one who understands that anything worth having requires sustained effort. But who are you when you're not achieving? When you're just... being?",
            moon: "Your moon placement reveals emotional patterns shaped by duty and responsibility. But whose expectations are you really trying to meet? And what would happen if you gave yourself permission to rest?",
            rising: "Your rising sign presents capability and authority. People see the summit you've reached, but they don't see the lonely climb, the sacrifices made, the parts of yourself left behind.",
            deeper: "Your complete chart shows the path to balanced ambition, to success that doesn't cost you your soul. There are gifts in your tenth house, a legacy to build that serves both you and the collective."
        },
        aquarius: {
            essence: "Aquarius sun, Uranus's revolutionary—you are the future thinker, the humanitarian, the one who sees possibilities others can't even imagine. Your uniqueness is your power, but it can also be a source of profound loneliness.",
            moon: "Your moon placement suggests emotional patterns that even you find unusual. You process feelings intellectually, which is both genius and defense. But emotions aren't meant to be solved, are they?",
            rising: "Your rising sign is the eccentric, the outlier, the one who doesn't quite fit. But here's the secret: you were never meant to fit. Your job is to break the mold, not squeeze into it.",
            deeper: "Your full chart reveals your role in collective evolution. There are downloads coming through your eleventh house, visions of possible futures, innovations waiting to be birthed through you."
        },
        pisces: {
            essence: "Pisces sun, Neptune's mystic—you are the dreamer, the empath, the one who swims in realms others don't even know exist. Your sensitivity allows you to merge with the divine, but it also makes earthly existence challenging.",
            moon: "Your moon placement amplifies your already oceanic emotional nature. You absorb others' feelings as your own, don't you? The challenge is learning where you end and others begin.",
            rising: "Your rising sign is the veil between worlds, the portal through which spirit flows. People sense there's something different about you, something otherworldly, even if they can't name it.",
            deeper: "Your complete chart reveals gifts of healing, channeling, creating. There's artistic genius here, spiritual wisdom, the ability to bring heaven to earth. But first, you must learn to ground your ethereal nature."
        }
    };

    const reading = readings[sunSign] || readings.aries;

    return {
        sunSign: signData,
        date: birthDate,
        time: birthTime || 'Unknown',
        location: birthCity || 'Not provided',
        reading: reading
    };
}

// ==========================================
// CALCULATE SUN SIGN
// ==========================================
function calculateSunSign(month, day) {
    for (const [sign, data] of Object.entries(CosmicReader.zodiacSigns)) {
        const [startMonth, startDay] = data.dates.start;
        const [endMonth, endDay] = data.dates.end;
        
        if (month === startMonth && day >= startDay) return sign;
        if (month === endMonth && day <= endDay) return sign;
        if (startMonth > endMonth && (month > startMonth || month < endMonth)) return sign;
    }

    return 'aries'; // fallback
}

// ==========================================
// DISPLAY COSMIC READING
// ==========================================
function displayCosmicReading(data) {
    const resultsContainer = document.querySelector('#cosmicStep2 .cosmic-results');
    resultsContainer.innerHTML = `
        <div class="cosmic-results-header">
            <div class="cosmic-sign-icon">${data.sunSign.symbol}</div>
            <h2>${data.sunSign.name} Sun</h2>
            <p class="cosmic-element">${data.sunSign.element} • Ruled by ${data.sunSign.ruler}</p>
        </div>
        
        <div class="cosmic-reading-content">
            <div class="reading-section">
                <h3>Your Essence</h3>
                <p>${data.reading.essence}</p>
            </div>
            
            <div class="reading-section">
                <h3>The Hidden Moon</h3>
                <p>${data.reading.moon}</p>
            </div>
            
            <div class="reading-section">
                <h3>The Mask You Wear</h3>
                <p>${data.reading.rising}</p>
            </div>
            
            <div class="reading-section reading-deeper">
                <h3>The Deeper Truth</h3>
                <p>${data.reading.deeper}</p>
            </div>
            
            <div class="cosmic-cta">
                <p class="cosmic-cta-text">
                    This is but a glimpse. Your complete natal chart reveals the full story—
                    the timing of your evolution, the lessons you're here to learn, the gifts 
                    you're meant to share with the world.
                </p>
                
                <div class="cosmic-actions">
                    <a href="oracle.html" class="btn btn-primary">Get Full Reading</a>
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