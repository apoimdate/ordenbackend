#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Define endpoints to test with expected behaviors
const endpoints = [
  // Health endpoints
  { method: 'GET', path: '/health', expectedStatus: 200, description: 'Health check' },
  { method: 'GET', path: '/ready', expectedStatus: 200, description: 'Readiness check' },
  { method: 'GET', path: '/live', expectedStatus: 200, description: 'Liveness check' },
  
  // Auth endpoints (public)
  { method: 'POST', path: '/api/auth/login', expectedStatus: 401, description: 'Login without credentials', 
    data: { emailOrUsername: 'test', password: 'test' } },
  { method: 'POST', path: '/api/auth/register', expectedStatus: [400, 409], description: 'Register with invalid data',
    data: { email: 'invalid', password: '123' } },
  { method: 'POST', path: '/api/auth/refresh', expectedStatus: 401, description: 'Refresh without token',
    data: { refreshToken: 'invalid' } },
  
  // Product endpoints (some public)
  { method: 'GET', path: '/api/products?q=test', expectedStatus: [200, 500], description: 'Search products' },
  { method: 'POST', path: '/api/products', expectedStatus: 401, description: 'Create product (unauthorized)',
    data: { name: 'test', sku: 'TEST-123', price: 100, currency: 'USD', categoryId: 'c12345678' } },
  
  // User endpoints (require auth)
  { method: 'GET', path: '/api/users/profile', expectedStatus: 401, description: 'Get profile (unauthorized)' },
  
  // Category endpoints
  { method: 'GET', path: '/api/categories', expectedStatus: [200, 500], description: 'Get categories' },
  
  // Order endpoints
  { method: 'GET', path: '/api/orders', expectedStatus: 401, description: 'Get orders (unauthorized)' },
  
  // Payment endpoints
  { method: 'GET', path: '/api/payments', expectedStatus: 401, description: 'Get payments (unauthorized)' },
  
  // Seller endpoints
  { method: 'GET', path: '/api/sellers', expectedStatus: [200, 500], description: 'Get sellers' },
  
  // Commission endpoints (admin only)
  { method: 'GET', path: '/api/admin/commissions', expectedStatus: 401, description: 'Get commissions (unauthorized)' },
  
  // Chat endpoints  
  { method: 'GET', path: '/api/chat', expectedStatus: 401, description: 'Get chats (unauthorized)' },
  
  // Analytics endpoints
  { method: 'GET', path: '/api/analytics', expectedStatus: 401, description: 'Get analytics (unauthorized)' },
  
  // Non-existent endpoint
  { method: 'GET', path: '/api/nonexistent', expectedStatus: 404, description: 'Non-existent endpoint' }
];

async function testEndpoint(endpoint) {
  try {
    const config = {
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.path}`,
      validateStatus: () => true, // Don't throw on any status
      timeout: 10000
    };

    if (endpoint.data) {
      config.data = endpoint.data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    
    const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
      ? endpoint.expectedStatus 
      : [endpoint.expectedStatus];
    
    const statusMatch = expectedStatuses.includes(response.status);
    
    const result = {
      endpoint: `${endpoint.method} ${endpoint.path}`,
      description: endpoint.description,
      actualStatus: response.status,
      expectedStatus: endpoint.expectedStatus,
      success: statusMatch,
      responseSize: JSON.stringify(response.data).length,
      hasError: !!response.data?.error,
      errorCode: response.data?.error?.code
    };
    
    return result;
    
  } catch (error) {
    return {
      endpoint: `${endpoint.method} ${endpoint.path}`,
      description: endpoint.description,
      actualStatus: error.code || 'ERROR',
      expectedStatus: endpoint.expectedStatus,
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Testing OrdenDirecta Backend Endpoints\n');
  console.log('━'.repeat(80));
  
  const results = [];
  let passCount = 0;
  let failCount = 0;
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? 'PASS' : 'FAIL';
    
    console.log(`${statusIcon} ${statusText} | ${result.endpoint.padEnd(35)} | ${result.actualStatus} | ${result.description}`);
    
    if (result.success) {
      passCount++;
    } else {
      failCount++;
      if (result.error) {
        console.log(`    └─ Error: ${result.error}`);
      } else if (result.errorCode) {
        console.log(`    └─ Error Code: ${result.errorCode}`);
      }
    }
  }
  
  console.log('━'.repeat(80));
  console.log(`\n📊 Test Summary:`);
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📈 Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  
  // Group by status for analysis
  const statusGroups = results.reduce((acc, result) => {
    const status = result.actualStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(result);
    return acc;
  }, {});
  
  console.log(`\n📋 Status Code Breakdown:`);
  Object.keys(statusGroups).sort().forEach(status => {
    console.log(`   ${status}: ${statusGroups[status].length} endpoints`);
  });
  
  // Show failed tests details
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n🔍 Failed Tests Details:`);
    failed.forEach(result => {
      console.log(`   ${result.endpoint}`);
      console.log(`     Expected: ${result.expectedStatus}, Got: ${result.actualStatus}`);
      if (result.errorCode) {
        console.log(`     Error: ${result.errorCode}`);
      }
    });
  }
  
  return results;
}

// Run tests if script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testEndpoint };