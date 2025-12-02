# LYRĪON Celestial Couture

> **Wear Your Sign** — Luxury zodiac-inspired apparel and ritual homeware, made in England.

---

## 🌙 Overview

LYRĪON is a complete e-commerce platform with:
- **Static front-end** (HTML/CSS/JS) hosted on Netlify
- **Automated catalog** system (CSV → JSON)
- **Multi-POD routing** (Printful, Gelato, Printify, Inkthreadable)
- **Stripe checkout** with automated fulfillment
- **Cloudflare Worker** for order processing

**Live Site:** [www.lyrion.co.uk](https://www.lyrion.co.uk)  
**Contact:** hello@lyrion.co.uk

---

## 📁 Project Structure

```
lyrion-co-uk/
├── index.html                  # Homepage
├── shop.html                   # Product catalog
├── product.html                # Product detail page
├── checkout.html               # Stripe checkout
├── checkout-success.html       # Order confirmation
├── oracle.html                 # Astrology readings
├── about.html                  # Brand story
├── contact.html                # Contact form
├── codex.html                  # Blog
├── zodiac/                     # 12 zodiac pages
│   ├── aries.html
│   ├── taurus.html
│   └── ... (10 more)
├── assets/
│   ├── css/
│   │   └── style.css          # Master stylesheet
│   ├── js/
│   │   ├── main.js            # Global functions
│   │   ├── cart.js            # Shopping cart
│   │   ├── search.js          # Live search
│   │   ├── shop.js            # Filtering
│   │   ├── checkout.js        # Stripe checkout
│   │   └── oracle.js          # Oracle payments
│   ├── img/
│   │   ├── logo.png           # YOUR LOGO
│   │   └── favicon.png        # YOUR FAVICON
│   └── products/              # Product images
│       ├── men/
│       ├── women/
│       ├── moon-girls/
│       ├── star-boys/
│       ├── home/
│       └── accessories/
├── data/
│   ├── products.csv           # Master catalog (EDIT THIS)
│   ├── products.json          # Auto-generated
│   └── routing.json           # POD routing
├── automation/
│   └── order-broker/
│       ├── worker.js          # Cloudflare Worker
│       └── wrangler.toml      # Worker config
└── netlify.toml               # Netlify config
```

---

## 🚀 Quick Start (5 Steps)

### **Step 1: Upload Your Images**

Place your 36 product images in the correct folders:

```
assets/products/men/          → 6 images (front, back, side views)
assets/products/women/        → 6 images
assets/products/moon-girls/   → 6 images
assets/products/star-boys/    → 6 images
assets/products/home/         → 6 images
assets/products/accessories/  → 6 images
```

**Image naming convention:** `category-product-view.webp`  
Example: `men/aries-hoodie-front.webp`

Also add:
- `assets/img/logo.png` (your logo)
- `assets/img/favicon.png` (your favicon)

---

### **Step 2: Edit Product Catalog**

Open `data/products.csv` and edit:
- Product names
- Prices
- Descriptions
- Image filenames (match what you uploaded)

**Don't worry about `products.json`** — it auto-generates from the CSV.

---

### **Step 3: Deploy to Netlify**

1. Push your code to GitHub
2. Go to [Netlify](https://www.netlify.com/)
3. Click **"Add new site"** → **"Import from Git"**
4. Select your `lyrion-co-uk` repository
5. Deploy settings:
   - **Build command:** (leave blank)
   - **Publish directory:** `.` (root)
6. Click **"Deploy site"**

✅ Your site is now live at `your-site.netlify.app`

**Custom domain:**
1. Go to **Domain settings** in Netlify
2. Add custom domain: `www.lyrion.co.uk`
3. Follow DNS instructions

---

### **Step 4: Deploy Cloudflare Worker**

**Install Wrangler CLI:**

```bash
npm install -g wrangler
```

**Login to Cloudflare:**

```bash
wrangler login
```

**Update config:**

Edit `automation/order-broker/wrangler.toml`:
- Replace `YOUR_USERNAME` in `ROUTING_JSON_URL` with your GitHub username
- Uncomment and add your `account_id` (get from Cloudflare dashboard)

**Set secrets:**


**Deploy:**

```bash
wrangler publish
```

✅ Worker is now live at `https://lyrion-order-broker.YOUR_SUBDOMAIN.workers.dev`

**Copy this URL** — you'll need it in Step 5.

---

### **Step 5: Configure Stripe Webhook**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Endpoint URL: `https://lyrion-order-broker.YOUR_SUBDOMAIN.workers.dev/webhook`
4. Select event: `checkout.session.completed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your worker:

```bash
wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste the whsec_... value
```

✅ Webhook is now configured!

---

## 🎨 Customization

### **Update Colors**

Edit `assets/css/style.css`:

```css
:root {
  --color-gold-primary: #B8860B;  /* Change to your gold */
  --color-ink: #0F0D0B;           /* Your dark color */
  --color-cream: #FAF8F5;         /* Your background */
}
```

### **Update Content**

- **Homepage hero text:** Edit `index.html` line ~50
- **About page story:** Edit `about.html` line ~100
- **Footer links:** Edit footer in any HTML file

### **Add More Products**

1. Add row to `data/products.csv`
2. Add images to `assets/products/`
3. Add routing entry to `data/routing.json`
4. Commit and push to GitHub

---

## 🛍️ How Orders Work

1. **Customer** completes checkout on your site
2. **Stripe** processes payment
3. **Stripe webhook** triggers Cloudflare Worker
4. **Worker** fetches `routing.json`
5. **Worker** routes order to correct POD provider:
   - **Printful** → Men's hoodies
   - **Gelato** → Women's tees, prints, home items
   - **Printify** → Kids collections
   - **Inkthreadable** → Hats, socks, accessories
   - **Manual** → Hand-crafted items (email notification)
6. **POD provider** fulfills and ships directly to customer
7. **Customer** receives tracking email from POD provider

---

## 🔧 Testing

### **Test Checkout Flow**

1. Add product to cart
2. Go to checkout
3. Use Stripe test card: `4242 4242 4242 4242`
4. Expiry: Any future date
5. CVC: Any 3 digits
6. Complete checkout
7. Check Cloudflare Worker logs

### **Test Oracle Readings**

1. Go to Oracle page
2. Select a tier
3. Fill in form
4. Use test card
5. Check email notification

---

## 📊 Monitoring

### **Check Orders**

- **Stripe Dashboard:** See all payments
- **Cloudflare Workers:** Check logs for errors
- **POD Dashboards:** Check fulfillment status
  - Printful: printful.com
  - Gelato: gelato.com
  - Printify: printify.com
  - Inkthreadable: inkthreadable.co.uk

### **Email Notifications**

All order notifications go to: `hello@lyrion.co.uk`

---

## 🐛 Troubleshooting

### **Products not showing on site**

✅ Check `data/products.json` was created  
✅ Verify image paths in CSV match actual files  
✅ Clear browser cache

### **Checkout not working**

✅ Verify Cloudflare Worker is deployed  
✅ Check all secrets are set (`wrangler secret list`)  
✅ Verify Stripe webhook is configured  
✅ Check Worker logs for errors

### **Orders not fulfilling**

✅ Check Stripe webhook is receiving events  
✅ Verify POD API keys are correct  
✅ Check Worker logs  
✅ Verify product exists in `routing.json`

### **Images not loading**

✅ Verify files exist in `assets/products/`  
✅ Check filename matches CSV exactly  
✅ Try force refresh (Ctrl+Shift+R)

---

## 📝 Create Remaining Zodiac Pages

You have the template (`zodiac/aries.html`). Create 11 more:

**Copy `aries.html` 11 times and change:**

1. **Taurus:** Symbol `♉`, dates Apr 20 - May 20, Element: Earth, Planet: Venus
2. **Gemini:** Symbol `♊`, dates May 21 - Jun 20, Element: Air, Planet: Mercury
3. **Cancer:** Symbol `♋`, dates Jun 21 - Jul 22, Element: Water, Planet: Moon
4. **Leo:** Symbol `♌`, dates Jul 23 - Aug 22, Element: Fire, Planet: Sun
5. **Virgo:** Symbol `♍`, dates Aug 23 - Sep 22, Element: Earth, Planet: Mercury
6. **Libra:** Symbol `♎`, dates Sep 23 - Oct 22, Element: Air, Planet: Venus
7. **Scorpio:** Symbol `♏`, dates Oct 23 - Nov 21, Element: Water, Planet: Pluto
8. **Sagittarius:** Symbol `♐`, dates Nov 22 - Dec 21, Element: Fire, Planet: Jupiter
9. **Capricorn:** Symbol `♑`, dates Dec 22 - Jan 19, Element: Earth, Planet: Saturn
10. **Aquarius:** Symbol `♒`, dates Jan 20 - Feb 18, Element: Air, Planet: Uranus
11. **Pisces:** Symbol `♓`, dates Feb 19 - Mar 20, Element: Water, Planet: Neptune

**Update in each file:**
- Symbol (line ~70)
- Name (line ~71)
- Dates (line ~72)
- Essence (line ~73)
- Element, Planet, Modality, Symbol name (lines ~85-105)
- Personality description (line ~115)
- 6 traits (lines ~125-175)
- Filter in product loader (line ~350): `filter(p => p.zodiac_sign === 'Taurus')`

---

## 🔐 Security

- ✅ All API keys stored as Cloudflare secrets (never in code)
- ✅ Stripe webhook signature verification
- ✅ CORS headers configured
- ✅ No secrets in GitHub repository

---

## 📞 Support

**Technical Issues:**
- Check Cloudflare Worker logs
- Check browser console for errors
- Review Stripe webhook logs

**POD Issues:**
- Contact provider support directly
- Check order status in provider dashboard

**Questions:**
Email: hello@lyrion.co.uk

---

## 📄 License

Proprietary — LYRĪON Celestial Couture © 2025

---

## ✨ Built With

- HTML5, CSS3, Vanilla JavaScript
- Stripe (Payments)
- Cloudflare Workers (Serverless backend)
- Netlify (Hosting)
- Printful, Gelato, Printify, Inkthreadable (Print-on-demand)

---

**Made with intention. 🌙**