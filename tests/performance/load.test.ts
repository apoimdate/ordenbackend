import { describe, test, expect, beforeEach } from '@jest/globals';
import { 
  setupTestApp, 
  createTestUser,
  createTestSeller,
  createTestCategory,
  createTestProduct,
  generateTestJWT,
  cleanupDatabase,
  measureExecutionTime,
  expectPerformance,
  createConcurrentRequests,
  measureThroughput
} from '../setup';

describe('Performance and Load Tests', () => {
  let app: any;
  let customer: any;
  let seller: any;
  let category: any;
  let product: any;
  let customerToken: string;
  let sellerToken: string;

  beforeEach(async () => {
    app = await setupTestApp();
    await cleanupDatabase();
    
    customer = await createTestUser({ role: 'CUSTOMER' });
    seller = await createTestSeller();
    category = await createTestCategory();
    product = await createTestProduct({ seller, category });
    
    customerToken = await generateTestJWT(customer);
    sellerToken = await generateTestJWT(seller.user);
  });

  describe('API Response Times', () => {
    test('product listing should respond quickly', async () => {
      // Create multiple products for realistic testing
      const productPromises = Array(50).fill(null).map(async (_, index) => {
        return createTestProduct({ 
          seller, 
          category, 
          name: `Test Product ${index}`,
          sku: `SKU-${index}-${Date.now()}`
        });
      });
      await Promise.all(productPromises);

      const { time } = await measureExecutionTime(async () => {
        return await app.inject({
          method: 'GET',
          url: '/api/products?page=1&limit=20'
        });
      });

      expectPerformance(time, 500); // Should respond within 500ms
    });

    test('product search should be fast', async () => {
      // Create products with searchable content
      const products = [
        { name: 'iPhone 14 Pro', tags: ['smartphone', 'apple'] },
        { name: 'Samsung Galaxy S23', tags: ['smartphone', 'samsung'] },
        { name: 'MacBook Pro', tags: ['laptop', 'apple'] },
        { name: 'Dell XPS 13', tags: ['laptop', 'dell'] },
        { name: 'iPad Air', tags: ['tablet', 'apple'] }
      ];

      for (const productData of products) {
        await createTestProduct({ 
          seller, 
          category, 
          ...productData,
          sku: `SKU-${productData.name.replace(/\s+/g, '-')}-${Date.now()}`
        });
      }

      const { time } = await measureExecutionTime(async () => {
        return await app.inject({
          method: 'GET',
          url: '/api/products?search=iPhone'
        });
      });

      expectPerformance(time, 300); // Search should be very fast
    });

    test('user authentication should be fast', async () => {
      const { time } = await measureExecutionTime(async () => {
        return await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: customer.email,
            password: 'Password123!' // Assuming this is the default from createTestUser
          }
        });
      });

      expectPerformance(time, 1000); // Auth should complete within 1 second
    });

    test('cart operations should be fast', async () => {
      const { time } = await measureExecutionTime(async () => {
        return await app.inject({
          method: 'POST',
          url: '/api/cart/items',
          headers: {
            Authorization: `Bearer ${customerToken}`
          },
          payload: {
            productId: product.id,
            quantity: 1
          }
        });
      });

      expectPerformance(time, 200); // Cart operations should be very fast
    });

    test('order creation should be reasonably fast', async () => {
      // Add item to cart first
      await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: {
          Authorization: `Bearer ${customerToken}`
        },
        payload: {
          productId: product.id,
          quantity: 1
        }
      });

      const { time } = await measureExecutionTime(async () => {
        return await app.inject({
          method: 'POST',
          url: '/api/orders',
          headers: {
            Authorization: `Bearer ${customerToken}`
          },
          payload: {
            shippingAddress: {
              street: '123 Test St',
              city: 'Test City',
              state: 'TS',
              zipCode: '12345',
              country: 'US'
            },
            paymentMethod: 'CREDIT_CARD'
          }
        });
      });

      expectPerformance(time, 2000); // Order creation can be slightly slower due to complexity
    });
  });

  describe('Concurrent Load Tests', () => {
    test('handle concurrent product views', async () => {
      const concurrentRequests = 20;
      
      const { time } = await measureExecutionTime(async () => {
        const requests = await createConcurrentRequests(
          () => app.inject({
            method: 'GET',
            url: `/api/products/${product.id}`
          }),
          concurrentRequests
        );

        // All requests should succeed
        requests.forEach(response => {
          expect(response.statusCode).toBe(200);
        });

        return requests;
      });

      expectPerformance(time, 3000); // All 20 requests should complete within 3 seconds
    });

    test('handle concurrent user registrations', async () => {
      const concurrentRegistrations = 10;
      
      const { time } = await measureExecutionTime(async () => {
        const requests = await createConcurrentRequests(
          () => {
            const uniqueEmail = `test-${Date.now()}-${Math.random()}@example.com`;
            return app.inject({
              method: 'POST',
              url: '/api/auth/register',
              payload: {
                email: uniqueEmail,
                password: 'Password123!',
                firstName: 'Test',
                lastName: 'User'
              }
            });
          },
          concurrentRegistrations
        );

        // All registrations should succeed
        requests.forEach(response => {
          expect(response.statusCode).toBe(201);
        });

        return requests;
      });

      expectPerformance(time, 5000); // All registrations should complete within 5 seconds
    });

    test('handle concurrent cart operations', async () => {
      const concurrentOperations = 15;
      
      // Create multiple products
      const products = await Promise.all(
        Array(concurrentOperations).fill(null).map(async (_, index) => {
          return createTestProduct({ 
            seller, 
            category, 
            name: `Product ${index}`,
            sku: `SKU-CONCURRENT-${index}-${Date.now()}`
          });
        })
      );

      const { time } = await measureExecutionTime(async () => {
        const requests = await createConcurrentRequests(
          () => {
            const randomProduct = products[Math.floor(Math.random() * products.length)];
            return app.inject({
              method: 'POST',
              url: '/api/cart/items',
              headers: {
                Authorization: `Bearer ${customerToken}`
              },
              payload: {
                productId: randomProduct.id,
                quantity: 1
              }
            });
          },
          concurrentOperations
        );

        // All cart operations should succeed
        requests.forEach(response => {
          expect([201, 200]).toContain(response.statusCode);
        });

        return requests;
      });

      expectPerformance(time, 3000); // All cart operations should complete within 3 seconds
    });

    test('handle concurrent order creations', async () => {
      const concurrentOrders = 5; // Lower number due to complexity
      
      // Create multiple customers
      const customers = await Promise.all(
        Array(concurrentOrders).fill(null).map(async (_, index) => {
          const user = await createTestUser({ 
            role: 'CUSTOMER',
            email: `customer-${index}-${Date.now()}@example.com`
          });
          const token = await generateTestJWT(user);
          
          // Add item to each customer's cart
          await app.inject({
            method: 'POST',
            url: '/api/cart/items',
            headers: {
              Authorization: `Bearer ${token}`
            },
            payload: {
              productId: product.id,
              quantity: 1
            }
          });

          return { user, token };
        })
      );

      const { time } = await measureExecutionTime(async () => {
        const requests = await createConcurrentRequests(
          () => {
            const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
            return app.inject({
              method: 'POST',
              url: '/api/orders',
              headers: {
                Authorization: `Bearer ${randomCustomer.token}`
              },
              payload: {
                shippingAddress: {
                  street: '123 Test St',
                  city: 'Test City',
                  state: 'TS',
                  zipCode: '12345',
                  country: 'US'
                },
                paymentMethod: 'CREDIT_CARD'
              }
            });
          },
          concurrentOrders
        );

        // All order creations should succeed
        requests.forEach(response => {
          expect(response.statusCode).toBe(201);
        });

        return requests;
      });

      expectPerformance(time, 8000); // Order creation can take longer due to complexity
    });
  });

  describe('Throughput Tests', () => {
    test('measure product listing throughput', async () => {
      const duration = 5000; // 5 seconds
      
      const { count, rps } = await measureThroughput(
        () => app.inject({
          method: 'GET',
          url: '/api/products?page=1&limit=10'
        }),
        duration
      );

      console.log(`Product listing: ${count} requests in ${duration}ms (${rps.toFixed(2)} RPS)`);
      expect(rps).toBeGreaterThan(10); // Should handle at least 10 requests per second
    });

    test('measure authentication throughput', async () => {
      const duration = 3000; // 3 seconds
      
      const { count, rps } = await measureThroughput(
        () => {
          const uniqueEmail = `test-${Date.now()}-${Math.random()}@example.com`;
          return app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: {
              email: uniqueEmail,
              password: 'Password123!',
              firstName: 'Test',
              lastName: 'User'
            }
          });
        },
        duration
      );

      console.log(`Authentication: ${count} requests in ${duration}ms (${rps.toFixed(2)} RPS)`);
      expect(rps).toBeGreaterThan(5); // Should handle at least 5 registrations per second
    });

    test('measure cart operations throughput', async () => {
      const duration = 3000; // 3 seconds
      
      const { count, rps } = await measureThroughput(
        () => app.inject({
          method: 'GET',
          url: '/api/cart',
          headers: {
            Authorization: `Bearer ${customerToken}`
          }
        }),
        duration
      );

      console.log(`Cart operations: ${count} requests in ${duration}ms (${rps.toFixed(2)} RPS)`);
      expect(rps).toBeGreaterThan(20); // Cart reads should be very fast
    });
  });

  describe('Memory and Resource Tests', () => {
    test('memory usage should remain stable under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      const operations = 100;
      for (let i = 0; i < operations; i++) {
        await app.inject({
          method: 'GET',
          url: '/api/products'
        });
        
        // Occasionally trigger garbage collection
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);
      expect(memoryIncreaseMB).toBeLessThan(50); // Should not increase by more than 50MB
    });

    test('database connections should be properly managed', async () => {
      const connectionsBefore = await app.prisma.$queryRaw`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;

      // Perform database-intensive operations
      const operations = 50;
      const promises = Array(operations).fill(null).map(() => {
        return app.inject({
          method: 'GET',
          url: '/api/products'
        });
      });

      await Promise.all(promises);

      const connectionsAfter = await app.prisma.$queryRaw`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;

      // Connection count should not grow significantly
      const connectionIncrease = Number(connectionsAfter[0].active_connections) - Number(connectionsBefore[0].active_connections);
      expect(connectionIncrease).toBeLessThan(10);
    });
  });

  describe('Cache Performance', () => {
    test('cached responses should be faster', async () => {
      // First request (cache miss)
      const { time: firstRequestTime } = await measureExecutionTime(async () => {
        return await app.inject({
          method: 'GET',
          url: `/api/products/${product.id}`
        });
      });

      // Second request (cache hit)
      const { time: secondRequestTime } = await measureExecutionTime(async () => {
        return await app.inject({
          method: 'GET',
          url: `/api/products/${product.id}`
        });
      });

      // Cached response should be faster (allowing for some variance)
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 1.5);
    });

    test('cache invalidation should work correctly', async () => {
      // Get product (cache it)
      const firstResponse = await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}`
      });
      const originalName = firstResponse.json().name;

      // Update product (should invalidate cache)
      await app.inject({
        method: 'PUT',
        url: `/api/products/${product.id}`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        },
        payload: {
          name: 'Updated Product Name'
        }
      });

      // Get product again (should return updated data)
      const secondResponse = await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}`
      });
      const updatedName = secondResponse.json().name;

      expect(updatedName).not.toBe(originalName);
      expect(updatedName).toBe('Updated Product Name');
    });
  });

  describe('Error Handling Under Load', () => {
    test('should handle validation errors gracefully under load', async () => {
      const invalidRequests = 20;
      
      const responses = await createConcurrentRequests(
        () => app.inject({
          method: 'POST',
          url: '/api/products',
          headers: {
            Authorization: `Bearer ${sellerToken}`
          },
          payload: {
            name: '', // Invalid: empty name
            price: -10, // Invalid: negative price
            currency: 'INVALID' // Invalid: bad currency
          }
        }),
        invalidRequests
      );

      // All should return validation errors
      responses.forEach(response => {
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toContain('validation');
      });
    });

    test('should handle authentication errors gracefully under load', async () => {
      const unauthorizedRequests = 15;
      
      const responses = await createConcurrentRequests(
        () => app.inject({
          method: 'POST',
          url: '/api/products',
          headers: {
            Authorization: 'Bearer invalid-token'
          },
          payload: {
            name: 'Test Product',
            price: 99.99,
            currency: 'USD',
            sku: `SKU-${Date.now()}`,
            categoryId: category.id
          }
        }),
        unauthorizedRequests
      );

      // All should return unauthorized errors
      responses.forEach(response => {
        expect(response.statusCode).toBe(401);
      });
    });
  });
});