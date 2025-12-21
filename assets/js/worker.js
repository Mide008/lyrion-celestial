// LYRĪON Order Broker - Cloudflare Worker
// Complete version with: Stripe, Printful, Email Notifications, Manual Fulfillment

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers - ALLOW LOCAL DEVELOPMENT
    const allowedOrigins = [
      'https://lyrion.co.uk', 
      'https://www.lyrion.co.uk',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://localhost:3000',
      'https://localhost:5500',
      'https://lyrion-order-broker.hello-2a3.workers.dev'
    ];
    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true'
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // ========== HEALTH CHECK ==========
    if (url.pathname === "/health") {
      return new Response("OK", { 
        headers: { 
          "Content-Type": "text/plain",
          ...corsHeaders 
        }
      });
    }
    
    // ========== STRIPE WEBHOOK (with Printful & Manual Fulfillment) ==========
    if (url.pathname === "/stripe-webhook" && request.method === 'POST') {
      console.log('🔔 STRIPE WEBHOOK RECEIVED');
      
      try {
        const signature = request.headers.get('stripe-signature');
        if (!signature) {
          return new Response(JSON.stringify({ error: 'No signature' }), { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const stripeKey = env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          throw new Error('STRIPE_SECRET_KEY not set');
        }
        
        const payload = await request.text();
        
        // Verify the event came from Stripe
        const stripe = require('stripe')(stripeKey);
        const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
        
        console.log(`🔄 Webhook event type: ${event.type}`);
        
        // Handle successful checkout session
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          console.log(`✅ Payment successful for session: ${session.id}`);
          
          // Extract order details
          const order = {
            sku: session.metadata.sku,
            size: session.metadata.size,
            quantity: 1,
            stripeSessionId: session.id,
            name: session.customer_details?.name || session.metadata.customer_name || '',
            address: session.customer_details?.address || {},
            email: session.customer_email || session.metadata.customer_email || '',
            order_type: session.metadata.order_type || 'product',
            tier: session.metadata.tier || '',
            tier_name: session.metadata.tier_name || '',
            word_count: session.metadata.word_count || '',
            question: session.metadata.question || '',
            price: parseFloat(session.metadata.price || (session.amount_total / 100)),
            item_count: parseInt(session.metadata.item_count || '0')
          };
          
          // Send emails based on order type
          if (order.order_type === 'product') {
            await handleProductOrderSuccess(env, order);
            
            // Check for Printful routing
            if (order.sku) {
              const routing = await getRouting(order.sku);
              if (routing && routing.pod_provider === "printful") {
                await createPrintfulOrder(order, routing, env);
              } else if (routing && routing.pod_provider === "manual") {
                // Send manual fulfillment alert
                await sendManualFulfillmentAlert(env, order, routing);
              }
            }
          } else if (order.order_type === 'oracle') {
            await handleOracleOrderSuccess(env, order);
          }
          
          return new Response(JSON.stringify({ received: true }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ received: true }), { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('❌ Webhook error:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ========== PRINTFUL WEBHOOK ==========
    if (url.pathname === "/printful-webhook" && request.method === 'POST') {
      console.log('📦 PRINTFUL WEBHOOK RECEIVED');
      return handlePrintfulWebhook(request, env);
    }
    
    // ========== MANUAL ORDER NOTIFICATION ENDPOINT ==========
    if (url.pathname === '/manual-order-notification' && request.method === 'POST') {
      console.log('🔔 MANUAL ORDER NOTIFICATION REQUEST');
      
      try {
        const { orderDetails, manualItems } = await request.json();
        
        const resendKey = env.RESEND_API_KEY;
        if (!resendKey) {
          throw new Error('RESEND_API_KEY not set');
        }
        
        // Send manual fulfillment alert to admin
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'LYRĪON Studio <onboarding@resend.dev>',
            to: ['hello@lyrion.co.uk'],
            subject: `🎨 MANUAL FULFILLMENT REQUIRED - Order ${orderDetails.sessionId.substring(0, 8)}`,
            html: generateManualFulfillmentEmail(orderDetails, manualItems),
            text: generateManualFulfillmentTextEmail(orderDetails, manualItems),
          })
        });
        
        console.log(`✅ Manual fulfillment alert sent for order ${orderDetails.sessionId}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Manual fulfillment notification sent'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ Manual order notification error:', error);
        return new Response(JSON.stringify({ 
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    // ========== CONTACT FORM ==========
    if (url.pathname === '/contact' && request.method === 'POST') {
      console.log('📧 CONTACT FORM REQUEST');
      
      try {
        const formData = await request.json();
        const required = ['name', 'email', 'message'];
        const missing = required.filter(field => !formData[field]);
        if (missing.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `Missing required fields: ${missing.join(', ')}`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        
        if (!isValidEmail(formData.email)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid email address format'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        
        const resendKey = env.RESEND_API_KEY;
        if (!resendKey) {
          console.log('❌ RESEND_API_KEY not set');
          throw new Error('RESEND_API_KEY not set');
        }
        
        // Send to admin
        const adminResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'LYRĪON Contact <onboarding@resend.dev>',
            to: ['hello@lyrion.co.uk'],
            reply_to: `${formData.name} <${formData.email}>`,
            subject: `LYRĪON Contact: ${formData.subject || 'General Inquiry'}`,
            html: generateContactEmail(formData),
            text: generateContactTextEmail(formData),
          })
        });
        
        if (!adminResponse.ok) {
          const errorText = await adminResponse.text();
          throw new Error(`Failed to send email: ${errorText}`);
        }
        
        // Send confirmation to customer
        const customerResponse = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'LYRĪON <onboarding@resend.dev>',
    to: [formData.email],  // ← This should be customer's email
    subject: `We've received your message!`,
    html: generateContactConfirmationEmail(formData),
    text: generateContactConfirmationTextEmail(formData),
  })
});
        
        const result = await adminResponse.json();
        console.log('✅ Contact emails sent:', result.id);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Message sent successfully!',
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ CONTACT FORM ERROR:', error);
        return new Response(JSON.stringify({ 
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    // ========== REGULAR PRODUCT CHECKOUT ==========
    if (url.pathname === '/create-payment-intent' && request.method === 'POST') {
      console.log('🛒 REGULAR PRODUCT CHECKOUT REQUEST');
      
      try {
        const { amount, cart, customer } = await request.json();
        
        const stripeKey = env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          throw new Error('STRIPE_SECRET_KEY not set');
        }
        
        const baseUrl = env.BASE_URL || 'https://lyrion.co.uk';
        
        const params = new URLSearchParams();
        params.append('payment_method_types[]', 'card');
        params.append('mode', 'payment');
        params.append('success_url', `${baseUrl}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`);
        params.append('cancel_url', `${baseUrl}/checkout.html`);
        
        if (customer.email) {
          params.append('customer_email', customer.email);
        }
        
        cart.items.forEach((item, index) => {
          params.append(`line_items[${index}][price_data][currency]`, 'gbp');
          params.append(`line_items[${index}][price_data][product_data][name]`, item.title);
          if (item.description) {
            params.append(`line_items[${index}][price_data][product_data][description]`, item.description.substring(0, 200));
          }
          params.append(`line_items[${index}][price_data][unit_amount]`, Math.round(item.price * 100).toString());
          params.append(`line_items[${index}][quantity]`, item.quantity.toString());
          
          // Add SKU to metadata if available
          if (item.sku) {
            params.append(`line_items[${index}][price_data][product_data][metadata][sku]`, item.sku);
          }
        });
        
        params.append('metadata[order_type]', 'product');
        params.append('metadata[customer_name]', customer.name || '');
        params.append('metadata[customer_email]', customer.email || '');
        params.append('metadata[cart_total]', amount.toString());
        params.append('metadata[item_count]', cart.items.length.toString());
        
        // If single item, add SKU metadata
        if (cart.items.length === 1 && cart.items[0].sku) {
          params.append('metadata[sku]', cart.items[0].sku);
          if (cart.items[0].size) {
            params.append('metadata[size]', cart.items[0].size);
          }
        }
        
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Stripe-Version': '2023-10-16'
          },
          body: params
        });
        
        if (!stripeResponse.ok) {
          const errorText = await stripeResponse.text();
          throw new Error(`Stripe error: ${errorText}`);
        }
        
        const sessionData = await stripeResponse.json();
        console.log('✅ Stripe session created:', sessionData.id);
        
        return new Response(JSON.stringify({ 
          success: true,
          sessionId: sessionData.id
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ PRODUCT CHECKOUT ERROR:', error);
        return new Response(JSON.stringify({ 
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    // ========== ORACLE CHECKOUT ==========
    if (url.pathname === '/create-oracle-session' && request.method === 'POST') {
      console.log('🔮 ORACLE CHECKOUT REQUEST');
      
      try {
        const orderData = await request.json();
        
        if (!orderData.name || !orderData.email || !orderData.price) {
          throw new Error('Missing required fields: name, email, or price');
        }
        
        const stripeKey = env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          throw new Error('STRIPE_SECRET_KEY not configured');
        }
        
        const baseUrl = env.BASE_URL || 'https://lyrion.co.uk';
        
        const params = new URLSearchParams();
        params.append('payment_method_types[]', 'card');
        params.append('mode', 'payment');
        
        params.append('line_items[0][price_data][currency]', 'gbp');
        params.append('line_items[0][price_data][product_data][name]', `${orderData.tierName || 'Oracle Reading'}`);
        params.append('line_items[0][price_data][product_data][description]', orderData.wordCount || 'Personalized astrology reading');
        params.append('line_items[0][price_data][unit_amount]', Math.round(orderData.price * 100).toString());
        params.append('line_items[0][quantity]', '1');
        
        params.append('success_url', `${baseUrl}/oracle-success.html?session_id={CHECKOUT_SESSION_ID}`);
        params.append('cancel_url', `${baseUrl}/oracle.html`);
        params.append('customer_email', orderData.email);
        
        params.append('metadata[order_type]', 'oracle');
        params.append('metadata[tier]', orderData.tier || '');
        params.append('metadata[tier_name]', orderData.tierName || '');
        params.append('metadata[customer_name]', orderData.name || '');
        params.append('metadata[customer_email]', orderData.email || '');
        params.append('metadata[word_count]', orderData.wordCount || 'N/A');
        params.append('metadata[price]', orderData.price.toString());
        
        if (orderData.question) {
          params.append('metadata[question]', orderData.question.substring(0, 500));
        }
        
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Stripe-Version': '2023-10-16'
          },
          body: params
        });
        
        if (!stripeResponse.ok) {
          const errorText = await stripeResponse.text();
          throw new Error(`Stripe error: ${errorText}`);
        }
        
        const sessionData = await stripeResponse.json();
        console.log('✅ Oracle Stripe session created:', sessionData.id);
        
        return new Response(JSON.stringify({ 
          success: true,
          sessionId: sessionData.id
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ ORACLE CHECKOUT ERROR:', error);
        return new Response(JSON.stringify({ 
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    // ========== DEFAULT ==========
    return new Response(JSON.stringify({
      message: 'LYRĪON Order Broker',
      endpoints: {
        contact: 'POST /contact',
        product_checkout: 'POST /create-payment-intent',
        oracle_checkout: 'POST /create-oracle-session',
        stripe_webhook: 'POST /stripe-webhook',
        printful_webhook: 'POST /printful-webhook',
        manual_notification: 'POST /manual-order-notification',
        health: 'GET /health'
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// ==========================================
// ORIGINAL FUNCTIONS FROM FIRST CODE
// ==========================================

async function createPrintfulOrder(order, routing, env) {
  console.log(`🖨️ Creating Printful order for SKU: ${order.sku}`);
  
  const variantId = routing.variant_map[order.size];

  const payload = {
    external_id: order.stripeSessionId,
    recipient: {
      name: order.name,
      address1: order.address.line1,
      address2: order.address.line2 || '',
      city: order.address.city,
      state_code: order.address.state || '',
      country_code: order.address.country,
      zip: order.address.postal_code
    },
    items: [
      {
        sync_variant_id: variantId,
        quantity: order.quantity
      }
    ]
  };

  const res = await fetch("https://api.printful.com/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PRINTFUL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Printful order creation failed:', errorText);
    throw new Error(`Printful error: ${errorText}`);
  }

  const result = await res.json();
  console.log(`✅ Printful order created: ${result.result.id}`);
  
  return result;
}

async function handlePrintfulWebhook(request) {
  try {
    const payload = await request.json();

    if (payload.type === "order_fulfilled") {
      console.log("✅ Printful fulfilled:", payload.data.id);
    }

    if (payload.type === "order_failed") {
      console.error("❌ Printful failed:", payload.data.reason);
    }

    return new Response("OK", { 
      headers: { "Content-Type": "text/plain" }
    });
  } catch (error) {
    console.error('❌ Printful webhook error:', error);
    return new Response("Error processing webhook", { status: 400 });
  }
}

async function getRouting(sku) {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/Lyrion1/lyrion-co-uk/main/data/routing.json"
    );
    if (!res.ok) {
      console.error('Failed to fetch routing data');
      return null;
    }
    
    const routes = await res.json();
    const route = routes.find(r => r.sku === sku);
    
    if (!route) {
      console.log(`⚠️ No routing found for SKU: ${sku}`);
    }
    
    return route;
  } catch (error) {
    console.error('Error fetching routing:', error);
    return null;
  }
}

// ==========================================
// WEBHOOK HANDLERS WITH MANUAL FULFILLMENT
// ==========================================

async function handleProductOrderSuccess(env, order) {
  console.log(`📦 Processing product order: ${order.stripeSessionId}`);
  
  const orderDetails = {
    sessionId: order.stripeSessionId,
    customer: {
      name: order.name,
      email: order.email,
      address: order.address
    },
    amount: order.price,
    timestamp: new Date().toISOString(),
    itemCount: order.item_count,
    sku: order.sku,
    size: order.size
  };
  
  try {
    // Send admin notification
    await sendAdminNotification(env, orderDetails, 'product');
    
    // Send customer receipt
    if (orderDetails.customer.email) {
      await sendCustomerReceipt(env, orderDetails, 'product');
    }
    
    // Check for manual items warning
    if (orderDetails.itemCount > 0) {
      await sendManualFulfillmentCheck(env, orderDetails);
    }
    
    console.log(`✅ Product order processed: ${order.stripeSessionId}`);
    
  } catch (error) {
    console.error('❌ Error processing product order:', error);
    // Still send basic notifications even if fulfillment check fails
    await sendAdminNotification(env, orderDetails, 'product');
    if (orderDetails.customer.email) {
      await sendCustomerReceipt(env, orderDetails, 'product');
    }
  }
}

async function handleOracleOrderSuccess(env, order) {
  console.log(`🔮 Processing oracle order: ${order.stripeSessionId}`);
  
  const orderDetails = {
    sessionId: order.stripeSessionId,
    customer: {
      name: order.name,
      email: order.email
    },
    orderData: {
      tierName: order.tier_name || 'Oracle Reading',
      price: order.price,
      wordCount: order.word_count || '',
      question: order.question || ''
    },
    timestamp: new Date().toISOString()
  };
  
  // Send admin notification
  await sendAdminNotification(env, orderDetails, 'oracle');
  
  // Send customer receipt
  if (orderDetails.customer.email) {
    await sendCustomerReceipt(env, orderDetails, 'oracle');
  }
  
  console.log(`✅ Oracle order processed: ${order.stripeSessionId}`);
}

// ==========================================
// MANUAL FULFILLMENT FUNCTIONS
// ==========================================

async function sendManualFulfillmentAlert(env, order, routing) {
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) return;
  
  try {
    const manualItems = [{
      sku: order.sku,
      title: routing.name || order.sku,
      quantity: order.quantity,
      size: order.size
    }];
    
    const orderDetails = {
      sessionId: order.stripeSessionId,
      customer: {
        name: order.name,
        email: order.email,
        address: order.address
      },
      amount: order.price,
      timestamp: new Date().toISOString()
    };
    
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LYRĪON Studio <onboarding@resend.dev>',
        to: ['hello@lyrion.co.uk'],
        subject: `🎨 MANUAL FULFILLMENT REQUIRED - Order ${order.stripeSessionId.substring(0, 8)}`,
        html: generateManualFulfillmentEmail(orderDetails, manualItems),
        text: generateManualFulfillmentTextEmail(orderDetails, manualItems),
      })
    });
    
    console.log(`✅ Manual fulfillment alert sent for ${order.stripeSessionId}`);
  } catch (error) {
    console.error('❌ Failed to send manual alert:', error);
  }
}

async function sendManualFulfillmentCheck(env, orderDetails) {
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) return;
  
  try {
    console.log(`🔍 Checking for manual fulfillment items in order ${orderDetails.sessionId}`);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LYRĪON Studio <onboarding@resend.dev>',
        to: ['hello@lyrion.co.uk'],
        subject: `🔍 CHECK FOR MANUAL ITEMS - Order ${orderDetails.sessionId.substring(0, 8)}`,
        html: generateManualCheckEmail(orderDetails),
        text: generateManualCheckTextEmail(orderDetails),
      })
    });
    
    if (response.ok) {
      console.log(`✅ Manual check notification sent for ${orderDetails.sessionId}`);
    }
  } catch (error) {
    console.error('❌ Failed to send manual check notification:', error);
  }
}

// ==========================================
// EMAIL SENDING FUNCTIONS
// ==========================================

async function sendAdminNotification(env, orderDetails, type) {
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) return;
  
  try {
    const subject = type === 'product' 
      ? `🛒 New Order - ${orderDetails.sessionId.substring(0, 8)}` 
      : `🔮 New Oracle Reading - ${orderDetails.orderData.tierName}`;
    
    const html = type === 'product' 
      ? generateProductOrderEmail(orderDetails)
      : generateOracleOrderEmail(orderDetails);
    
    const text = type === 'product'
      ? generateProductOrderTextEmail(orderDetails)
      : generateOracleOrderTextEmail(orderDetails);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LYRĪON Orders <onboarding@resend.dev>',
        to: ['hello@lyrion.co.uk'],
        subject: subject,
        html: html,
        text: text,
      })
    });
    
    if (response.ok) {
      console.log(`✅ Admin notification sent for ${orderDetails.sessionId}`);
    }
  } catch (error) {
    console.error('❌ Failed to send admin notification:', error);
  }
}

