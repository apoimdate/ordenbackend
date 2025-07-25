#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of routes that should be registered
const expectedRoutes = [
  { file: 'auth.routes.ts', export: 'named', function: 'authRoutes', prefix: '/api/auth' },
  { file: 'user.routes.ts', export: 'named', function: 'userRoutes', prefix: '/api/users' },
  { file: 'product.routes.ts', export: 'named', function: 'productRoutes', prefix: '/api/products' },
  { file: 'order.routes.ts', export: 'default', function: 'orderRoutes', prefix: '/api/orders' },
  { file: 'payment.routes.ts', export: 'default', function: 'paymentRoutes', prefix: '/api/payments' },
  { file: 'seller.routes.ts', export: 'default', function: 'sellerRoutes', prefix: '/api/sellers' },
  { file: 'shipping.routes.ts', export: 'default', function: 'shippingRoutes', prefix: '/api/shipping' },
  { file: 'category.routes.ts', export: 'default', function: 'categoryRoutes', prefix: '/api/categories' },
  { file: 'analytics.routes.ts', export: 'default', function: 'analyticsRoutes', prefix: '/api/analytics' },
  { file: 'cart.routes.ts', export: 'default', function: 'cartRoutes', prefix: '/api/cart' },
  { file: 'review.routes.ts', export: 'default', function: 'reviewRoutes', prefix: '/api/reviews' },
  { file: 'coupon.routes.ts', export: 'default', function: 'couponRoutes', prefix: '/api/coupons' },
  { file: 'notification.routes.ts', export: 'default', function: 'notificationRoutes', prefix: '/api/notifications' },
  { file: 'support.routes.ts', export: 'default', function: 'supportRoutes', prefix: '/api/support' },
  { file: 'return.routes.ts', export: 'default', function: 'returnRoutes', prefix: '/api/returns' },
  { file: 'cms.routes.ts', export: 'default', function: 'cmsRoutes', prefix: '/api/cms' },
  { file: 'loyalty.routes.ts', export: 'default', function: 'loyaltyRoutes', prefix: '/api/loyalty' },
  { file: 'fraud-advanced.routes.ts', export: 'default', function: 'fraudAdvancedRoutes', prefix: '/api/fraud' },
  { file: 'webhook.routes.ts', export: 'default', function: 'webhookRoutes', prefix: '/api/webhooks' },
  { file: 'commission.routes.ts', export: 'named', function: 'commissionRoutes', prefix: '/api' },
  { file: 'chat.routes.ts', export: 'named', function: 'chatRoutes', prefix: '/api' },
  { file: 'customs.routes.ts', export: 'named', function: 'customsRoutes', prefix: '/api' },
  { file: 'pickup.routes.ts', export: 'named', function: 'pickupRoutes', prefix: '/api' }
];

function checkFileExists(routesDir, filename) {
  const filePath = path.join(routesDir, filename);
  return fs.existsSync(filePath);
}

function checkExportPattern(routesDir, filename, exportType, functionName) {
  const filePath = path.join(routesDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return { exists: false, error: 'File not found' };
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (exportType === 'default') {
      const hasDefault = content.includes('export default');
      const hasFunction = content.includes(`${functionName}:`);
      return {
        exists: true,
        hasCorrectExport: hasDefault,
        hasFunction: hasFunction,
        content: content.slice(-200) // Last 200 chars for debugging
      };
    } else {
      const hasNamed = content.includes(`export async function ${functionName}`);
      return {
        exists: true,
        hasCorrectExport: hasNamed,
        hasFunction: hasNamed,
        content: content.slice(0, 200) // First 200 chars for debugging
      };
    }
  } catch (error) {
    return { exists: true, error: error.message };
  }
}

function checkForZodUsage(routesDir, filename) {
  const filePath = path.join(routesDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return { hasZod: false };
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasZodImport = content.includes("import { z }") || content.includes("from 'zod'");
    const hasZodUsage = content.includes("z.") && (content.includes("z.object") || content.includes("z.string"));
    
    return {
      hasZod: hasZodImport || hasZodUsage,
      hasZodImport,
      hasZodUsage
    };
  } catch (error) {
    return { hasZod: false, error: error.message };
  }
}

