/**
 * LYRĪON Order Broker - Cloudflare Worker
 * Handles Stripe checkout and POD order routing
 */

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Main request handler
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  
  // Route requests
  try {
    switch (url.pathname) {
      case '/create-payment-intent':
        return await handleCreatePaymentIntent(request);
        
      case '/create-oracle-payment':
        return await handleCreateOraclePayment(request);
        
      case '/webhook':
        return await handleStripeWebhook(request);
        
      case '/validate-discount':
        return await handleValidateDiscount(request);
        
      case '/contact':
        return await handleContactForm(request);
        
      default:
        return new Response('LYRĪON Order Broker Active', { 
          status: 200,
          headers: CORS_HEADERS 
        });
    }
  } catch (error) {
    console.error('Worker error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ==========================================
// CREATE PAYMENT INTENT (CHECKOUT)
// ==========================================
async function handleCreatePaymentIntent(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  
  try {
    const { amount, currency, cart, customer } = await request.json();
    
    // Create Stripe payment intent
    const paymentIntent = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: amount.toString(),
        currency: currency || 'gbp',
        'metadata[customer_email]': customer.email,
        'metadata[customer_name]': customer.name,
        'metadata[cart_items]': JSON.stringify(cart.items),
      }),
    });
    
    const intent = await paymentIntent.json();
    
    if (!paymentIntent.ok) {
      throw new Error(intent.error?.message || 'Failed to create payment intent');
    }
    
    return jsonResponse({
      client_secret: intent.client_secret,
      id: intent.id
    });
    
  } catch (error) {
    console.error('Payment intent error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ==========================================
// CREATE ORACLE PAYMENT
// ==========================================
async function handleCreateOraclePayment(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  
  try {
    const { amount, currency, oracle_data, tier } = await request.json();
    
    // Create Stripe payment intent for Oracle reading
    const paymentIntent = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: amount.toString(),
        currency: currency || 'gbp',
        'metadata[product_type]': 'oracle_reading',
        'metadata[tier]': tier.id,
        'metadata[customer_email]': oracle_data.email,
        'metadata[customer_name]': oracle_data.name,
        'metadata[question]': oracle_data.question.substring(0, 500),
      }),
    });
    
    const intent = await paymentIntent.json();
    
    if (!paymentIntent.ok) {
      throw new Error(intent.error?.message || 'Failed to create payment');
    }
    
    return jsonResponse({
      client_secret: intent.client_secret,
      id: intent.id
    });
    
  } catch (error) {
    console.error('Oracle payment error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ==========================================
// STRIPE WEBHOOK (ORDER FULFILLMENT)
// ==========================================
async function handleStripeWebhook(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  
  try {
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();
    
    // Verify webhook signature (simplified - add full verification in production)
    // In production, use Stripe's webhook signature verification
    
    const event = JSON.parse(body);
    
    // Handle successful payment
    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Check if this is an Oracle reading or product order
      const productType = paymentIntent.metadata?.product_type;
      
      if (productType === 'oracle_reading') {
        // Handle Oracle reading order
        await handleOracleOrder(paymentIntent);
      } else {
        // Handle product order - route to POD providers
        await handleProductOrder(paymentIntent);
      }
    }
    
    return jsonResponse({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ==========================================
// HANDLE PRODUCT ORDER
// ==========================================
async function handleProductOrder(paymentIntent) {
  try {
    // Parse cart items from metadata
    const cartItems = JSON.parse(paymentIntent.metadata.cart_items || '[]');
    
    // Fetch routing information
    const routingResponse = await fetch(ROUTING_JSON_URL);
    const routing = await routingResponse.json();
    
    // Group items by POD provider
    const providerOrders = {};
    
    for (const item of cartItems) {
      const productRoute = routing.find(r => r.sku === item.sku);
      
      if (!productRoute) {
        console.warn(`No routing found for SKU: ${item.sku}`);
        continue;
      }
      
      const provider = productRoute.pod_provider;
      
      if (!providerOrders[provider]) {
        providerOrders[provider] = [];
      }
      
      providerOrders[provider].push({
        ...item,
        pod_sku: productRoute.pod_sku
      });
    }
    
    // Send orders to each provider
    for (const [provider, items] of Object.entries(providerOrders)) {
      await routeToProvider(provider, items, paymentIntent);
    }
    
    // Send confirmation email
    await sendOrderConfirmation(paymentIntent);
    
  } catch (error) {
    console.error('Product order error:', error);
    // Send error notification to admin
    await sendErrorNotification(error, paymentIntent);
  }
}

// ==========================================
// ROUTE TO POD PROVIDER
// ==========================================
async function routeToProvider(provider, items, paymentIntent) {
  const customerEmail = paymentIntent.metadata.customer_email;
  const customerName = paymentIntent.metadata.customer_name;
  
  switch (provider) {
    case 'printful':
      return await sendToPrintful(items, customerEmail, customerName);
      
    case 'gelato':
      return await sendToGelato(items, customerEmail, customerName);
      
    case 'printify':
      return await sendToPrintify(items, customerEmail, customerName);
      
    case 'inkthreadable':
      return await sendToInkthreadable(items, customerEmail, customerName);
      
    case 'manual':
    case 'digital':
      return await sendManualNotification(items, customerEmail, customerName);
      
    default:
      console.warn(`Unknown provider: ${provider}`);
  }
}

// ==========================================
// POD PROVIDER INTEGRATIONS
// ==========================================

async function sendToPrintful(items, email, name) {
  // Printful API integration
  const response = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: {
        name: name,
        email: email,
      },
      items: items.map(item => ({
        variant_id: item.pod_sku,
        quantity: item.quantity,
      })),
    }),
  });
  
  return await response.json();
}

async function sendToGelato(items, email, name) {
  // Gelato API integration
  const response = await fetch('https://order.gelatoapis.com/v4/orders', {
    method: 'POST',
    headers: {
      'X-API-KEY': GELATO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderReferenceId: `LYRION-${Date.now()}`,
      customerReferenceId: email,
      orderType: 'order',
      items: items.map(item => ({
        itemReferenceId: item.sku,
        productUid: item.pod_sku,
        quantity: item.quantity,
      })),
      shipmentMethodUid: 'express',
    }),
  });
  
  return await response.json();
}

