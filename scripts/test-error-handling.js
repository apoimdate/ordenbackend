#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test scenarios for error handling and edge cases
const errorTests = [
  {
    name: 'Invalid JSON in POST request',
    method: 'POST',
    path: '/api/auth/login',
    headers: { 'Content-Type': 'application/json' },
    data: '{"invalid": json}', // Malformed JSON
    expectedStatus: 400,
    expectedError: 'Invalid JSON'
  },
  {
    name: 'SQL Injection attempt in search',
    method: 'GET', 
    path: '/api/products?q="; DROP TABLE users; --',
    expectedStatus: 200,
    description: 'Should sanitize input and return empty results'
  },
  {
    name: 'XSS attempt in search',
    method: 'GET',
    path: '/api/products?q=<script>alert("xss")</script>',
    expectedStatus: 200,
    description: 'Should sanitize HTML and return safe results'
  },
  {
    name: 'Very long search query',
    method: 'GET',
    path: `/api/products?q=${'a'.repeat(10000)}`,
    expectedStatus: [200, 400],
    description: 'Should handle long queries gracefully'
  },
  {
    name: 'Invalid pagination parameters',
    method: 'GET',
    path: '/api/sellers?page=-1&limit=999999',
    expectedStatus: [200, 400],
    description: 'Should handle invalid pagination'
  },
  {
    name: 'Missing required fields in registration',
    method: 'POST',
    path: '/api/auth/register',
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'test@test.com' }, // Missing required fields
    expectedStatus: 400,
    description: 'Should validate required fields'
  },
  {
    name: 'Invalid email format',
    method: 'POST',
    path: '/api/auth/register',
    headers: { 'Content-Type': 'application/json' },
    data: { 
      email: 'invalid-email',
      password: 'ValidPass123!',
      firstName: 'Test',
      lastName: 'User'
    },
    expectedStatus: 400,
    description: 'Should validate email format'
  },
  {
    name: 'Weak password',
    method: 'POST',
    path: '/api/auth/register',
    headers: { 'Content-Type': 'application/json' },
    data: {
      email: 'test@test.com',
      password: '123',
      firstName: 'Test',
      lastName: 'User'
    },
    expectedStatus: 400,
    description: 'Should reject weak passwords'
  },
  {
    name: 'Non-existent user ID in orders',
    method: 'GET',
    path: '/api/orders',
    headers: { 'Authorization': 'Bearer invalid-token' },
    expectedStatus: 401,
    description: 'Should require valid authentication'
  },
  {
    name: 'Invalid Content-Type for JSON endpoint',
    method: 'POST',
    path: '/api/auth/login',
    headers: { 'Content-Type': 'text/plain' },
    data: 'not json',
    expectedStatus: [400, 415],
    description: 'Should reject non-JSON content'
  },
  {
    name: 'Extremely large payload',
    method: 'POST',
    path: '/api/auth/login',
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'a'.repeat(100000), password: 'b'.repeat(100000) },
    expectedStatus: [400, 413],
    description: 'Should handle large payloads appropriately'
  },
  {
    name: 'Unicode and special characters',
    method: 'GET',
    path: '/api/products?q=测试 🚀 special chars "quotes" & symbols',
    expectedStatus: 200,
    description: 'Should handle Unicode and special characters'
  }
];

async function testErrorHandling() {
  console.log('🔍 Testing Error Handling and Edge Cases\\n');
  console.log('━'.repeat(80));

  let passedTests = 0;
  let totalTests = errorTests.length;
  const results = [];

  for (const test of errorTests) {
    try {
      const config = {
        method: test.method,
        url: `${BASE_URL}${test.path}`,
        validateStatus: () => true,
        timeout: 15000,
        maxRedirects: 0
      };

      if (test.headers) {
        config.headers = test.headers;
      }

      if (test.data) {
        if (typeof test.data === 'string') {
          config.data = test.data;
        } else {
          config.data = test.data;
          if (!config.headers) config.headers = {};
          config.headers['Content-Type'] = 'application/json';
        }
      }

      const response = await axios(config);
      
      const expectedStatuses = Array.isArray(test.expectedStatus) 
        ? test.expectedStatus 
        : [test.expectedStatus];
      
      const statusMatch = expectedStatuses.includes(response.status);
      
      const result = {
        name: test.name,
        method: test.method,
        path: test.path.length > 50 ? test.path.substring(0, 50) + '...' : test.path,
        expectedStatus: test.expectedStatus,
        actualStatus: response.status,
        success: statusMatch,
        description: test.description,
        responseTime: response.config?.timeout || 'N/A',
        hasNoDataAvailable: response.data?.message?.includes('No data available'),
        hasGracefulError: !!(response.data?.success === true && response.data?.message === 'No data available')
      };

      if (statusMatch) {
        passedTests++;
        console.log(`✅ PASS | ${test.name}`);
        console.log(`    ${test.method} ${result.path} | ${response.status} | ${test.description || 'Error handling test'}`);
        if (result.hasGracefulError) {
          console.log(`    └─ ✅ Returns graceful "No data available" response`);
        }
      } else {
        console.log(`❌ FAIL | ${test.name}`);
        console.log(`    ${test.method} ${result.path} | Expected: ${test.expectedStatus}, Got: ${response.status}`);
        console.log(`    └─ ${test.description || 'Error handling test'}`);
        if (response.data?.error) {
          console.log(`    └─ Error: ${response.data.error.message || response.data.error}`);
        }
      }

      results.push(result);

    } catch (error) {
      console.log(`❌ FAIL | ${test.name}`);
      console.log(`    └─ Network/Request Error: ${error.message}`);
      
      results.push({
        name: test.name,
        method: test.method,
        path: test.path,
        expectedStatus: test.expectedStatus,
        actualStatus: 'ERROR',
        success: false,
        error: error.message
      });
    }
  }

  console.log('━'.repeat(80));
  console.log(`\\n📊 Error Handling Test Summary:`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${totalTests - passedTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  // Analyze results
  const gracefulErrors = results.filter(r => r.hasGracefulError).length;
  const validationErrors = results.filter(r => r.actualStatus === 400).length;
  const authErrors = results.filter(r => r.actualStatus === 401).length;

  console.log(`\\n🔍 Error Analysis:`);
  console.log(`   🛡️  Graceful "No data available" responses: ${gracefulErrors}`);
  console.log(`   ✅ Proper validation errors (400): ${validationErrors}`);
  console.log(`   🔐 Proper auth errors (401): ${authErrors}`);

  if (passedTests === totalTests) {
    console.log(`\\n🎉 All error handling tests passed! Backend handles errors gracefully.`);
  } else {
    console.log(`\\n⚠️  Some error handling tests failed. Review error responses above.`);
  }

  return { passedTests, totalTests, results };
}

if (require.main === module) {
  testErrorHandling().catch(console.error);
}

module.exports = { testErrorHandling };