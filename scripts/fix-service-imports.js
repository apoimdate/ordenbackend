#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Service mapping corrections
const serviceCorrections = [
  { wrong: '@services/paymentservice.service', correct: '@services/payment.service', varName: 'paymentService' },
  { wrong: '@services/shippingservice.service', correct: '@services/shipping.service', varName: 'shippingService' },
  { wrong: '@services/categoryservice.service', correct: '@services/category.service', varName: 'categoryService' },
  { wrong: '@services/analyticsservice.service', correct: '@services/analytics.service', varName: 'analyticsService' },
  { wrong: '@services/cartservice.service', correct: '@services/cart.service', varName: 'cartService' },
  { wrong: '@services/reviewservice.service', correct: '@services/review.service', varName: 'reviewService' },
  { wrong: '@services/couponservice.service', correct: '@services/coupon.service', varName: 'couponService' },
  { wrong: '@services/supportservice.service', correct: '@services/support.service', varName: 'supportService' },
  { wrong: '@services/returnservice.service', correct: '@services/return.service', varName: 'returnService' },
  { wrong: '@services/cmsservice.service', correct: '@services/cms.service', varName: 'cmsService' },
  { wrong: '@services/loyaltyservice.service', correct: '@services/loyalty.service', varName: 'loyaltyService' },
  { wrong: '@services/fraudadvancedservice.service', correct: '@services/fraud-advanced.service', varName: 'fraudAdvancedService' },
  { wrong: '@services/webhookservice.service', correct: '@services/webhook.service', varName: 'webhookService' }
];

async function fixServiceImports() {
  console.log('🔧 Fixing Service Import Paths\n');
  console.log('━'.repeat(50));
  
  const routesDir = path.join(__dirname, '..', 'src', 'routes');
  let fixedCount = 0;
  
  // Get all route files
  const files = fs.readdirSync(routesDir).filter(file => 
    file.endsWith('.routes.ts') && !file.includes('.backup')
  );
  
  for (const file of files) {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Apply corrections
    for (const correction of serviceCorrections) {
      if (content.includes(correction.wrong)) {
        console.log(`Fixing ${file}: ${correction.wrong} → ${correction.correct}`);
        
        // Fix import
        content = content.replace(correction.wrong, correction.correct);
        
        // Fix variable names (e.g., paymentservice → paymentService)
        const wrongVar = correction.varName.toLowerCase();
        content = content.replace(new RegExp(`\\b${wrongVar}\\b`, 'g'), correction.varName);
        
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      fixedCount++;
    }
  }
  
  console.log('━'.repeat(50));
  console.log(`\n📊 Fix Summary:`);
  console.log(`   ✅ Files Fixed: ${fixedCount}`);
  console.log(`   📁 Total Files: ${files.length}`);
  
  if (fixedCount > 0) {
    console.log(`\n💡 Next step: Restart server with npm run dev`);
  }
  
  return fixedCount;
}

if (require.main === module) {
  fixServiceImports().catch(console.error);
}

module.exports = { fixServiceImports };