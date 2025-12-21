// Printful Variant ID Fetcher
// Run this once to get all variant IDs for your products

const PRINTFUL_API_KEY = 'YOUR_PRINTFUL_API_KEY_HERE'; // Replace with your actual key
const STORE_ID = 17401941; // Your store ID from the URL

async function fetchPrintfulVariants() {
  console.log('🔄 Fetching Printful product data...');
  
  try {
    // 1. Get ALL sync products from your store
    const productsResponse = await fetch(`https://api.printful.com/store/products`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!productsResponse.ok) {
      const errorText = await productsResponse.text();
      throw new Error(`Failed to fetch products: ${errorText}`);
    }
    
    const productsData = await productsResponse.json();
    console.log(`✅ Found ${productsData.result.length} products in your store`);
    
    // 2. For each product, get its variants
    for (const product of productsData.result) {
      console.log(`\n📦 Product: ${product.name} (ID: ${product.id})`);
      console.log('─'.repeat(50));
      
      const variantsResponse = await fetch(`https://api.printful.com/store/products/${product.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (variantsResponse.ok) {
        const variantsData = await variantsResponse.json();
        const variants = variantsData.result.sync_variants || [];
        
        console.log(`Found ${variants.length} variants:`);
        
        // Display each variant with its details
        variants.forEach(variant => {
          console.log(`  └─ Variant ID: ${variant.id}`);
          console.log(`     Size: ${variant.size || 'N/A'}`);
          console.log(`     Color: ${variant.color || 'N/A'}`);
          console.log(`     Retail: $${variant.retail_price || 'N/A'}`);
          console.log(`     SKU: ${variant.sku || 'No SKU'}`);
          console.log('     ' + '─'.repeat(30));
        });
        
        // 3. Save to a JSON file for easy reference
        const productData = {
          product_id: product.id,
          product_name: product.name,
          sync_product_id: product.sync_product_id,
          variants: variants.map(v => ({
            variant_id: v.id,
            sync_variant_id: v.variant_id,
            size: v.size,
            color: v.color,
            retail_price: v.retail_price,
            sku: v.sku
          }))
        };
        
        // Save to file
        const fs = require('fs');
        fs.writeFileSync(
          `printful-variants-${product.id}.json`,
          JSON.stringify(productData, null, 2)
        );
        
        console.log(`💾 Saved to: printful-variants-${product.id}.json`);
        
      } else {
        console.log(`❌ Could not fetch variants for product ${product.id}`);
      }
    }
    
    // 3. ALTERNATIVE: Direct catalog search for "Unisex eco raglan hoodie"
    console.log('\n\n🔍 Searching for "Unisex eco raglan hoodie" in catalog...');
    
    const catalogResponse = await fetch('https://api.printful.com/products', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (catalogResponse.ok) {
      const catalogData = await catalogResponse.json();
      
      // Find hoodie in catalog
      const hoodieProduct = catalogData.result.find(p => 
        p.name.toLowerCase().includes('raglan hoodie') || 
        p.name.toLowerCase().includes('eco hoodie')
      );
      
      if (hoodieProduct) {
        console.log(`\n🎯 Found in catalog: ${hoodieProduct.name} (ID: ${hoodieProduct.id})`);
        console.log('All available sizes/colors:');
        
        // Get variants for this catalog product
        const productVariantsResponse = await fetch(`https://api.printful.com/products/${hoodieProduct.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (productVariantsResponse.ok) {
          const productVariantData = await productVariantsResponse.json();
          const productVariants = productVariantData.result.variants || [];
          
          console.log(`Total variants: ${productVariants.length}`);
          
          // Filter for Black color (most common)
          const blackVariants = productVariants.filter(v => 
            v.color && v.color.toLowerCase().includes('black')
          );
          
          console.log('\nBlack color variants:');
          blackVariants.forEach(variant => {
            console.log(`  ├─ Variant ID: ${variant.id}`);
            console.log(`  ├─ Size: ${variant.size}`);
            console.log(`  ├─ Color: ${variant.color}`);
            console.log(`  └─ Price: $${variant.price}`);
          });
          
          // Save this too
          const fs = require('fs');
          fs.writeFileSync(
            'catalog-hoodie-variants.json',
            JSON.stringify({
              product_id: hoodieProduct.id,
              product_name: hoodieProduct.name,
              all_variants: productVariants.map(v => ({
                variant_id: v.id,
                size: v.size,
                color: v.color,
                price: v.price
              })),
              black_variants: blackVariants.map(v => ({
                variant_id: v.id,
                size: v.size,
                color: v.color,
                price: v.price
              }))
            }, null, 2)
          );
          
          console.log('\n💾 Saved catalog data to: catalog-hoodie-variants.json');
        }
      } else {
        console.log('❌ Could not find hoodie in catalog');
      }
    }
    
    console.log('\n✨ Fetch complete! Check the generated JSON files.');
    console.log('\n📋 NEXT STEP:');
    console.log('1. Look at the JSON files for variant IDs');
    console.log('2. Match sizes to variant IDs');
    console.log('3. Update your routing.json with variant_map');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your Printful API key is correct');
    console.log('2. Check you have products in your Printful store');
    console.log('3. Try the catalog method instead');
  }
}

// Run the function
fetchPrintfulVariants();