async function sendToPrintify(items, email, name) {
  // Printify API integration
  const response = await fetch(`https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/orders.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_id: `LYRION-${Date.now()}`,
      line_items: items.map(item => ({
        product_id: item.pod_sku,
        quantity: item.quantity,
      })),
      shipping_method: 1,
      address_to: {
        email: email,
      },
    }),
  });
  
  return await response.json();
}

async function sendToInkthreadable(items, email, name) {
  // Inkthreadable API integration (UK-based)
  // Note: Update with actual Inkthreadable API endpoint when available
  console.log('Inkthreadable order:', { items, email, name });
  return { success: true, provider: 'inkthreadable' };
}

async function sendManualNotification(items, email, name) {
  // Send email to admin for manual fulfillment
  await sendEmail(ORDER_NOTIFICATION_EMAIL, 'Manual Order Notification', `
    New manual/digital order received:
    Customer: ${name} (${email})
    Items: ${JSON.stringify(items, null, 2)}
  `);
}

// ==========================================
// HANDLE ORACLE ORDER
// ==========================================
async function handleOracleOrder(paymentIntent) {
  const customerEmail = paymentIntent.metadata.customer_email;
  const customerName = paymentIntent.metadata.customer_name;
  const tier = paymentIntent.metadata.tier;
  const question = paymentIntent.metadata.question;
  
  // Send notification to admin/oracle reader
  await sendEmail(ORDER_NOTIFICATION_EMAIL, 'New Oracle Reading Request', `
    New ${tier} reading requested:
    
    Customer: ${customerName}
    Email: ${customerEmail}
    Question: ${question}
    
    Payment ID: ${paymentIntent.id}
    Amount: £${(paymentIntent.amount / 100).toFixed(2)}
  `);
  
  // Send confirmation to customer
  await sendEmail(customerEmail, 'Your Oracle Reading is On Its Way', `
    Thank you for consulting the Oracle, ${customerName}.
    
    Your ${tier} reading will be delivered within 48-72 hours.
    
    Order ID: ${paymentIntent.id}
  `);
}

// ==========================================
// EMAIL HELPER
// ==========================================
async function sendEmail(to, subject, body) {
  // Implement email sending (use SendGrid, Mailgun, etc.)
  console.log('Email sent:', { to, subject, body });
  // In production, integrate with your email service
}

// ==========================================
// SEND ORDER CONFIRMATION
// ==========================================
async function sendOrderConfirmation(paymentIntent) {
  const email = paymentIntent.metadata.customer_email;
  const name = paymentIntent.metadata.customer_name;
  
  await sendEmail(email, 'Order Confirmed - LYRĪON', `
    Thank you for your order, ${name}!
    
    Your order has been confirmed and is being prepared.
    You'll receive tracking information within 2-3 business days.
    
    Order ID: ${paymentIntent.id}
    Total: £${(paymentIntent.amount / 100).toFixed(2)}
  `);
}

// ==========================================
// ERROR NOTIFICATION
// ==========================================
async function sendErrorNotification(error, paymentIntent) {
  await sendEmail(ORDER_NOTIFICATION_EMAIL, 'Order Processing Error', `
    Error processing order:
    
    Payment ID: ${paymentIntent.id}
    Error: ${error.message}
    
    Please process manually.
  `);
}

// ==========================================
// VALIDATE DISCOUNT CODE
// ==========================================
async function handleValidateDiscount(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  
  try {
    const { code, cart } = await request.json();
    
    // Simple discount validation (expand as needed)
    const discounts = {
      'WELCOME10': { type: 'percentage', value: 10 },
      'COSMIC20': { type: 'percentage', value: 20 },
    };
    
    const discount = discounts[code.toUpperCase()];
    
    if (!discount) {
      return jsonResponse({ error: 'Invalid discount code' }, 400);
    }
    
    return jsonResponse(discount);
    
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// ==========================================
// CONTACT FORM HANDLER
// ==========================================
async function handleContactForm(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  
  try {
    const formData = await request.json();
    
    // Send contact form email
    await sendEmail(ORDER_NOTIFICATION_EMAIL, `Contact Form: ${formData.subject}`, `
      From: ${formData.name} (${formData.email})
      Subject: ${formData.subject}
      
      Message:
      ${formData.message}
      
      Timestamp: ${formData.timestamp}
    `);
    
    return jsonResponse({ success: true });
    
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// ==========================================
// HELPER: JSON RESPONSE
// ==========================================
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}