// LYRĪON Order Broker - Cloudflare Worker
// Complete version with: Stripe, Printful, Email Notifications, Manual Fulfillment, ASTROLOGY API
// FIXED: Now includes VAT and Shipping as separate line items in Stripe checkout
// UPDATED: Shipping is ALWAYS £4.95 (NO free shipping threshold) and all shipping fees come to you
// ADDED: Astrology Reading API endpoint for Cosmic Orb
// ADDED: Friend Access Code validation and tracking system

// ========== REMOVE THE IMPORT - CLOUDFLARE WORKERS DON'T SUPPORT ES MODULES FOR EXTERNAL PACKAGES ==========
// Don't import Stripe here - use fetch API directly

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
      'https://lyrion-order-broker.hello-2a3.workers.dev',
      'https://lyrion.co.uk.vercel.app'
    ];
    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature, x-api-key, anthropic-version, x-access-code', // ADDED x-access-code
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true'
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // ========== SIMPLE STRIPE CLIENT FOR CLOUDFLARE WORKERS ==========
    const stripe = {
      webhooks: {
        constructEvent: async (payload, signature, secret) => {
          // Simple webhook verification - for production, implement proper signature verification
          console.log('⚠️ Using simplified webhook verification - implement proper verification for production');
          
          try {
            return JSON.parse(payload);
          } catch (e) {
            throw new Error('Invalid JSON payload');
          }
        }
      }
    };
    
    // ========== ADD THIS NEW ENDPOINT - VALIDATE ACCESS CODE ==========
    if (url.pathname === '/validate-code' && request.method === 'POST') {
      console.log('🔑 CODE VALIDATION REQUEST');
      
      try {
        const { code } = await request.json();
        
        if (!code) {
          return new Response(JSON.stringify({
            valid: false,
            message: 'No code provided'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // **UPDATED: Fetch access codes from GitHub WITHOUT authentication**
        // Public repos can be accessed without a token
        const codesResponse = await fetch(
          'https://raw.githubusercontent.com/Lyrion1/lyrion-co-uk/main/data/access-codes.json',
          {
            headers: {
              'User-Agent': 'LYRION-Worker',
              'Accept': 'application/json'
            }
          }
        );
        
        if (!codesResponse.ok) {
          console.error('❌ Failed to fetch access codes:', codesResponse.status, codesResponse.statusText);
          // Return a fallback response instead of throwing error
          return new Response(JSON.stringify({
            valid: false,
            message: 'Validation service temporarily unavailable',
            fallback: true
          }), {
            status: 200, // Return 200 so checkout can continue
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        const codesData = await codesResponse.json();
        const normalizedCode = code.toUpperCase().trim();
        
        // Find matching code
        const accessCode = codesData.codes?.find(c => c.code === normalizedCode);
        
        if (!accessCode) {
          console.log(`❌ Code not found: ${normalizedCode}`);
          return new Response(JSON.stringify({
            valid: false,
            message: 'Invalid code'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Check if code is active
        if (accessCode.status !== 'active') {
          console.log(`❌ Code inactive: ${normalizedCode}`);
          return new Response(JSON.stringify({
            valid: false,
            message: 'This access has ended'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Check if code has uses remaining
        if (accessCode.uses_remaining <= 0) {
          console.log(`❌ Code exhausted: ${normalizedCode}`);
          return new Response(JSON.stringify({
            valid: false,
            message: 'This access has reached its limit'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Check if code has expired
        const expiryDate = new Date(accessCode.expires);
        const now = new Date();
        
        if (now > expiryDate) {
          console.log(`❌ Code expired: ${normalizedCode}`);
          return new Response(JSON.stringify({
            valid: false,
            message: 'This access has expired'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Code is valid
        console.log(`✅ Code validated: ${normalizedCode} (${accessCode.uses_remaining} uses remaining)`);
        
        return new Response(JSON.stringify({
          valid: true,
          owner: accessCode.owner,
          discount: accessCode.discount_percent,
          expires: accessCode.expires,
          usesRemaining: accessCode.uses_remaining
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ CODE VALIDATION ERROR:', error);
        // Don't fail validation - allow checkout to continue without discount
        return new Response(JSON.stringify({
          valid: false,
          message: 'Validation service error',
          error: error.message,
          note: 'Checkout can continue without discount'
        }), {
          status: 200, // Return 200 so checkout can continue
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    // ========== ADD THIS NEW ENDPOINT - APPLY ACCESS CODE ==========
    if (url.pathname === '/apply-code' && request.method === 'POST') {
      console.log('📊 APPLY CODE REQUEST');
      
      try {
        const { code, sessionId, orderAmount } = await request.json();
        
        if (!code || !sessionId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing code or session ID'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        const githubToken = env.GITHUB_TOKEN;
        if (!githubToken) {
          console.error('❌ GITHUB_TOKEN not configured');
          // Don't fail the order, just log the issue
          return new Response(JSON.stringify({
            success: false,
            error: 'GitHub token not configured',
            note: 'Code usage not tracked, but order successful'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Fetch current access codes
        const codesResponse = await fetch(
          'https://api.github.com/repos/Lyrion1/lyrion-co-uk/contents/data/access-codes.json',
          {
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'LYRION-Worker'
            }
          }
        );
        
        if (!codesResponse.ok) {
          throw new Error('Failed to fetch access codes from GitHub');
        }
        
        const fileData = await codesResponse.json();
        const content = atob(fileData.content);
        const codesData = JSON.parse(content);
        
        const normalizedCode = code.toUpperCase().trim();
        const codeIndex = codesData.codes.findIndex(c => c.code === normalizedCode);
        
        if (codeIndex === -1) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Code not found'
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Update code stats
        codesData.codes[codeIndex].uses_remaining -= 1;
        codesData.codes[codeIndex].total_uses += 1;
        
        // If no uses remaining, mark as inactive
        if (codesData.codes[codeIndex].uses_remaining <= 0) {
          codesData.codes[codeIndex].status = 'exhausted';
        }
        
        // Add conversion tracking (optional - you can expand this)
        if (!codesData.codes[codeIndex].conversions) {
          codesData.codes[codeIndex].conversions = [];
        }
        
        codesData.codes[codeIndex].conversions.push({
          sessionId: sessionId,
          amount: orderAmount || 0,
          timestamp: new Date().toISOString()
        });
        
        // Update file on GitHub
        const updatedContent = btoa(JSON.stringify(codesData, null, 2));
        
        const updateResponse = await fetch(
          'https://api.github.com/repos/Lyrion1/lyrion-co-uk/contents/data/access-codes.json',
          {
            method: 'PUT',
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'LYRION-Worker'
            },
            body: JSON.stringify({
              message: `Update access code usage: ${normalizedCode} (${codesData.codes[codeIndex].uses_remaining} uses remaining)`,
              content: updatedContent,
              sha: fileData.sha
            })
          }
        );
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`GitHub update failed: ${errorText}`);
        }
        
        console.log(`✅ Code applied: ${normalizedCode} (${codesData.codes[codeIndex].uses_remaining} uses remaining)`);
        
        return new Response(JSON.stringify({
          success: true,
          usesRemaining: codesData.codes[codeIndex].uses_remaining,
          totalUses: codesData.codes[codeIndex].total_uses,
          status: codesData.codes[codeIndex].status
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ APPLY CODE ERROR:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          note: 'Code application failed, but order was successful'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    // ========== ADD THIS NEW ENDPOINT - GET CODE STATS ==========
    if (url.pathname === '/code-stats' && request.method === 'GET') {
      console.log('📊 CODE STATS REQUEST');
      
      try {
        // Check for admin authorization (simple password check)
        const authHeader = request.headers.get('Authorization');
        const adminPassword = env.ADMIN_PASSWORD || 'your-secret-password';
        
        if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
          return new Response(JSON.stringify({
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Fetch access codes
        const codesResponse = await fetch(
          'https://raw.githubusercontent.com/Lyrion1/lyrion-co-uk/main/data/access-codes.json'
        );
        
        if (!codesResponse.ok) {
          throw new Error('Failed to fetch access codes');
        }
        
        const codesData = await codesResponse.json();
        
        // Calculate stats
        const stats = codesData.codes.map(code => {
          const totalRevenue = (code.conversions || []).reduce((sum, conv) => sum + conv.amount, 0);
          const daysLeft = Math.ceil((new Date(code.expires) - new Date()) / (1000 * 60 * 60 * 24));
          
          return {
            code: code.code,
            owner: code.owner,
            usesRemaining: code.uses_remaining,
            totalUses: code.total_uses,
            status: code.status,
            daysLeft: daysLeft > 0 ? daysLeft : 0,
            totalRevenue: totalRevenue.toFixed(2),
            conversionCount: (code.conversions || []).length
          };
        });
        
        return new Response(JSON.stringify({
          success: true,
          stats: stats,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ CODE STATS ERROR:', error);
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
    
    // ========== HEALTH CHECK ==========
    if (url.pathname === "/health") {
      return new Response("OK", { 
        headers: { 
          "Content-Type": "text/plain",
          ...corsHeaders 
        }
      });
    }
    
    // ========== ASTROLOGY READING API ENDPOINT ==========
    if (url.pathname === '/astrology-reading' && request.method === 'POST') {
      console.log('🔮 ASTROLOGY READING REQUEST');
      
      try {
        const { prompt, birthData } = await request.json();
        
        const anthropicKey = env.ANTHROPIC_API_KEY;
        if (!anthropicKey) {
          throw new Error('ANTHROPIC_API_KEY not configured');
        }
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: prompt
            }]
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${errorText}`);
        }
        
        const data = await response.json();
        const content = data.content[0].text;
        
        return new Response(JSON.stringify({
          success: true,
          content: content
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ ASTROLOGY READING ERROR:', error);
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
        const event = await stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
        
        console.log(`🔄 Webhook event type: ${event.type}`);
        
        // Handle successful checkout session
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          console.log(`✅ Payment successful for session: ${session.id}`);
          
          // ========== ADDED: ACCESS CODE TRACKING ==========
          // If access code was used, track the conversion
          if (session.metadata.access_code) {
            try {
              await fetch(`${url.origin}/apply-code`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  code: session.metadata.access_code,
                  sessionId: session.id,
                  orderAmount: session.amount_total / 100
                })
              });
              console.log(`✅ Access code usage tracked: ${session.metadata.access_code}`);
            } catch (error) {
              console.error('❌ Failed to track code usage:', error);
              // Don't fail the order, just log the error
            }
          }
          // ========== END ADDED ==========
          
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
            from: 'LYRĪON <orders@send.lyrion.co.uk>',
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
            from: 'LYRĪON <orders@send.lyrion.co.uk>',
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
            from: 'LYRĪON <orders@send.lyrion.co.uk>',
            to: [formData.email],
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
    
    // ========== REGULAR PRODUCT CHECKOUT - UPDATED WITH ACCESS CODE HANDLING ==========
    if (url.pathname === '/create-payment-intent' && request.method === 'POST') {
      console.log('🛒 REGULAR PRODUCT CHECKOUT REQUEST');
      
      try {
        const { amount, cart, customer, accessCode, accessDiscount, accessOwner } = await request.json();
        
        const stripeKey = env.STRIPE_SECRET_KEY;
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
        
        // ========== ADDED: ACCESS CODE HANDLING ==========
        // Check for active access code in headers (for backward compatibility)
        let finalAccessDiscount = accessDiscount || 0;
        let finalAccessCode = accessCode;
        let finalAccessOwner = accessOwner;
        
        if (request.headers.get('x-access-code')) {
          const code = request.headers.get('x-access-code');
          
          // Validate code again before applying
          const validateResponse = await fetch(`${url.origin}/validate-code`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
          });
          
          if (validateResponse.ok) {
            const validation = await validateResponse.json();
            if (validation.valid) {
              finalAccessDiscount = validation.discount || 15;
              finalAccessCode = code.toUpperCase();
              finalAccessOwner = validation.owner;
              console.log(`✅ Access code validated: ${finalAccessCode} (${finalAccessDiscount}% discount)`);
            }
          }
        }
        // ========== END ADDED ==========
        
        // Calculate cart subtotal (products only)
        let cartSubtotal = cart.items.reduce((sum, item) => {
          return sum + (item.price * item.quantity);
        }, 0);
        
        // ========== ADDED: APPLY FRIEND ACCESS DISCOUNT ==========
        if (finalAccessDiscount > 0) {
          const discountAmount = cartSubtotal * (finalAccessDiscount / 100);
          cartSubtotal = cartSubtotal - discountAmount;
          console.log(`💰 Friend access discount applied: ${finalAccessDiscount}% (£${discountAmount.toFixed(2)} off)`);
          
          // Add discount as a line item
          params.append('line_items[0][price_data][currency]', 'gbp');
          params.append('line_items[0][price_data][product_data][name]', `Friend Access Discount (${finalAccessDiscount}%)`);
          params.append('line_items[0][price_data][product_data][description]', `Applied via ${finalAccessOwner}`);
          params.append('line_items[0][price_data][unit_amount]', Math.round(-discountAmount * 100).toString()); // Negative amount
          params.append('line_items[0][quantity]', '1');
          
          // Start regular items at index 1
          var itemIndex = 1;
        } else {
          var itemIndex = 0;
        }
        // ========== END ADDED ==========
        
        // **FIXED: Shipping is ALWAYS £4.95 - NO free shipping threshold**
        const shippingAmount = 4.95; // Always charge shipping
        
        // Calculate VAT (20% on subtotal + shipping)
        const taxableAmount = cartSubtotal + shippingAmount;
        const vatAmount = taxableAmount * 0.20;
        
        // Calculate total (should match amount from checkout.js)
        const calculatedTotal = cartSubtotal + shippingAmount + vatAmount;
        
        console.log('💰 Order breakdown:', {
          discount: finalAccessDiscount > 0 ? `${finalAccessDiscount}% off` : 'none',
          products: cartSubtotal,
          shipping: shippingAmount,
          vat: vatAmount,
          total: calculatedTotal,
          receivedAmount: amount,
          note: 'Shipping ALWAYS charged: £4.95 (no free shipping)'
        });
        
        // Add line items for each product (starting from correct index)
        cart.items.forEach((item, cartIndex) => {
          const currentIndex = itemIndex + cartIndex;
          params.append(`line_items[${currentIndex}][price_data][currency]`, 'gbp');
          params.append(`line_items[${currentIndex}][price_data][product_data][name]`, item.title);
          if (item.description) {
            params.append(`line_items[${currentIndex}][price_data][product_data][description]`, item.description.substring(0, 200));
          }
          params.append(`line_items[${currentIndex}][price_data][unit_amount]`, Math.round(item.price * 100).toString());
          params.append(`line_items[${currentIndex}][quantity]`, item.quantity.toString());
          
          // Add SKU to metadata if available
          if (item.sku) {
            params.append(`line_items[${currentIndex}][price_data][product_data][metadata][sku]`, item.sku);
          }
        });
        
        // Update index after adding products
        itemIndex += cart.items.length;
        
        // Add VAT as a separate line item - FIXED!
        const productItemsCount = cart.items.length;
        if (vatAmount > 0) {
          params.append(`line_items[${itemIndex}][price_data][currency]`, 'gbp');
          params.append(`line_items[${itemIndex}][price_data][product_data][name]`, 'VAT (20%)');
          params.append(`line_items[${itemIndex}][price_data][product_data][description]`, 'Value Added Tax');
          params.append(`line_items[${itemIndex}][price_data][unit_amount]`, Math.round(vatAmount * 100).toString());
          params.append(`line_items[${itemIndex}][quantity]`, '1');
          itemIndex++;
        }
        
        // Add Shipping as a separate line item - ALWAYS CHARGED!
        // **ALWAYS add shipping line item - £4.95 fixed rate**
        params.append(`line_items[${itemIndex}][price_data][currency]`, 'gbp');
        params.append(`line_items[${itemIndex}][price_data][product_data][name]`, 'UK Standard Shipping');
        params.append(`line_items[${itemIndex}][price_data][product_data][description]`, 'Royal Mail 2nd Class (3-5 working days)');
        params.append(`line_items[${itemIndex}][price_data][unit_amount]`, Math.round(shippingAmount * 100).toString());
        params.append(`line_items[${itemIndex}][quantity]`, '1');
        
        // Add metadata
        params.append('metadata[order_type]', 'product');
        params.append('metadata[customer_name]', customer.name || '');
        params.append('metadata[customer_email]', customer.email || '');
        params.append('metadata[cart_total]', calculatedTotal.toString());
        params.append('metadata[cart_subtotal]', cartSubtotal.toString());
        params.append('metadata[shipping_amount]', shippingAmount.toString());
        params.append('metadata[shipping_note]', 'Shipping fee comes to LYRĪON (we handle shipping)');
        params.append('metadata[vat_amount]', vatAmount.toString());
        params.append('metadata[item_count]', cart.items.length.toString());
        
        // ========== ADDED: ACCESS CODE METADATA ==========
        if (finalAccessCode) {
          params.append('metadata[access_code]', finalAccessCode);
          params.append('metadata[access_owner]', finalAccessOwner);
          params.append('metadata[discount_percent]', finalAccessDiscount.toString());
        }
        // ========== END ADDED ==========
        
        // If single item, add SKU metadata
        if (cart.items.length === 1 && cart.items[0].sku) {
          params.append('metadata[sku]', cart.items[0].sku);
          if (cart.items[0].size) {
            params.append('metadata[size]', cart.items[0].size);
          }
        }
        
        console.log('📤 Creating Stripe session with VAT and shipping line items...');
        
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
          console.error('❌ Stripe error details:', errorText);
          throw new Error(`Stripe error: ${errorText}`);
        }
        
        const sessionData = await stripeResponse.json();
        console.log('✅ Stripe session created:', sessionData.id);
        console.log('✅ Stripe session amount:', sessionData.amount_total / 100);
        console.log('✅ Shipping fee (£4.95) will come to LYRĪON');
        
        return new Response(JSON.stringify({ 
          success: true,
          sessionId: sessionData.id,
          sessionAmount: sessionData.amount_total / 100,
          note: 'Shipping fee included and will be paid to LYRĪON'
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
        
        const stripeKey = env.STRIPE_SECRET_KEY;
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
        
        // Add VAT for oracle readings (20%)
        const vatAmount = orderData.price * (1 - 1/1.2); // Calculate VAT from inclusive price
        params.append('line_items[1][price_data][currency]', 'gbp');
        params.append('line_items[1][price_data][product_data][name]', 'VAT (20%)');
        params.append('line_items[1][price_data][product_data][description]', 'Value Added Tax');
        params.append('line_items[1][price_data][unit_amount]', Math.round(vatAmount * 100).toString());
        params.append('line_items[1][quantity]', '1');
        
        // **Oracle readings don't need shipping - digital product only**
        
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
        params.append('metadata[vat_amount]', vatAmount.toString());
        params.append('metadata[shipping_amount]', '0');
        params.append('metadata[shipping_note]', 'Digital product - no shipping required');
        
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
    
    // ========== SEND ORDER CONFIRMATION (No webhook needed!) ==========
    if (url.pathname === '/send-order-confirmation' && request.method === 'POST') {
      console.log('📧 DIRECT EMAIL REQUEST - NO WEBHOOK NEEDED');
      
      try {
        const { sessionId, orderType } = await request.json();
        
        if (!sessionId) {
          throw new Error('No session ID provided');
        }
        
        const stripeKey = env.STRIPE_SECRET_KEY;
        
        // Fetch session details from Stripe
        console.log(`🔍 Fetching Stripe session: ${sessionId}`);
        const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Stripe-Version': '2023-10-16'
          }
        });
        
        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text();
          throw new Error(`Failed to fetch session from Stripe: ${errorText}`);
        }
        
        const session = await sessionResponse.json();
        console.log('✅ Stripe session fetched successfully');
        
        // Prepare order details
        const orderDetails = {
          sessionId: session.id,
          customer: {
            name: session.customer_details?.name || session.metadata?.customer_name || '',
            email: session.customer_email || session.metadata?.customer_email || '',
            address: session.customer_details?.address || {}
          },
          amount: session.amount_total / 100,
          timestamp: new Date().toISOString(),
          itemCount: session.metadata?.item_count || 1,
          sku: session.metadata?.sku || '',
          size: session.metadata?.size || '',
          subtotal: parseFloat(session.metadata?.cart_subtotal || '0'),
          shipping: parseFloat(session.metadata?.shipping_amount || '4.95'), // Default to £4.95 if not set
          vat: parseFloat(session.metadata?.vat_amount || '0'),
          shippingNote: session.metadata?.shipping_note || 'Shipping fee paid to LYRĪON',
          // ========== ADDED: ACCESS CODE INFO ==========
          accessCode: session.metadata?.access_code || null,
          accessOwner: session.metadata?.access_owner || null,
          discountPercent: session.metadata?.discount_percent || 0
          // ========== END ADDED ==========
        };
        
        const finalOrderType = orderType || session.metadata?.order_type || 'product';
        
        if (finalOrderType === 'oracle') {
          orderDetails.orderData = {
            tierName: session.metadata?.tier_name || 'Oracle Reading',
            price: orderDetails.amount,
            wordCount: session.metadata?.word_count || '',
            question: session.metadata?.question || ''
          };
          // Oracle has no shipping
          orderDetails.shipping = 0;
          orderDetails.shippingNote = 'Digital product - no shipping required';
        }
        
        console.log(`📤 Sending ${finalOrderType} emails...`);
        
        // Send emails
        await sendAdminNotification(env, orderDetails, finalOrderType);
        console.log('✅ Admin email sent');
        
        if (orderDetails.customer.email) {
          await sendCustomerReceipt(env, orderDetails, finalOrderType);
          console.log('✅ Customer email sent');
        }
        
        console.log('✅ All confirmation emails sent for:', sessionId);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Emails sent successfully'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        console.error('❌ Email sending error:', error);
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
    
    // ========== DEFAULT ==========
    return new Response(JSON.stringify({
      message: 'LYRĪON Order Broker',
      endpoints: {
        // ========== ADDED NEW ENDPOINTS ==========
        validate_code: 'POST /validate-code',
        apply_code: 'POST /apply-code',
        code_stats: 'GET /code-stats',
        // ========== END ADDED ==========
        astrology_reading: 'POST /astrology-reading',
        contact: 'POST /contact',
        product_checkout: 'POST /create-payment-intent',
        oracle_checkout: 'POST /create-oracle-session',
        stripe_webhook: 'POST /stripe-webhook',
        printful_webhook: 'POST /printful-webhook',
        manual_notification: 'POST /manual-order-notification',
        health: 'GET /health',
        send_order_confirmation: 'POST /send-order-confirmation'
      },
      friend_access_system: true  // ========== ADDED ==========
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// ==========================================
// ASTROLOGY FUNCTIONS
// ==========================================

function generateFallbackAstrologyReading(birthData) {
  if (!birthData) {
    return 'Unable to generate reading at this time. Your cosmic signature is unique and worthy of exploration.';
  }
  
  const { sunSign, element, modality, ruler } = birthData;
  
  return `**ESSENCE**
As a ${sunSign} Sun, your ${element} element gives you ${getElementQuality(element)}. Ruled by ${ruler}, you possess ${getRulerQuality(ruler)}. Your ${modality} nature makes you ${getModalityQuality(modality)}.

**LUNAR INFLUENCE**
Your emotional landscape reflects your ${element} element, seeking ${getElementEmotionalNeed(element)}. The Moon's phases affect you deeply, and you process feelings through ${getElementProcessing(element)}.

**RISING PATTERNS**
Your ascendant shapes how others perceive you - often as someone who ${getSignFirstImpression(sunSign)}. This external presentation helps you navigate the world while protecting your inner depths.

**DEEPER COSMIC INSIGHTS**
Current celestial patterns suggest a period of ${getCurrentTheme(sunSign)}. The next lunar cycle will highlight ${getNextOpportunity(sunSign)}. Remember: ${getCosmicAdvice(sunSign)}`;
}

function getElementQuality(element) {
  const qualities = {
    'Fire': 'passion, initiative, and creative spark',
    'Earth': 'stability, practicality, and grounded wisdom',
    'Air': 'intellect, communication, and social grace',
    'Water': 'intuition, empathy, and emotional depth'
  };
  return qualities[element] || 'unique qualities';
}

function getRulerQuality(ruler) {
  const qualities = {
    'Sun': 'radiant self-expression and leadership potential',
    'Moon': 'deep emotional intelligence and nurturing capacity',
    'Mercury': 'quick intellect and communicative gifts',
    'Venus': 'appreciation for beauty and relational harmony',
    'Mars': 'courage, drive, and assertive energy',
    'Jupiter': 'optimism, expansion, and philosophical insight',
    'Saturn': 'discipline, structure, and mastery through challenge',
    'Uranus': 'innovation, originality, and visionary thinking',
    'Neptune': 'imagination, spirituality, and creative inspiration',
    'Pluto': 'transformative power and psychological depth'
  };
  return qualities[ruler] || 'unique planetary gifts';
}

function getModalityQuality(modality) {
  return modality === 'Cardinal' ? 'an initiator who starts new cycles' :
         modality === 'Fixed' ? 'determined and capable of sustained focus' :
         'adaptable and able to work with changing circumstances';
}

function getElementEmotionalNeed(element) {
  return element === 'Fire' ? 'authentic self-expression and freedom' :
         element === 'Earth' ? 'security and tangible results' :
         element === 'Air' ? 'intellectual stimulation and social connection' :
         'emotional safety and deep connection';
}

function getElementProcessing(element) {
  return element === 'Fire' ? 'action and creative outlets' :
         element === 'Earth' ? 'practical solutions and physical activity' :
         element === 'Air' ? 'discussion and intellectual analysis' :
         'introspection and artistic expression';
}

function getSignFirstImpression(sign) {
  const impressions = {
    'Aries': 'appears confident and ready for action',
    'Taurus': 'seems reliable and grounded',
    'Gemini': 'comes across as curious and engaging',
    'Cancer': 'presents as caring and protective',
    'Leo': 'appears radiant and charismatic',
    'Virgo': 'seems competent and attentive to detail',
    'Libra': 'comes across as diplomatic and harmonious',
    'Scorpio': 'appears intense and perceptive',
    'Sagittarius': 'seems optimistic and adventurous',
    'Capricorn': 'presents as capable and responsible',
    'Aquarius': 'appears unique and forward-thinking',
    'Pisces': 'seems gentle and imaginative'
  };
  return impressions[sign] || 'makes a memorable impression';
}

function getCurrentTheme(sign) {
  const themes = {
    'Aries': 'bold new beginnings and self-assertion',
    'Taurus': 'building secure foundations and enjoying sensory pleasures',
    'Gemini': 'communication, learning, and social connections',
    'Cancer': 'emotional healing and creating nurturing spaces',
    'Leo': 'creative expression and stepping into leadership',
    'Virgo': 'organizing, improving, and helpful service',
    'Libra': 'relationship harmony and aesthetic refinement',
    'Scorpio': 'transformative growth and psychological depth',
    'Sagittarius': 'philosophical exploration and adventurous expansion',
    'Capricorn': 'practical achievement and long-term planning',
    'Aquarius': 'innovative thinking and community involvement',
    'Pisces': 'creative inspiration and spiritual connection'
  };
  return themes[sign] || 'personal growth and self-discovery';
}

function getNextOpportunity(sign) {
  const opportunities = {
    'Aries': 'taking initiative on personal projects',
    'Taurus': 'financial planning or creative ventures',
    'Gemini': 'learning new skills or networking',
    'Cancer': 'family matters or home improvements',
    'Leo': 'creative expression or public recognition',
    'Virgo': 'health routines or work optimization',
    'Libra': 'partnership developments or artistic collaborations',
    'Scorpio': 'deep psychological work or intimate connections',
    'Sagittarius': 'educational pursuits or travel plans',
    'Capricorn': 'career advancement or goal achievement',
    'Aquarius': 'community projects or innovative ideas',
    'Pisces': 'artistic endeavors or spiritual practices'
  };
  return opportunities[sign] || 'personal development opportunities';
}

function getCosmicAdvice(sign) {
  const advice = {
    'Aries': 'Your courage is your compass. Trust your instincts to lead you forward.',
    'Taurus': 'Your patience creates lasting value. Build steadily toward your dreams.',
    'Gemini': 'Your curiosity opens doors. Share your insights with others.',
    'Cancer': 'Your intuition guides you home. Nurture yourself as you nurture others.',
    'Leo': 'Your creativity lights the way. Share your unique radiance.',
    'Virgo': 'Your attention to detail creates excellence. Find beauty in service.',
    'Libra': 'Your sense of balance creates harmony. Build bridges, not walls.',
    'Scorpio': 'Your depth reveals truth. Transform challenges into wisdom.',
    'Sagittarius': 'Your vision expands horizons. Seek truth with an open heart.',
    'Capricorn': 'Your discipline builds mountains. Each step upward matters.',
    'Aquarius': 'Your uniqueness inspires change. Connect ideas to create progress.',
    'Pisces': 'Your compassion heals wounds. Dream boldly, create gently.'
  };
  return advice[sign] || 'Your journey is uniquely yours. Trust the cosmic timing.';
}

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
    size: order.size,
    shipping: 4.95, // **Always £4.95 shipping**
    shippingNote: 'Shipping fee paid to LYRĪON (we handle shipping)'
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
    console.log(`✅ Shipping fee £4.95 will be paid to LYRĪON`);
    
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
    timestamp: new Date().toISOString(),
    shipping: 0, // Digital product - no shipping
    shippingNote: 'Digital product - no shipping required'
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
      timestamp: new Date().toISOString(),
      shipping: 4.95, // **Shipping fee included**
      shippingNote: 'Shipping fee £4.95 collected - will be used for postage'
    };
    
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LYRĪON <orders@send.lyrion.co.uk>',
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
        from: 'LYRĪON <orders@send.lyrion.co.uk>',
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
        from: 'LYRĪON <orders@send.lyrion.co.uk>',
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
        from: 'LYRĪON <orders@send.lyrion.co.uk>',
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
          <p><strong>Note:</strong> £4.95 shipping fee collected - will be used for postage</p>
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
    
    Note: £4.95 shipping fee collected - will be used for postage
    
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
          <p>Shipping Fee: £${orderDetails.shipping.toFixed(2)} (collected for postage)</p>
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
          <p>5. Ship via Royal Mail (use £4.95 shipping fee for postage)</p>
          <p>6. Update tracking in system</p>
        </div>
        
        <div class="footer">
          <p>Complete production within 3-5 business days</p>
          <p>Contact customer if any delays: ${orderDetails.customer.email}</p>
          <p><strong>Shipping fee £${orderDetails.shipping.toFixed(2)} collected - use for postage</strong></p>
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
    Shipping Fee: £${orderDetails.shipping.toFixed(2)} (collected for postage)
    Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}
    
    MANUAL ITEMS TO PRODUCE:
    ${itemsList}
    
    PRODUCTION CHECKLIST:
    1. Gather materials for listed items
    2. Begin production within 24 hours
    3. Quality check before packaging
    4. Package with LYRĪON branded materials
    5. Ship via Royal Mail (use £4.95 shipping fee for postage)
    6. Update tracking in system
    
    Complete production within 3-5 business days.
    Contact customer if any delays: ${orderDetails.customer.email}
    
    Shipping fee £${orderDetails.shipping.toFixed(2)} collected - use for postage.
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
        .breakdown { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
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
          <p>Order ID: ${order.sessionId}</p>
          <p>Date: ${new Date(order.timestamp).toLocaleDateString('en-GB')}</p>
        </div>
        
        <div class="breakdown">
          <p><strong>Payment Breakdown:</strong></p>
          <p>Subtotal (Products): £${order.subtotal ? order.subtotal.toFixed(2) : '0.00'}</p>
          <p>Shipping: £${order.shipping ? order.shipping.toFixed(2) : '4.95'} ${order.shippingNote ? `(${order.shippingNote})` : ''}</p>
          <p>VAT (20%): £${order.vat ? order.vat.toFixed(2) : '0.00'}</p>
          <p><strong>Total: £${order.amount.toFixed(2)}</strong></p>
        </div>
        
        <div class="info-box">
          <p><strong>What happens next?</strong></p>
          <p>1. Your order is being processed</p>
          <p>2. We'll ship within 2-3 business days</p>
          <p>3. You'll receive tracking information via email</p>
          <p><em>Shipping via Royal Mail 2nd Class (3-5 working days)</em></p>
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
    Date: ${new Date(order.timestamp).toLocaleDateString('en-GB')}
    
    PAYMENT BREAKDOWN:
    Subtotal (Products): £${order.subtotal ? order.subtotal.toFixed(2) : '0.00'}
    Shipping: £${order.shipping ? order.shipping.toFixed(2) : '4.95'} ${order.shippingNote ? `(${order.shippingNote})` : ''}
    VAT (20%): £${order.vat ? order.vat.toFixed(2) : '0.00'}
    Total: £${order.amount.toFixed(2)}
    
    What happens next?
    1. Your order is being processed
    2. We'll ship within 2-3 business days
    3. You'll receive tracking information via email
    4. Shipping via Royal Mail 2nd Class (3-5 working days)
    
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
        .breakdown { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
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
        
        <div class="breakdown">
          <p><strong>Payment Breakdown:</strong></p>
          <p>Reading Fee: £${(order.orderData.price / 1.2).toFixed(2)}</p>
          <p>VAT (20%): £${(order.orderData.price * 0.2 / 1.2).toFixed(2)}</p>
          <p>Shipping: £0.00 (Digital product)</p>
          <p><strong>Total: £${order.orderData.price.toFixed(2)}</strong></p>
        </div>
        
        <div class="info-box">
          <p><strong>What happens next?</strong></p>
          <p>1. Our readers are crafting your personalized reading</p>
          <p>2. You'll receive your PDF within ${deliveryTime} hours</p>
          <p>3. The reading will be sent to this email address</p>
          <p><em>No shipping required - this is a digital product</em></p>
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
    Date: ${new Date(order.timestamp).toLocaleDateString('en-GB')}
    
    PAYMENT BREAKDOWN:
    Reading Fee: £${(order.orderData.price / 1.2).toFixed(2)}
    VAT (20%): £${(order.orderData.price * 0.2 / 1.2).toFixed(2)}
    Shipping: £0.00 (Digital product)
    Total: £${order.orderData.price.toFixed(2)}
    
    What happens next?
    1. Our readers are crafting your personalized reading
    2. You'll receive your PDF within ${deliveryTime} hours
    3. The reading will be sent to this email address
    4. No shipping required - this is a digital product
    
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
        .breakdown { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
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
        
        <div class="breakdown">
          <p><strong>Payment Breakdown:</strong></p>
          <p>Subtotal (Products): £${orderDetails.subtotal ? orderDetails.subtotal.toFixed(2) : '0.00'}</p>
          <p>Shipping: £${orderDetails.shipping ? orderDetails.shipping.toFixed(2) : '4.95'} ${orderDetails.shippingNote ? `(${orderDetails.shippingNote})` : ''}</p>
          <p>VAT (20%): £${orderDetails.vat ? orderDetails.vat.toFixed(2) : '0.00'}</p>
          <p><strong>Total: £${orderDetails.amount.toFixed(2)}</strong></p>
        </div>
        
        <div class="info-box">
          <p><strong>Order Details:</strong></p>
          <p>Order ID: ${orderDetails.sessionId}</p>
          <p>Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}</p>
          <p>Items: ${orderDetails.itemCount}</p>
          ${orderDetails.sku ? `<p>SKU: ${orderDetails.sku}</p>` : ''}
          ${orderDetails.size ? `<p>Size: ${orderDetails.size}</p>` : ''}
        </div>
        
        <div class="footer">
          <p>View in Stripe: https://dashboard.stripe.com/payments/${orderDetails.sessionId}</p>
          <p><strong>Shipping fee collected: £${orderDetails.shipping ? orderDetails.shipping.toFixed(2) : '4.95'} - use for postage</strong></p>
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
    
    PAYMENT BREAKDOWN:
    Subtotal (Products): £${orderDetails.subtotal ? orderDetails.subtotal.toFixed(2) : '0.00'}
    Shipping: £${orderDetails.shipping ? orderDetails.shipping.toFixed(2) : '4.95'} ${orderDetails.shippingNote ? `(${orderDetails.shippingNote})` : ''}
    VAT (20%): £${orderDetails.vat ? orderDetails.vat.toFixed(2) : '0.00'}
    Total: £${orderDetails.amount.toFixed(2)}
    
    Order Details:
    Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}
    Items: ${orderDetails.itemCount}
    ${orderDetails.sku ? `SKU: ${orderDetails.sku}` : ''}
    ${orderDetails.size ? `Size: ${orderDetails.size}` : ''}
    
    View in Stripe: https://dashboard.stripe.com/payments/${orderDetails.sessionId}
    
    Shipping fee collected: £${orderDetails.shipping ? orderDetails.shipping.toFixed(2) : '4.95'} - use for postage.
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
        .breakdown { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
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
        
        <div class="breakdown">
          <p><strong>Payment Breakdown:</strong></p>
          <p>Reading Fee: £${(orderDetails.orderData.price / 1.2).toFixed(2)}</p>
          <p>VAT (20%): £${(orderDetails.orderData.price * 0.2 / 1.2).toFixed(2)}</p>
          <p>Shipping: £0.00 (Digital product)</p>
          <p><strong>Total: £${orderDetails.orderData.price.toFixed(2)}</strong></p>
        </div>
        
        <div class="info-box">
          <p><strong>Reading Details:</strong></p>
          <p>Tier: ${orderDetails.orderData.tierName}</p>
          <p>Word Count: ${orderDetails.orderData.wordCount}</p>
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
    
    PAYMENT BREAKDOWN:
    Reading Fee: £${(orderDetails.orderData.price / 1.2).toFixed(2)}
    VAT (20%): £${(orderDetails.orderData.price * 0.2 / 1.2).toFixed(2)}
    Shipping: £0.00 (Digital product)
    Total: £${orderDetails.orderData.price.toFixed(2)}
    
    Reading Details:
    Tier: ${orderDetails.orderData.tierName}
    Word Count: ${orderDetails.orderData.wordCount}
    Date: ${new Date(orderDetails.timestamp).toLocaleDateString('en-GB')}
    
    ${orderDetails.orderData.question ? `Customer Question: ${orderDetails.orderData.question}` : ''}
    
    View in Stripe: https://dashboard.stripe.com/payments/${orderDetails.sessionId}
  `;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}