async function sendCustomerReceipt(env, orderDetails, type) {
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) return;
  
  try {
    const subject = type === 'product'
      ? `Your LYRĪON Order Confirmation`
      : `Your Oracle Reading Confirmation`;
    
    const html = type === 'product'
      ? generateCustomerReceiptEmail(orderDetails)
      : generateOracleReceiptEmail(orderDetails);
    
    const text = type === 'product'
      ? generateCustomerReceiptTextEmail(orderDetails)
      : generateOracleReceiptTextEmail(orderDetails);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LYRĪON <onboarding@resend.dev>',
        to: [orderDetails.customer.email],
        subject: subject,
        html: html,
        text: text,
      })
    });
    
    if (response.ok) {
      console.log(`✅ Customer receipt sent to ${orderDetails.customer.email}`);
    }
  } catch (error) {
    console.error('❌ Failed to send customer receipt:', error);
  }
}

// ==========================================
// EMAIL TEMPLATES (All included)
// ==========================================

function generateManualCheckEmail(orderDetails) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #c4a449, #a88c3a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
        .order-number { font-size: 1.5rem; font-weight: bold; color: #c4a449; margin: 20px 0; text-align: center; }
        .info-box { background: white; padding: 20px; border-radius: 4px; margin: 20px 0; border: 1px solid #ddd; }
        .action-box { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">🎨 Check for Manual Items</h1>
        <p style="margin: 10px 0 0;">New Order Requires Review</p>
      </div>
      <div class="content">
        <div class="alert-box">
          <h3 style="margin: 0 0 10px 0;">ACTION REQUIRED</h3>
          <p style="margin: 0;">Check if this order contains manual fulfillment items (like A-HOOD-ARIES).</p>
        </div>
        
        <div class="order-number">Order #${orderNumber}</div>
        
        <div class="info-box">
          <p><strong>Order Details:</strong></p>
          <p>Order ID: ${orderDetails.sessionId}</p>
          <p>Customer: ${orderDetails.customer.name}</p>
          <p>Email: ${orderDetails.customer.email}</p>
          <p>Amount: £${orderDetails.amount.toFixed(2)}</p>
          <p>Items: ${orderDetails.itemCount || 'Unknown'}</p>
          <p>Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}</p>
          ${orderDetails.sku ? `<p>SKU: ${orderDetails.sku}</p>` : ''}
          ${orderDetails.size ? `<p>Size: ${orderDetails.size}</p>` : ''}
        </div>
        
        <div class="action-box">
          <p><strong>Next Steps:</strong></p>
          <p>1. Check Stripe Dashboard for order details</p>
          <p>2. Look for SKU: <strong>A-HOOD-ARIES</strong> (manual fulfillment)</p>
          <p>3. If present, add to manual production queue</p>
          <p>4. If POD only, no further action needed</p>
        </div>
        
        <div class="info-box">
          <p><strong>Manual Fulfillment Items:</strong></p>
          <ul>
            <li>A-HOOD-ARIES (Aries Zodiac Hoodie)</li>
            <li>H-CANDLE-HOLDERS-ZODIAC</li>
          </ul>
          <p>These items need to be made in your studio.</p>
        </div>
        
        <div class="footer">
          <p>Review this order within 24 hours</p>
          <p>Stripe Dashboard: https://dashboard.stripe.com/payments/${orderDetails.sessionId}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateManualCheckTextEmail(orderDetails) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  
  return `
    MANUAL FULFILLMENT CHECK - LYRĪON
    ==================================
    
    ACTION REQUIRED: Check if this order contains manual fulfillment items
    
    Order #${orderNumber}
    Order ID: ${orderDetails.sessionId}
    Customer: ${orderDetails.customer.name}
    Email: ${orderDetails.customer.email}
    Amount: £${orderDetails.amount.toFixed(2)}
    Items: ${orderDetails.itemCount || 'Unknown'}
    Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}
    ${orderDetails.sku ? `SKU: ${orderDetails.sku}` : ''}
    ${orderDetails.size ? `Size: ${orderDetails.size}` : ''}
    
    MANUAL FULFILLMENT ITEMS TO CHECK:
    - A-HOOD-ARIES (Aries Zodiac Hoodie)
    - H-CANDLE-HOLDERS-ZODIAC
    
    NEXT STEPS:
    1. Check Stripe Dashboard for order details
    2. Look for manual SKUs in the order
    3. If present, add to manual production queue
    4. If POD only, no further action needed
    
    Stripe Dashboard: https://dashboard.stripe.com/payments/${orderDetails.sessionId}
    
    Review this order within 24 hours.
  `;
}

function generateManualFulfillmentEmail(orderDetails, manualItems) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  const itemsList = manualItems.map(item => 
    `<li><strong>${item.sku}</strong> - ${item.title} (Qty: ${item.quantity}) ${item.size ? `Size: ${item.size}` : ''}</li>`
  ).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #c4a449, #a88c3a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; }
        .order-number { font-size: 1.5rem; font-weight: bold; color: #c4a449; margin: 20px 0; text-align: center; }
        .info-box { background: white; padding: 20px; border-radius: 4px; margin: 20px 0; border: 1px solid #ddd; }
        .action-box { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">🎨 MANUAL FULFILLMENT REQUIRED</h1>
        <p style="margin: 10px 0 0;">Studio Production Needed</p>
      </div>
      <div class="content">
        <div class="alert-box">
          <h3 style="margin: 0 0 10px 0;">⚡ IMMEDIATE ACTION REQUIRED</h3>
          <p style="margin: 0;">This order contains items that need to be made in your studio.</p>
        </div>
        
        <div class="order-number">Order #${orderNumber}</div>
        
        <div class="info-box">
          <p><strong>Order Details:</strong></p>
          <p>Order ID: ${orderDetails.sessionId}</p>
          <p>Customer: ${orderDetails.customer.name}</p>
          <p>Email: ${orderDetails.customer.email}</p>
          <p>Shipping: ${orderDetails.customer.address.line1}, ${orderDetails.customer.address.city}</p>
          <p>Amount: £${orderDetails.amount.toFixed(2)}</p>
          <p>Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}</p>
        </div>
        
        <div class="info-box">
          <p><strong>Manual Items to Produce:</strong></p>
          <ul>${itemsList}</ul>
        </div>
        
        <div class="action-box">
          <p><strong>Production Checklist:</strong></p>
          <p>1. Gather materials for listed items</p>
          <p>2. Begin production within 24 hours</p>
          <p>3. Quality check before packaging</p>
          <p>4. Package with LYRĪON branded materials</p>
          <p>5. Ship via Royal Mail business account</p>
          <p>6. Update tracking in system</p>
        </div>
        
        <div class="footer">
          <p>Complete production within 3-5 business days</p>
          <p>Contact customer if any delays: ${orderDetails.customer.email}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateManualFulfillmentTextEmail(orderDetails, manualItems) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  const itemsList = manualItems.map(item => 
    `- ${item.sku}: ${item.title} (Qty: ${item.quantity}) ${item.size ? `Size: ${item.size}` : ''}`
  ).join('\n');
  
  return `
    MANUAL FULFILLMENT REQUIRED - LYRĪON
    =====================================
    
    ⚡ IMMEDIATE ACTION REQUIRED
    
    This order contains items that need to be made in your studio.
    
    Order #${orderNumber}
    Order ID: ${orderDetails.sessionId}
    Customer: ${orderDetails.customer.name}
    Email: ${orderDetails.customer.email}
    Shipping: ${orderDetails.customer.address.line1}, ${orderDetails.customer.address.city}
    Amount: £${orderDetails.amount.toFixed(2)}
    Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}
    
    MANUAL ITEMS TO PRODUCE:
    ${itemsList}
    
    PRODUCTION CHECKLIST:
    1. Gather materials for listed items
    2. Begin production within 24 hours
    3. Quality check before packaging
    4. Package with LYRĪON branded materials
    5. Ship via Royal Mail business account
    6. Update tracking in system
    
    Complete production within 3-5 business days.
    Contact customer if any delays: ${orderDetails.customer.email}
  `;
}

function generateCustomerReceiptEmail(order) {
  const orderNumber = order.sessionId.substring(order.sessionId.length - 8).toUpperCase();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #c4a449, #a88c3a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .order-number { font-size: 1.5rem; font-weight: bold; color: #c4a449; margin: 20px 0; text-align: center; }
        .thank-you { font-size: 1.2rem; text-align: center; margin-bottom: 30px; }
        .info-box { background: white; padding: 20px; border-radius: 4px; margin: 20px 0; border: 1px solid #ddd; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">Order Confirmed</h1>
        <p style="margin: 10px 0 0;">Thank you for your purchase!</p>
      </div>
      <div class="content">
        <div class="order-number">Order #${orderNumber}</div>
        
        <div class="thank-you">
          Thank you for shopping with LYRĪON. We're preparing your celestial essentials.
        </div>
        
        <div class="info-box">
          <p><strong>Order Details:</strong></p>
          <p>Amount: £${order.amount.toFixed(2)}</p>
          <p>Date: ${new Date(order.timestamp).toLocaleDateString('en-GB')}</p>
          <p>Order ID: ${order.sessionId}</p>
        </div>
        
        <div class="info-box">
          <p><strong>What happens next?</strong></p>
          <p>1. Your order is being processed</p>
          <p>2. We'll ship within 2-3 business days</p>
          <p>3. You'll receive tracking information via email</p>
        </div>
        
        <div class="footer">
          <p>Need help? Contact us at hello@lyrion.co.uk</p>
          <p>Include your order number in any correspondence</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCustomerReceiptTextEmail(order) {
  const orderNumber = order.sessionId.substring(order.sessionId.length - 8).toUpperCase();
  
  return `
    ORDER CONFIRMATION - LYRĪON
    ============================
    
    Thank you for your purchase!
    
    Order Number: #${orderNumber}
    Order ID: ${order.sessionId}
    Amount: £${order.amount.toFixed(2)}
    Date: ${new Date(order.timestamp).toLocaleDateString('en-GB')}
    
    What happens next?
    1. Your order is being processed
    2. We'll ship within 2-3 business days
    3. You'll receive tracking information via email
    
    Need help? Contact us at hello@lyrion.co.uk
    Include your order number in any correspondence.
  `;
}

function generateOracleReceiptEmail(order) {
  const orderNumber = order.sessionId.substring(order.sessionId.length - 8).toUpperCase();
  const deliveryTime = order.orderData.wordCount && order.orderData.wordCount.includes('1,500') ? '72' : '48';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #7b2cbf, #5a189a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .order-number { font-size: 1.5rem; font-weight: bold; color: #7b2cbf; margin: 20px 0; text-align: center; }
        .thank-you { font-size: 1.2rem; text-align: center; margin-bottom: 30px; }
        .info-box { background: white; padding: 20px; border-radius: 4px; margin: 20px 0; border: 1px solid #ddd; }
        .tier-box { background: #e3d5ff; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">Oracle Reading Confirmed</h1>
        <p style="margin: 10px 0 0;">The stars are aligning for you...</p>
      </div>
      <div class="content">
        <div class="order-number">Reading #${orderNumber}</div>
        
        <div class="thank-you">
          Thank you for your cosmic consultation. Our celestial readers are preparing your personalized insights.
        </div>
        
        <div class="tier-box">
          <p><strong>${order.orderData.tierName}</strong></p>
          <p>Word Count: ${order.orderData.wordCount}</p>
          <p>Amount: £${order.orderData.price.toFixed(2)}</p>
        </div>
        
        <div class="info-box">
          <p><strong>What happens next?</strong></p>
          <p>1. Our readers are crafting your personalized reading</p>
          <p>2. You'll receive your PDF within ${deliveryTime} hours</p>
          <p>3. The reading will be sent to this email address</p>
        </div>
        
        <div class="footer">
          <p>Need help? Contact us at hello@lyrion.co.uk</p>
          <p>Include your reading number in any correspondence</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateOracleReceiptTextEmail(order) {
  const orderNumber = order.sessionId.substring(order.sessionId.length - 8).toUpperCase();
  const deliveryTime = order.orderData.wordCount && order.orderData.wordCount.includes('1,500') ? '72' : '48';
  
  return `
    ORACLE READING CONFIRMATION - LYRĪON
    =====================================
    
    Thank you for your cosmic consultation!
    
    Reading Number: #${orderNumber}
    Reading: ${order.orderData.tierName}
    Word Count: ${order.orderData.wordCount}
    Amount: £${order.orderData.price.toFixed(2)}
    Date: ${new Date(order.timestamp).toLocaleDateString('en-GB')}
    
    What happens next?
    1. Our readers are crafting your personalized reading
    2. You'll receive your PDF within ${deliveryTime} hours
    3. The reading will be sent to this email address
    
    Need help? Contact us at hello@lyrion.co.uk
    Include your reading number in any correspondence.
  `;
}

function generateContactConfirmationEmail(formData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #c4a449, #a88c3a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .message { font-size: 1.1rem; text-align: center; margin: 20px 0; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">Message Received</h1>
        <p style="margin: 10px 0 0;">Thank you for reaching out to LYRĪON</p>
      </div>
      <div class="content">
        <div class="message">
          <p>Hello ${formData.name},</p>
          <p>We've received your message and will respond within 24-48 hours.</p>
          <p>Thank you for your interest in LYRĪON Celestial Couture.</p>
        </div>
        
        <div class="footer">
          <p>Warm regards,<br>The LYRĪON Team</p>
          <p>hello@lyrion.co.uk</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateContactConfirmationTextEmail(formData) {
  return `
    MESSAGE RECEIVED - LYRĪON
    ==========================
    
    Hello ${formData.name},
    
    We've received your message and will respond within 24-48 hours.
    
    Thank you for your interest in LYRĪON Celestial Couture.
    
    Warm regards,
    The LYRĪON Team
    hello@lyrion.co.uk
  `;
}

function generateContactEmail(formData) {
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #c4a449, #a88c3a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #c4a449; }
        .value { margin-top: 5px; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">✨ New Cosmic Message ✨</h1>
        <p style="margin: 10px 0 0;">LYRĪON Contact Form Submission</p>
      </div>
      <div class="content">
        <div class="field">
          <div class="label">From:</div>
          <div class="value">${escapeHtml(formData.name)} (${escapeHtml(formData.email)})</div>
        </div>
        <div class="field">
          <div class="label">Subject:</div>
          <div class="value">${escapeHtml(formData.subject || 'General Inquiry')}</div>
        </div>
        <div class="field">
          <div class="label">Message:</div>
          <div class="value">${escapeHtml(formData.message)}</div>
        </div>
        <div class="field">
          <div class="label">Submitted:</div>
          <div class="value">${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })} (GMT)</div>
        </div>
        <div class="footer">
          <p>This message was sent via the LYRĪON website contact form.</p>
          <p>Please respond within 24-48 hours.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateContactTextEmail(formData) {
  return `
    NEW CONTACT FORM SUBMISSION - LYRĪON
    =====================================
    
    From: ${formData.name} (${formData.email})
    Subject: ${formData.subject || 'General Inquiry'}
    
    Message:
    ${formData.message}
    
    Submitted: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })} (GMT)
    
    ---
    This message was sent via the LYRĪON website contact form.
    Please respond within 24-48 hours.
  `;
}

function generateProductOrderEmail(orderDetails) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #c4a449, #a88c3a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .order-number { font-size: 1.5rem; font-weight: bold; color: #c4a449; margin: 20px 0; text-align: center; }
        .info-box { background: white; padding: 20px; border-radius: 4px; margin: 20px 0; border: 1px solid #ddd; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">🛒 New Product Order</h1>
        <p style="margin: 10px 0 0;">Order #${orderNumber}</p>
      </div>
      <div class="content">
        <div class="order-number">Order #${orderNumber}</div>
        
        <div class="info-box">
          <p><strong>Customer Details:</strong></p>
          <p>Name: ${orderDetails.customer.name}</p>
          <p>Email: ${orderDetails.customer.email}</p>
          ${orderDetails.customer.address && orderDetails.customer.address.line1 ? 
            `<p>Address: ${orderDetails.customer.address.line1}, ${orderDetails.customer.address.city}, ${orderDetails.customer.address.postal_code}</p>` : 
            '<p>Address: Not provided</p>'}
        </div>
        
        <div class="info-box">
          <p><strong>Order Details:</strong></p>
          <p>Amount: £${orderDetails.amount.toFixed(2)}</p>
          <p>Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}</p>
          <p>Order ID: ${orderDetails.sessionId}</p>
          <p>Items: ${orderDetails.itemCount}</p>
          ${orderDetails.sku ? `<p>SKU: ${orderDetails.sku}</p>` : ''}
          ${orderDetails.size ? `<p>Size: ${orderDetails.size}</p>` : ''}
        </div>
        
        <div class="footer">
          <p>View in Stripe: https://dashboard.stripe.com/payments/${orderDetails.sessionId}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateProductOrderTextEmail(orderDetails) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  
  return `
    NEW PRODUCT ORDER - LYRĪON
    ===========================
    
    Order #${orderNumber}
    Order ID: ${orderDetails.sessionId}
    
    Customer Details:
    Name: ${orderDetails.customer.name}
    Email: ${orderDetails.customer.email}
    ${orderDetails.customer.address && orderDetails.customer.address.line1 ? 
      `Address: ${orderDetails.customer.address.line1}, ${orderDetails.customer.address.city}, ${orderDetails.customer.address.postal_code}` : 
      'Address: Not provided'}
    
    Order Details:
    Amount: £${orderDetails.amount.toFixed(2)}
    Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}
    Items: ${orderDetails.itemCount}
    ${orderDetails.sku ? `SKU: ${orderDetails.sku}` : ''}
    ${orderDetails.size ? `Size: ${orderDetails.size}` : ''}
    
    View in Stripe: https://dashboard.stripe.com/payments/${orderDetails.sessionId}
  `;
}

function generateOracleOrderEmail(orderDetails) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #7b2cbf, #5a189a); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
        .order-number { font-size: 1.5rem; font-weight: bold; color: #7b2cbf; margin: 20px 0; text-align: center; }
        .info-box { background: white; padding: 20px; border-radius: 4px; margin: 20px 0; border: 1px solid #ddd; }
        .footer { text-align: center; font-size: 0.9em; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">🔮 New Oracle Reading Order</h1>
        <p style="margin: 10px 0 0;">Reading #${orderNumber}</p>
      </div>
      <div class="content">
        <div class="order-number">Reading #${orderNumber}</div>
        
        <div class="info-box">
          <p><strong>Customer Details:</strong></p>
          <p>Name: ${orderDetails.customer.name}</p>
          <p>Email: ${orderDetails.customer.email}</p>
        </div>
        
        <div class="info-box">
          <p><strong>Reading Details:</strong></p>
          <p>Tier: ${orderDetails.orderData.tierName}</p>
          <p>Word Count: ${orderDetails.orderData.wordCount}</p>
          <p>Amount: £${orderDetails.orderData.price.toFixed(2)}</p>
          <p>Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}</p>
        </div>
        
        ${orderDetails.orderData.question ? `
        <div class="info-box">
          <p><strong>Customer Question:</strong></p>
          <p>${orderDetails.orderData.question}</p>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>View in Stripe: https://dashboard.stripe.com/payments/${orderDetails.sessionId}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateOracleOrderTextEmail(orderDetails) {
  const orderNumber = orderDetails.sessionId.substring(orderDetails.sessionId.length - 8).toUpperCase();
  
  return `
    NEW ORACLE READING ORDER - LYRĪON
    ==================================
    
    Reading #${orderNumber}
    Order ID: ${orderDetails.sessionId}
    
    Customer Details:
    Name: ${orderDetails.customer.name}
    Email: ${orderDetails.customer.email}
    
    Reading Details:
    Tier: ${orderDetails.orderData.tierName}
    Word Count: ${orderDetails.orderData.wordCount}
    Amount: £${orderDetails.orderData.price.toFixed(2)}
    Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}
    
    ${orderDetails.orderData.question ? `Customer Question: ${orderDetails.orderData.question}` : ''}
    
    View in Stripe: https://dashboard.stripe.com/payments/${orderDetails.sessionId}
  `;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}