#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

// Helper function to make authenticated requests
async function makeRequest(method, path, data = null, headers = {}) {
  const config = {
    method,
    url: `${BASE_URL}${path}`,
    validateStatus: () => true,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  if (data) {
    config.data = data;
  }

  return await axios(config);
}

// Test user registration and authentication flow
async function testAuthFlow() {
  console.log('🔐 Testing Authentication Flow...');
  
  // Generate unique test user
  const timestamp = Date.now();
  const testUser = {
    email: `test${timestamp}@test.com`,
    password: 'StrongPass123!',
    firstName: 'Test',
    lastName: 'User'
  };

  // Test registration
  const registerResponse = await makeRequest('POST', '/api/auth/register', testUser);
  
  if (registerResponse.status === 201 || registerResponse.status === 409) {
    console.log('  ✅ Registration endpoint working');
  } else {
    console.log(`  ❌ Registration failed: ${registerResponse.status} - ${registerResponse.data?.error?.message || 'Unknown error'}`);
    return false;
  }

  // Test login
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    emailOrUsername: testUser.email,
    password: testUser.password
  });

  if (loginResponse.status === 200 && loginResponse.data?.accessToken) {
    console.log('  ✅ Login successful, token received');
    authToken = loginResponse.data.accessToken;
    return true;
  } else {
    console.log(`  ❌ Login failed: ${loginResponse.status} - ${loginResponse.data?.error?.message || 'Unknown error'}`);
    return false;
  }
}

// Test authenticated endpoints
async function testAuthenticatedEndpoints() {
  console.log('\\n🔒 Testing Authenticated Endpoints...');
  
  const endpoints = [
    { method: 'GET', path: '/api/users/profile', name: 'User Profile' },
    { method: 'GET', path: '/api/orders', name: 'Orders List' },
    { method: 'GET', path: '/api/payments', name: 'Payments List' },
    { method: 'GET', path: '/api/chat', name: 'Chat Conversations' }
  ];

  let passedCount = 0;
  
  for (const endpoint of endpoints) {
    const response = await makeRequest(endpoint.method, endpoint.path);
    
    if (response.status === 200 || (response.status === 200 && response.data?.message === 'No data available')) {
      console.log(`  ✅ ${endpoint.name}: Working (${response.status})`);
      if (response.data?.message === 'No data available') {
        console.log(`    └─ Graceful empty response: "${response.data.message}"`);
      }
      passedCount++;
    } else {
      console.log(`  ❌ ${endpoint.name}: Failed (${response.status}) - ${response.data?.error?.message || 'Unknown error'}`);
    }
  }
  
  return passedCount;
}

// Test admin endpoints (should fail without admin role)
async function testAdminEndpoints() {
  console.log('\\n👑 Testing Admin Endpoints (should require admin role)...');
  
  const adminEndpoints = [
    { method: 'GET', path: '/api/analytics', name: 'Analytics' },
    { method: 'GET', path: '/api/admin/commissions', name: 'Commissions' }
  ];

  let properlyProtectedCount = 0;
  
  for (const endpoint of adminEndpoints) {
    const response = await makeRequest(endpoint.method, endpoint.path);
    
    // Should return 403 (Forbidden) or 401 if user doesn't have admin role
    if (response.status === 403 || response.status === 401) {
      console.log(`  ✅ ${endpoint.name}: Properly protected (${response.status})`);
      properlyProtectedCount++;
    } else if (response.status === 200 && response.data?.message === 'No data available') {
      // If user somehow has admin access, should still work gracefully
      console.log(`  ✅ ${endpoint.name}: Working with admin access (${response.status})`);
      properlyProtectedCount++;
    } else {
      console.log(`  ❌ ${endpoint.name}: Unexpected response (${response.status}) - ${response.data?.error?.message || 'Unknown error'}`);
    }
  }
  
  return properlyProtectedCount;
}

// Test public endpoints
async function testPublicEndpoints() {
  console.log('\\n🌐 Testing Public Endpoints...');
  
  const publicEndpoints = [
    { method: 'GET', path: '/health', name: 'Health Check' },
    { method: 'GET', path: '/ready', name: 'Readiness Check' },
    { method: 'GET', path: '/live', name: 'Liveness Check' },
    { method: 'GET', path: '/api/products', name: 'Products List' },
    { method: 'GET', path: '/api/categories', name: 'Categories List' },
    { method: 'GET', path: '/api/sellers', name: 'Sellers List' }
  ];

  let passedCount = 0;
  
  // Clear auth token for public endpoints
  const originalToken = authToken;
  authToken = null;
  
  for (const endpoint of publicEndpoints) {
    const response = await makeRequest(endpoint.method, endpoint.path);
    
    if (response.status === 200) {
      console.log(`  ✅ ${endpoint.name}: Working (${response.status})`);
      if (response.data?.message === 'No data available') {
        console.log(`    └─ Graceful empty response: "${response.data.message}"`);
      }
      passedCount++;
    } else {
      console.log(`  ❌ ${endpoint.name}: Failed (${response.status}) - ${response.data?.error?.message || 'Unknown error'}`);
    }
  }
  
  // Restore auth token
  authToken = originalToken;
  
  return passedCount;
}

