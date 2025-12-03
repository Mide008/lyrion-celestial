/**
 * LYRĪON Order Broker - Enhanced Cloudflare Worker
 * Routes: Product Orders, Oracle Readings, Contact Forms
 */

// POD Service Selection
const POD_SERVICE = 'printful'; // or 'printify'

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Route: Create Oracle Stripe Session
    if (url.pathname === '/create-oracle-session' && request.method === 'POST') {
      const response = await handleOracleCheckout(request);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // Route: Contact Form Submission
    if (url.pathname === '/contact' && request.method === 'POST') {
      const response = await handleContactForm(request);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // Route: Stripe Webhook (Product Orders & Oracle Payments)
    if (request.method === 'POST' && url.pathname === '/') {
      const payload = await request.text();
      const signature = request.headers.get('stripe-signature');
      const event = await verifyStripeWebhook(payload, signature);
      
      if (event.type === 'checkout.session.completed') {
        await handleCheckoutCompleted(event.data.object);
      }
      
      return new Response('Event received', { status: 200 });
    }
    
    // Health check
    if (request.method === 'GET') {
      return new Response('LYRĪON Order Broker is running', { status: 200 });
    }
    
    return new Response('Method not allowed', { status: 405 });
    
  } catch (error) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
}

// ==========================================
// ORACLE CHECKOUT
// ==========================================
async function handleOracleCheckout(request) {
  const data = await request.json();
  
  const { name, email, question, tier, price } = data;
  
  // Create Stripe Checkout Session
  const session = await createStripeCheckoutSession({
    amount: Math.round(price * 100), // Convert to pence
    currency: 'gbp',
    success_url: 'https://lyrion.co.uk/oracle-success.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://lyrion.co.uk/oracle.html',
    customer_email: email,
    metadata: {
      type: 'oracle-reading',
      tier: tier,
      customer_name: name,
      question: question || 'No specific question provided'
    },
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `${tier} Oracle Reading`,
          description: `Personalized astrology reading by LYRĪON`,
          images: ['https://lyrion.co.uk/assets/img/oracle-og.jpg']
        },
        unit_amount: Math.round(price * 100)
      },
      quantity: 1
    }]
  });
  
  return { sessionId: session.id };
}

// ==========================================
// CREATE STRIPE CHECKOUT SESSION
// ==========================================
async function createStripeCheckoutSession(options) {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'success_url': options.success_url,
      'cancel_url': options.cancel_url,
      'customer_email': options.customer_email,
      'mode': 'payment',
      'line_items[0][price_data][currency]': options.currency,
      'line_items[0][price_data][product_data][name]': options.line_items[0].price_data.product_data.name,
      'line_items[0][price_data][product_data][description]': options.line_items[0].price_data.product_data.description,
      'line_items[0][price_data][unit_amount]': options.line_items[0].price_data.unit_amount,
      'line_items[0][quantity]': options.line_items[0].quantity,
      'metadata[type]': options.metadata.type,
      'metadata[tier]': options.metadata.tier,
      'metadata[customer_name]': options.metadata.customer_name,
      'metadata[question]': options.metadata.question
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create checkout session');
  }
  
  return await response.json();
}

// ==========================================
// CONTACT FORM HANDLER
// ==========================================
async function handleContactForm(request) {
  const data = await request.json();
  
  const { name, email, subject, message } = data;
  
  // Validate required fields
  if (!name || !email || !subject || !message) {
    throw new Error('All fields are required');
  }
  
  // Send email via Zoho Mail API or SMTP
  await sendContactEmail({
    from: email,
    fromName: name,
    to: 'hello@lyrion.co.uk',
    subject: `Contact Form: ${subject}`,
    body: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #B8860B; border-bottom: 2px solid #B8860B; padding-bottom: 10px;">
              New Contact Form Submission
            </h2>
            
            <div style="margin: 20px 0;">
              <p><strong>From:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>Subject:</strong> ${subject}</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #B8860B; margin: 20px 0;">
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap;">${message}</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
              <p>This email was sent from the LYRĪON contact form at ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `
  });
  
  return { success: true, message: 'Message sent successfully' };
}

// ==========================================
// SEND EMAIL (Zoho SMTP)
// ==========================================
async function sendContactEmail(emailData) {
  // Option 1: Use Cloudflare Email Workers (Recommended)
  // https://developers.cloudflare.com/email-routing/email-workers/
  
  // Option 2: Use SendGrid API (Fallback)
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`, // Add as secret
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: emailData.to }],
        subject: emailData.subject
      }],
      from: { 
        email: 'noreply@lyrion.co.uk', // Must be verified in SendGrid
        name: 'LYRĪON Contact Form'
      },
      reply_to: {
        email: emailData.from,
        name: emailData.fromName
      },
      content: [{
        type: 'text/html',
        value: emailData.body
      }]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('SendGrid error:', error);
    throw new Error('Failed to send email');
  }
  
  return true;
}

