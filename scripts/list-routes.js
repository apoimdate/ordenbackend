#!/usr/bin/env node

const axios = require('axios');

// Try to get route information by testing common endpoints
const routesToTest = [
  '/api/auth/login',
  '/api/users/profile', 
  '/api/products',
  '/api/orders',
  '/api/payments',
  '/api/sellers',
  '/api/categories',
  '/api/analytics',
  '/api/cart',
  '/api/reviews',
  '/api/coupons',
  '/api/notifications',
  '/api/support',
  '/api/returns',
  '/api/cms',
  '/api/loyalty',
  '/api/fraud',
  '/api/webhooks',
  '/api/commissions',
  '/api/chat',
  '/api/customs',
  '/api/pickup',
  '/api/shipping',
  '/api/admin/commissions'
];

async function checkRoute(path) {
  try {
    // Use appropriate method for different routes
    const method = path.includes('/login') ? 'post' : 'get';
    const config = {
      method,
      url: `http://localhost:3000${path}`,
      validateStatus: () => true,
      timeout: 5000
    };
    
    if (method === 'post') {
      config.data = { test: 'data' };
      config.headers = { 'Content-Type': 'application/json' };
    }
    
    const response = await axios(config);
    
    return {
      path,
      status: response.status,
      registered: response.status !== 404,
      error: response.status === 404 ? 'NOT_FOUND' : 
              response.status === 500 ? 'INTERNAL_ERROR' :
              response.status === 401 ? 'UNAUTHORIZED' :
              response.status === 400 ? 'BAD_REQUEST' : 'OTHER'
    };
  } catch (error) {
    return {
      path,
      status: 'ERROR',
      registered: false,
      error: error.message
    };
  }
}

async function listRoutes() {
  console.log('🔍 Checking Route Registration Status\n');
  console.log('━'.repeat(60));
  
  const results = [];
  
  for (const path of routesToTest) {
    const result = await checkRoute(path);
    results.push(result);
    
    const icon = result.registered ? '✅' : '❌';
    const status = result.status.toString().padEnd(4);
    const pathText = result.path.padEnd(25);
    
    console.log(`${icon} ${status} | ${pathText} | ${result.error}`);
  }
  
  console.log('━'.repeat(60));
  
  const registered = results.filter(r => r.registered);
  const notRegistered = results.filter(r => !r.registered);
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Registered: ${registered.length}`);
  console.log(`   ❌ Not Registered: ${notRegistered.length}`);
  console.log(`   📈 Registration Rate: ${((registered.length / results.length) * 100).toFixed(1)}%`);
  
  if (notRegistered.length > 0) {
    console.log(`\n❌ Missing Routes:`);
    notRegistered.forEach(route => {
      console.log(`   ${route.path}`);
    });
  }
  
  return results;
}

if (require.main === module) {
  listRoutes().catch(console.error);
}

module.exports = { listRoutes };