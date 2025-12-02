/**
 * LYRĪON Order Broker - Cloudflare Worker
 * Routes Stripe orders to Printful or Printify
 */

// Which POD service to use (change to 'printify' if preferred)
const POD_SERVICE = 'printful'; // or 'printify'

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');

    // Verify Stripe webhook signature
    const event = await verifyStripeWebhook(payload, signature);

    // Handle checkout completed event
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object);
      return new Response('Order processed', { status: 200 });
    }

    return new Response('Event received', { status: 200 });

  } catch (error) {
    console.error('Worker error:', error);
    return new Response(`Error: ${error.message}`, { status: 400 });
  }
}

// Verify Stripe webhook signature
async function verifyStripeWebhook(payload, signature) {
  const secret = STRIPE_WEBHOOK_SECRET;
  
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

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

// Handle checkout completion
async function handleCheckoutCompleted(session) {
  console.log('Processing order:', session.id);

  // Get line items from Stripe
  const lineItems = await getStripeLineItems(session.id);

  // Create order based on POD service
  if (POD_SERVICE === 'printful') {
    return await createPrintfulOrder(session, lineItems);
  } else if (POD_SERVICE === 'printify') {
    return await createPrintifyOrder(session, lineItems);
  }
}

// Get line items from Stripe
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

// Create Printful order
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

// Create Printify order
async function createPrintifyOrder(session, lineItems) {
  const orderData = {
    external_id: session.id,
    label: `LYRION-${session.id}`,
    line_items: lineItems.map(item => ({
      product_id: item.price?.metadata?.printify_product_id || '',
      variant_id: parseInt(item.price?.metadata?.printify_variant_id || 0),
      quantity: item.quantity
    })),
    shipping_method: 1,
    send_shipping_notification: true,
    address_to: {
      first_name: session.customer_details?.name?.split(' ')[0] || 'Customer',
      last_name: session.customer_details?.name?.split(' ').slice(1).join(' ') || '',
      email: session.customer_details?.email || '',
      address1: session.customer_details?.address?.line1 || '',
      city: session.customer_details?.address?.city || '',
      country: session.customer_details?.address?.country || 'GB',
      zip: session.customer_details?.address?.postal_code || ''
    }
  };

  const response = await fetch('https://api.printify.com/v1/shops/{shop_id}/orders.json', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });

  return await response.json();
}

export default {
  fetch: handleRequest
};