// ==========================================
// STRIPE WEBHOOK VERIFICATION
// ==========================================
async function verifyStripeWebhook(payload, signature) {
  const secret = STRIPE_WEBHOOK_SECRET;
  
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  
  const signatureHeader = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});
  
  const timestamp = signatureHeader.t;
  const expectedSignature = signatureHeader.v1;
  const signedPayload = `${timestamp}.${payload}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );
  
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  if (computedSignature !== expectedSignature) {
    throw new Error('Invalid webhook signature');
  }
  
  return JSON.parse(payload);
}

// ==========================================
// HANDLE CHECKOUT COMPLETED
// ==========================================
async function handleCheckoutCompleted(session) {
  console.log('Processing checkout:', session.id);
  
  // Check if this is an Oracle reading or product order
  const metadata = session.metadata || {};
  
  if (metadata.type === 'oracle-reading') {
    // Handle Oracle reading
    await processOracleReading(session);
  } else {
    // Handle product order
    const lineItems = await getStripeLineItems(session.id);
    
    if (POD_SERVICE === 'printful') {
      await createPrintfulOrder(session, lineItems);
    } else if (POD_SERVICE === 'printify') {
      await createPrintifyOrder(session, lineItems);
    }
  }
}

// ==========================================
// PROCESS ORACLE READING
// ==========================================
async function processOracleReading(session) {
  const metadata = session.metadata;
  
  // Send confirmation email to customer
  await sendContactEmail({
    from: 'hello@lyrion.co.uk',
    fromName: 'LYRĪON Oracle',
    to: session.customer_email,
    subject: `Your ${metadata.tier} Reading is Confirmed`,
    body: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #B8860B;">Thank You, ${metadata.customer_name}</h1>
            <p>Your ${metadata.tier} reading has been confirmed and our celestial readers are preparing your personalized insights.</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-left: 4px solid #B8860B; margin: 20px 0;">
              <p><strong>Your Question:</strong></p>
              <p>${metadata.question}</p>
            </div>
            
            <p><strong>What happens next:</strong></p>
            <ul>
              <li>You'll receive your reading via email within 48-72 hours</li>
              <li>Your reading will be delivered as a beautifully formatted PDF</li>
              <li>Keep an eye on your inbox (check spam folder just in case)</li>
            </ul>
            
            <p style="margin-top: 30px;">With cosmic gratitude,<br><strong>The LYRĪON Team</strong></p>
          </div>
        </body>
      </html>
    `
  });
  
  // Notify admin about new Oracle order
  await sendContactEmail({
    from: 'noreply@lyrion.co.uk',
    fromName: 'LYRĪON System',
    to: 'hello@lyrion.co.uk',
    subject: `New Oracle Reading Order: ${metadata.tier}`,
    body: `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>New Oracle Reading Order</h2>
          <p><strong>Tier:</strong> ${metadata.tier}</p>
          <p><strong>Customer:</strong> ${metadata.customer_name}</p>
          <p><strong>Email:</strong> ${session.customer_email}</p>
          <p><strong>Amount:</strong> £${(session.amount_total / 100).toFixed(2)}</p>
          <p><strong>Question:</strong></p>
          <p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #B8860B;">
            ${metadata.question}
          </p>
          <p><strong>Order ID:</strong> ${session.id}</p>
        </body>
      </html>
    `
  });
}

// (Keep all your existing POD functions: getStripeLineItems, createPrintfulOrder, createPrintifyOrder)

// ==========================================
// GET LINE ITEMS FROM STRIPE
// ==========================================
async function getStripeLineItems(sessionId) {
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items`,
    {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Stripe-Version': '2024-11-20.acacia'
      }
    }
  );
  
  const data = await response.json();
  return data.data;
}

// ==========================================
// CREATE PRINTFUL ORDER
// ==========================================
async function createPrintfulOrder(session, lineItems) {
  const orderData = {
    external_id: session.id,
    shipping: {
      name: session.customer_details?.name || 'Customer',
      address1: session.customer_details?.address?.line1 || '',
      city: session.customer_details?.address?.city || '',
      country_code: session.customer_details?.address?.country || 'GB',
      zip: session.customer_details?.address?.postal_code || ''
    },
    recipient: {
      name: session.customer_details?.name || 'Customer',
      email: session.customer_details?.email || ''
    },
    items: lineItems.map(item => ({
      variant_id: parseInt(item.price?.metadata?.printful_variant_id || 0),
      quantity: item.quantity,
      retail_price: (item.amount_total / 100).toFixed(2)
    }))
  };
  
  const response = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });
  
  return await response.json();
}

export default {
  fetch: handleRequest
};