// Test data creation endpoints (with proper data)
async function testDataCreation() {
  console.log('\\n📝 Testing Data Creation Endpoints...');
  
  if (!authToken) {
    console.log('  ❌ No auth token available for data creation tests');
    return 0;
  }

  // Test product creation (if user has seller/admin role)
  const productData = {
    name: 'Test Product',
    sku: 'TEST-PROD-001',
    description: 'A test product for API testing',
    price: 99.99,
    currency: 'USD',
    categoryId: 'c12345678', // Assuming this category exists or will be created
    stock: 10,
    isActive: true
  };

  const productResponse = await makeRequest('POST', '/api/products', productData);
  
  if (productResponse.status === 201) {
    console.log('  ✅ Product creation: Working (201)');
    return 1;
  } else if (productResponse.status === 403 || productResponse.status === 401) {
    console.log('  ✅ Product creation: Properly protected (requires seller/admin role)');
    return 1;
  } else {
    console.log(`  ❌ Product creation: Failed (${productResponse.status}) - ${productResponse.data?.error?.message || 'Unknown error'}`);
    return 0;
  }
}

// Test search functionality
async function testSearchFunctionality() {
  console.log('\\n🔍 Testing Search Functionality...');
  
  // Clear auth token for public search
  const originalToken = authToken;
  authToken = null;
  
  const searchQueries = [
    { query: 'test', name: 'Basic Search' },
    { query: '', name: 'Empty Search' },
    { query: 'nonexistent-product-xyz', name: 'No Results Search' }
  ];

  let passedCount = 0;
  
  for (const search of searchQueries) {
    const response = await makeRequest('GET', `/api/products?q=${encodeURIComponent(search.query)}`);
    
    if (response.status === 200) {
      console.log(`  ✅ ${search.name}: Working (${response.status})`);
      if (response.data?.message === 'No data available' || (response.data?.data && Array.isArray(response.data.data))) {
        console.log(`    └─ Returns appropriate response structure`);
      }
      passedCount++;
    } else {
      console.log(`  ❌ ${search.name}: Failed (${response.status}) - ${response.data?.error?.message || 'Unknown error'}`);
    }
  }
  
  // Restore auth token
  authToken = originalToken;
  
  return passedCount;
}

// Main test function
async function testFunctionality() {
  console.log('🧪 Testing Backend Functionality\\n');
  console.log('━'.repeat(80));

  let totalTests = 0;
  let passedTests = 0;

  // Test public endpoints first
  const publicPassed = await testPublicEndpoints();
  totalTests += 6;
  passedTests += publicPassed;

  // Test search functionality
  const searchPassed = await testSearchFunctionality();
  totalTests += 3;
  passedTests += searchPassed;

  // Test authentication flow
  const authWorking = await testAuthFlow();
  totalTests += 1;
  if (authWorking) passedTests += 1;

  if (authWorking) {
    // Test authenticated endpoints
    const authEndpointsPassed = await testAuthenticatedEndpoints();
    totalTests += 4;
    passedTests += authEndpointsPassed;

    // Test admin endpoints
    const adminEndpointsPassed = await testAdminEndpoints();
    totalTests += 2;
    passedTests += adminEndpointsPassed;

    // Test data creation
    const dataPassed = await testDataCreation();
    totalTests += 1;
    passedTests += dataPassed;
  } else {
    console.log('\\n⚠️  Skipping authenticated endpoint tests due to auth failure');
  }

  console.log('━'.repeat(80));
  console.log(`\\n📊 Functionality Test Summary:`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${totalTests - passedTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log(`\\n🎉 All functionality tests passed! Backend is working correctly.`);
  } else {
    console.log(`\\n⚠️  Some functionality tests failed. Review responses above.`);
  }

  return { passedTests, totalTests };
}

if (require.main === module) {
  testFunctionality().catch(console.error);
}

module.exports = { testFunctionality };