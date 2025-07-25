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
  expectPerformance
} from '../setup';

describe('Complete Order Flow Integration', () => {
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
    
    // Set up test data
    customer = await createTestUser({ role: 'CUSTOMER' });
    seller = await createTestSeller();
    category = await createTestCategory();
    product = await createTestProduct({ seller, category, price: 99.99, stock: 100 });
    
    customerToken = await generateTestJWT(customer);
    sellerToken = await generateTestJWT(seller.user);
  });

  test('complete order flow: browse -> add to cart -> checkout -> payment -> fulfillment', async () => {
    // 1. Browse products
    const browseResponse = await app.inject({
      method: 'GET',
      url: '/api/products'
    });
    expect(browseResponse.statusCode).toBe(200);
    const products = browseResponse.json().data.products;
    expect(products.length).toBeGreaterThan(0);

    // 2. View product details
    const productResponse = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}`
    });
    expect(productResponse.statusCode).toBe(200);

    // 3. Add to cart
    const addToCartResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: {
        Authorization: `Bearer ${customerToken}`
      },
      payload: {
        productId: product.id,
        quantity: 2
      }
    });
    expect(addToCartResponse.statusCode).toBe(201);

    // 4. View cart
    const cartResponse = await app.inject({
      method: 'GET',
      url: '/api/cart',
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    expect(cartResponse.statusCode).toBe(200);
    const cart = cartResponse.json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.total).toBe(199.98); // 2 * 99.99

    // 5. Create order from cart
    const createOrderResponse = await app.inject({
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
    expect(createOrderResponse.statusCode).toBe(201);
    const order = createOrderResponse.json().order;

    // 6. Process payment
    const paymentResponse = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: {
        Authorization: `Bearer ${customerToken}`
      },
      payload: {
        orderId: order.id,
        amount: order.total,
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentDetails: {
          cardNumber: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123'
        }
      }
    });
    expect(paymentResponse.statusCode).toBe(201);
    const payment = paymentResponse.json().payment;
    expect(payment.status).toBe('COMPLETED');

    // 7. Verify order status updated
    const orderStatusResponse = await app.inject({
      method: 'GET',
      url: `/api/orders/${order.id}`,
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    expect(orderStatusResponse.statusCode).toBe(200);
    const updatedOrder = orderStatusResponse.json();
    expect(updatedOrder.status).toBe('CONFIRMED');

    // 8. Seller fulfills order
    const fulfillResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/fulfill`,
      headers: {
        Authorization: `Bearer ${sellerToken}`
      },
      payload: {
        trackingNumber: 'TRACK123456',
        carrier: 'TEST_CARRIER'
      }
    });
    expect(fulfillResponse.statusCode).toBe(200);

    // 9. Verify stock updated
    const productStockResponse = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}`
    });
    expect(productStockResponse.statusCode).toBe(200);
    const updatedProduct = productStockResponse.json();
    expect(updatedProduct.stock).toBe(98); // 100 - 2

    // 10. Customer receives order and can leave review
    const reviewResponse = await app.inject({
      method: 'POST',
      url: '/api/reviews/products',
      headers: {
        Authorization: `Bearer ${customerToken}`
      },
      payload: {
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Great product, fast delivery!'
      }
    });
    expect(reviewResponse.statusCode).toBe(201);

    // 11. Verify order completion
    const finalOrderResponse = await app.inject({
      method: 'GET',
      url: `/api/orders/${order.id}`,
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    const finalOrder = finalOrderResponse.json();
    expect(finalOrder.status).toBe('SHIPPED');
    expect(finalOrder.tracking.trackingNumber).toBe('TRACK123456');
  });

  test('order flow with coupon application', async () => {
    // Create a test coupon
    const createCouponResponse = await app.inject({
      method: 'POST',
      url: '/api/coupons',
      headers: {
        Authorization: `Bearer ${sellerToken}`
      },
      payload: {
        code: 'TESTDISCOUNT',
        name: 'Test Discount',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minOrderAmount: 50,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    expect(createCouponResponse.statusCode).toBe(201);

    // Add product to cart
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

    // Apply coupon
    const applyCouponResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/coupon',
      headers: {
        Authorization: `Bearer ${customerToken}`
      },
      payload: {
        couponCode: 'TESTDISCOUNT'
      }
    });
    expect(applyCouponResponse.statusCode).toBe(200);

    // Check cart total with discount
    const cartResponse = await app.inject({
      method: 'GET',
      url: '/api/cart',
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    expect(cartResponse.statusCode).toBe(200);
    const cart = cartResponse.json();
    expect(cart.discount).toBe(9.99); // 10% of 99.99
    expect(cart.total).toBe(89.99); // 99.99 - 9.99

    // Create order with discount
    const createOrderResponse = await app.inject({
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
    expect(createOrderResponse.statusCode).toBe(201);
    const order = createOrderResponse.json().order;
    expect(order.discountAmount).toBe(9.99);
    expect(order.total).toBe(89.99);
  });

  test('order flow with loyalty points', async () => {
    // Award some loyalty points to customer
    const awardPointsResponse = await app.inject({
      method: 'POST',
      url: '/api/loyalty/admin/points/award',
      headers: {
        Authorization: `Bearer ${sellerToken}` // Assuming seller has admin role
      },
      payload: {
        userId: customer.id,
        points: 1000,
        description: 'Welcome bonus'
      }
    });
    expect(awardPointsResponse.statusCode).toBe(200);

    // Add product to cart
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

    // Use loyalty points during checkout (100 points = $1)
    const createOrderResponse = await app.inject({
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
        paymentMethod: 'CREDIT_CARD',
        loyaltyPointsToUse: 500 // Use 500 points = $5 discount
      }
    });
    expect(createOrderResponse.statusCode).toBe(201);
    const order = createOrderResponse.json().order;
    expect(order.loyaltyPointsUsed).toBe(500);
    expect(order.total).toBe(94.99); // 99.99 - 5.00

    // Verify points were deducted
    const pointsResponse = await app.inject({
      method: 'GET',
      url: '/api/loyalty/points',
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    expect(pointsResponse.statusCode).toBe(200);
    const loyaltyData = pointsResponse.json();
    expect(loyaltyData.points).toBe(500); // 1000 - 500
  });

  test('order cancellation flow', async () => {
    // Create order
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

    const createOrderResponse = await app.inject({
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
    const order = createOrderResponse.json().order;

    // Cancel order
    const cancelResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/cancel`,
      headers: {
        Authorization: `Bearer ${customerToken}`
      },
      payload: {
        reason: 'Changed my mind'
      }
    });
    expect(cancelResponse.statusCode).toBe(200);

    // Verify order status
    const orderResponse = await app.inject({
      method: 'GET',
      url: `/api/orders/${order.id}`,
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    const cancelledOrder = orderResponse.json();
    expect(cancelledOrder.status).toBe('CANCELLED');

    // Verify stock was restored
    const productResponse = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}`
    });
    const updatedProduct = productResponse.json();
    expect(updatedProduct.stock).toBe(100); // Back to original stock
  });

  test('return and refund flow', async () => {
    // Complete an order first
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

    const orderResponse = await app.inject({
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
    const order = orderResponse.json().order;

    // Process payment
    await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: {
        Authorization: `Bearer ${customerToken}`
      },
      payload: {
        orderId: order.id,
        amount: order.total,
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentDetails: {
          cardNumber: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123'
        }
      }
    });

    // Mark as delivered
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/deliver`,
      headers: {
        Authorization: `Bearer ${sellerToken}`
      }
    });

    // Request return
    const returnResponse = await app.inject({
      method: 'POST',
      url: '/api/returns',
      headers: {
        Authorization: `Bearer ${customerToken}`
      },
      payload: {
        orderId: order.id,
        type: 'FULL_RETURN',
        reason: 'DEFECTIVE',
        description: 'Product arrived damaged'
      }
    });
    expect(returnResponse.statusCode).toBe(201);
    const returnRequest = returnResponse.json().returnRequest;

    // Seller approves return
    const approveResponse = await app.inject({
      method: 'PATCH',
      url: `/api/returns/${returnRequest.id}/approve`,
      headers: {
        Authorization: `Bearer ${sellerToken}`
      }
    });
    expect(approveResponse.statusCode).toBe(200);

    // Process refund
    const refundResponse = await app.inject({
      method: 'POST',
      url: `/api/returns/${returnRequest.id}/refund`,
      headers: {
        Authorization: `Bearer ${sellerToken}`
      },
      payload: {
        amount: order.total,
        method: 'ORIGINAL_PAYMENT'
      }
    });
    expect(refundResponse.statusCode).toBe(200);

    // Verify return status
    const finalReturnResponse = await app.inject({
      method: 'GET',
      url: `/api/returns/${returnRequest.id}`,
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    const finalReturn = finalReturnResponse.json();
    expect(finalReturn.status).toBe('COMPLETED');
    expect(finalReturn.refundStatus).toBe('REFUNDED');
  });

  test('performance: order creation should complete within time limit', async () => {
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

    expectPerformance(time, 1000); // Should complete within 1 second
  });
});