async function diagnoseRoutes() {
  console.log('🔍 Diagnosing Route Registration Issues\n');
  console.log('━'.repeat(80));
  
  const routesDir = path.join(__dirname, '..', 'src', 'routes');
  const results = [];
  
  for (const route of expectedRoutes) {
    const fileCheck = checkFileExists(routesDir, route.file);
    const exportCheck = checkExportPattern(routesDir, route.file, route.export, route.function);
    const zodCheck = checkForZodUsage(routesDir, route.file);
    
    const result = {
      file: route.file,
      prefix: route.prefix,
      export: route.export,
      function: route.function,
      fileExists: fileCheck,
      exportCorrect: exportCheck.hasCorrectExport,
      hasFunction: exportCheck.hasFunction,
      hasZod: zodCheck.hasZod,
      issues: []
    };
    
    // Identify issues
    if (!fileCheck) {
      result.issues.push('FILE_MISSING');
    }
    if (!exportCheck.hasCorrectExport) {
      result.issues.push('EXPORT_PATTERN_WRONG');
    }
    if (!exportCheck.hasFunction) {
      result.issues.push('FUNCTION_MISSING');
    }
    if (zodCheck.hasZod) {
      result.issues.push('USES_ZOD_SCHEMAS');
    }
    if (exportCheck.error) {
      result.issues.push(`READ_ERROR: ${exportCheck.error}`);
    }
    
    results.push(result);
    
    // Display result
    const status = result.issues.length === 0 ? '✅ OK' : '❌ ISSUES';
    const issueCount = result.issues.length;
    const zodIcon = result.hasZod ? '⚠️Z' : '✅';
    
    console.log(`${status} | ${route.file.padEnd(25)} | ${route.export.padEnd(7)} | ${zodIcon} | ${issueCount} issues`);
    
    if (result.issues.length > 0) {
      result.issues.forEach(issue => {
        console.log(`    └─ ${issue}`);
      });
    }
  }
  
  console.log('━'.repeat(80));
  
  // Summary
  const totalRoutes = results.length;
  const workingRoutes = results.filter(r => r.issues.length === 0).length;
  const brokenRoutes = totalRoutes - workingRoutes;
  const zodRoutes = results.filter(r => r.hasZod).length;
  
  console.log(`\n📊 Diagnosis Summary:`);
  console.log(`   📁 Total Routes: ${totalRoutes}`);
  console.log(`   ✅ Working: ${workingRoutes}`);
  console.log(`   ❌ Broken: ${brokenRoutes}`);
  console.log(`   ⚠️  Using Zod: ${zodRoutes}`);
  console.log(`   📈 Success Rate: ${((workingRoutes / totalRoutes) * 100).toFixed(1)}%`);
  
  // Group issues
  const issueTypes = {};
  results.forEach(result => {
    result.issues.forEach(issue => {
      if (!issueTypes[issue]) issueTypes[issue] = [];
      issueTypes[issue].push(result.file);
    });
  });
  
  console.log(`\n🔍 Issue Breakdown:`);
  Object.keys(issueTypes).forEach(issue => {
    console.log(`   ${issue}: ${issueTypes[issue].length} routes`);
    if (issueTypes[issue].length <= 3) {
      issueTypes[issue].forEach(file => console.log(`     - ${file}`));
    }
  });
  
  // Recommendations
  console.log(`\n💡 Recommendations:`);
  if (zodRoutes > 0) {
    console.log(`   1. Convert ${zodRoutes} routes from Zod to JSON Schema`);
  }
  if (issueTypes['EXPORT_PATTERN_WRONG']) {
    console.log(`   2. Fix export patterns in ${issueTypes['EXPORT_PATTERN_WRONG'].length} routes`);
  }
  if (issueTypes['FUNCTION_MISSING']) {
    console.log(`   3. Add missing route functions in ${issueTypes['FUNCTION_MISSING'].length} routes`);
  }
  
  return results;
}

if (require.main === module) {
  diagnoseRoutes().catch(console.error);
}

module.exports = { diagnoseRoutes };