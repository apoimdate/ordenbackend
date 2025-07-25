import { describe, test, expect, beforeEach } from '@jest/globals';
import { 
  setupTestApp, 
  createTestUser,
  createTestSeller,
  createTestCategory,
  createTestProduct,
  generateTestJWT,
  cleanupDatabase,
  expectValidationError,
  expectUnauthorized,
  expectForbidden,
  expectNotFound,
  generateMockProduct
} from '../setup';
import { ProductService } from '../../src/services/product.service';

describe('Product Service', () => {
  let app: any;
  let productService: ProductService;
  let seller: any;
  let category: any;

  beforeEach(async () => {
    app = await setupTestApp();
    productService = new ProductService(app);
    await cleanupDatabase();
    
    seller = await createTestSeller();
    category = await createTestCategory();
  });

  describe('Product Creation', () => {
    test('should create product successfully', async () => {
      const productData = {
        name: 'Test Product',
        description: 'A great test product',
        price: 99.99,
        currency: 'USD',
        sku: 'TEST-SKU-001',
        stock: 100,
        categoryId: category.id,
        sellerId: seller.id,
        status: 'ACTIVE' as const
      };

      const result = await productService.createProduct(productData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data?.name).toBe(productData.name);
      expect(result.data?.price).toBe(productData.price);
      expect(result.data?.seller.id).toBe(seller.id);
      expect(result.data?.category.id).toBe(category.id);
    });

    test('should not create product with duplicate SKU', async () => {
      const productData = {
        name: 'Test Product',
        description: 'A great test product',
        price: 99.99,
        currency: 'USD',
        sku: 'DUPLICATE-SKU',
        stock: 100,
        categoryId: category.id,
        sellerId: seller.id
      };

      // Create first product
      await productService.createProduct(productData);

      // Try to create second product with same SKU
      const result = await productService.createProduct({
        ...productData,
        name: 'Different Product'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SKU_ALREADY_EXISTS');
    });

    test('should validate required fields', async () => {
      const productData = {
        name: '',
        price: -10,
        currency: 'INVALID',
        sku: '',
        stock: -5,
        categoryId: 'invalid-id',
        sellerId: 'invalid-id'
      };

      const result = await productService.createProduct(productData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Product Updates', () => {
    test('should update product successfully', async () => {
      const product = await createTestProduct({ seller, category });
      
      const updateData = {
        name: 'Updated Product Name',
        price: 149.99,
        stock: 50
      };

      const result = await productService.updateProduct(product.id, updateData, seller.user.id);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe(updateData.name);
      expect(result.data?.price).toBe(updateData.price);
      expect(result.data?.stock).toBe(updateData.stock);
    });

    test('should not allow non-owner to update product', async () => {
      const product = await createTestProduct({ seller, category });
      const otherSeller = await createTestSeller();

      const updateData = {
        name: 'Hacked Product Name'
      };

      const result = await productService.updateProduct(product.id, updateData, otherSeller.user.id);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    test('should track inventory changes', async () => {
      const product = await createTestProduct({ seller, category, stock: 100 });
      
      const result = await productService.updateStock(product.id, 80, 'SOLD', 'Order fulfillment');

      expect(result.success).toBe(true);
      expect(result.data?.stock).toBe(80);

      // Check inventory history was created
      const inventoryHistory = await app.prisma.inventoryHistory.findMany({
        where: { productId: product.id }
      });
      expect(inventoryHistory).toHaveLength(1);
      expect(inventoryHistory[0].changeType).toBe('SOLD');
      expect(inventoryHistory[0].quantityChange).toBe(-20);
    });
  });

  describe('Product Search and Filtering', () => {
    beforeEach(async () => {
      // Create test products for searching
      await createTestProduct({ 
        seller, 
        category, 
        name: 'iPhone 14 Pro',
        price: 999.99,
        tags: ['smartphone', 'apple', 'premium']
      });
      
      await createTestProduct({ 
        seller, 
        category, 
        name: 'Samsung Galaxy S23',
        price: 899.99,
        tags: ['smartphone', 'samsung', 'android']
      });
      
      await createTestProduct({ 
        seller, 
        category, 
        name: 'MacBook Pro',
        price: 1999.99,
        tags: ['laptop', 'apple', 'premium']
      });
    });

    test('should search products by name', async () => {
      const result = await productService.searchProducts({
        search: 'iPhone',
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data?.products).toHaveLength(1);
      expect(result.data?.products[0].name).toContain('iPhone');
    });

    test('should filter by price range', async () => {
      const result = await productService.searchProducts({
        minPrice: 800,
        maxPrice: 1000,
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data?.products).toHaveLength(2); // iPhone and Samsung
      result.data?.products.forEach(product => {
        expect(product.price).toBeGreaterThanOrEqual(800);
        expect(product.price).toBeLessThanOrEqual(1000);
      });
    });

    test('should filter by category', async () => {
      const result = await productService.searchProducts({
        categoryId: category.id,
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data?.products).toHaveLength(3);
      result.data?.products.forEach(product => {
        expect(product.categoryId).toBe(category.id);
      });
    });

    test('should sort products by price', async () => {
      const result = await productService.searchProducts({
        sortBy: 'price',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      });

      expect(result.success).toBe(true);
      const prices = result.data?.products.map(p => p.price) || [];
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });
  });

  describe('Stock Management', () => {
    test('should handle stock depletion alerts', async () => {
      const product = await createTestProduct({ 
        seller, 
        category, 
        stock: 5,
        lowStockThreshold: 10
      });

      const result = await productService.updateStock(product.id, 3, 'SOLD', 'Sale');

      expect(result.success).toBe(true);
      expect(result.data?.stock).toBe(3);

      // Check if low stock alert was created
      const alerts = await app.prisma.stockAlert.findMany({
        where: { productId: product.id }
      });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alertType).toBe('LOW_STOCK');
    });

    test('should prevent negative stock', async () => {
      const product = await createTestProduct({ seller, category, stock: 5 });

      const result = await productService.updateStock(product.id, -10, 'SOLD', 'Oversale');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSUFFICIENT_STOCK');
    });

    test('should handle bulk stock updates', async () => {
      const products = [
        await createTestProduct({ seller, category, sku: 'SKU-1' }),
        await createTestProduct({ seller, category, sku: 'SKU-2' }),
        await createTestProduct({ seller, category, sku: 'SKU-3' })
      ];

      const stockUpdates = products.map(product => ({
        productId: product.id,
        newStock: 50,
        changeType: 'RESTOCK' as const,
        reason: 'Bulk inventory update'
      }));

      const result = await productService.bulkUpdateStock(stockUpdates);

      expect(result.success).toBe(true);
      expect(result.data?.successCount).toBe(3);
      expect(result.data?.failedCount).toBe(0);
    });
  });

  describe('Product Analytics', () => {
    test('should get product performance metrics', async () => {
      const product = await createTestProduct({ seller, category });

      // Simulate some orders and views
      await app.prisma.productView.createMany({
        data: [
          { productId: product.id, userId: seller.user.id },
          { productId: product.id, userId: seller.user.id },
          { productId: product.id, userId: seller.user.id }
        ]
      });

      const result = await productService.getProductAnalytics(product.id, {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('views');
      expect(result.data).toHaveProperty('sales');
      expect(result.data).toHaveProperty('revenue');
      expect(result.data?.views).toBe(3);
    });
  });
});

describe('Product Routes', () => {
  let app: any;
  let seller: any;
  let category: any;
  let sellerToken: string;
  let customerToken: string;

  beforeEach(async () => {
    app = await setupTestApp();
    await cleanupDatabase();
    
    seller = await createTestSeller();
    category = await createTestCategory();
    sellerToken = await generateTestJWT(seller.user);
    
    const customer = await createTestUser({ role: 'CUSTOMER' });
    customerToken = await generateTestJWT(customer);
  });

  describe('POST /api/products', () => {
    test('should create product for seller', async () => {
      const productData = generateMockProduct({
        categoryId: category.id
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          Authorization: `Bearer ${sellerToken}`
        },
        payload: productData
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.product.name).toBe(productData.name);
      expect(data.product.sellerId).toBe(seller.id);
    });

    test('should not allow customer to create product', async () => {
      const productData = generateMockProduct({
        categoryId: category.id
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          Authorization: `Bearer ${customerToken}`
        },
        payload: productData
      });

      expectForbidden(response);
    });

    test('should validate product data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          Authorization: `Bearer ${sellerToken}`
        },
        payload: {
          name: '',
          price: -10,
          currency: 'INVALID'
        }
      });

      expectValidationError(response);
    });
  });

  describe('GET /api/products', () => {
    beforeEach(async () => {
      // Create test products
      await createTestProduct({ seller, category, name: 'Product 1', price: 100 });
      await createTestProduct({ seller, category, name: 'Product 2', price: 200 });
      await createTestProduct({ seller, category, name: 'Product 3', price: 300 });
    });

    test('should get all products', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products'
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.products).toHaveLength(3);
      expect(data.meta.total).toBe(3);
    });

    test('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products?page=1&limit=2'
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.products).toHaveLength(2);
      expect(data.meta.page).toBe(1);
      expect(data.meta.limit).toBe(2);
      expect(data.meta.totalPages).toBe(2);
    });

    test('should filter by price range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products?minPrice=150&maxPrice=250'
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.products).toHaveLength(1);
      expect(data.data.products[0].name).toBe('Product 2');
    });

    test('should search by name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products?search=Product 1'
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.products).toHaveLength(1);
      expect(data.data.products[0].name).toBe('Product 1');
    });
  });

  describe('GET /api/products/:productId', () => {
    test('should get product details', async () => {
      const product = await createTestProduct({ seller, category });

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}`
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.id).toBe(product.id);
      expect(data.name).toBe(product.name);
      expect(data.seller).toBeDefined();
      expect(data.category).toBeDefined();
    });

    test('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products/non-existent-id'
      });

      expect(response.statusCode).toBe(404);
    });

    test('should increment view count', async () => {
      const product = await createTestProduct({ seller, category });

      // Make multiple requests
      await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}`
      });
      
      await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}`
      });

      // Check view count in database
      const updatedProduct = await app.prisma.product.findUnique({
        where: { id: product.id }
      });
      expect(updatedProduct?.viewCount).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/products/:productId', () => {
    test('should update own product', async () => {
      const product = await createTestProduct({ seller, category });

      const updateData = {
        name: 'Updated Product Name',
        price: 199.99
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/products/${product.id}`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        },
        payload: updateData
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.product.name).toBe(updateData.name);
      expect(data.product.price).toBe(updateData.price);
    });

    test('should not update other seller\'s product', async () => {
      const otherSeller = await createTestSeller();
      const product = await createTestProduct({ seller: otherSeller, category });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/products/${product.id}`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        },
        payload: {
          name: 'Hacked Product'
        }
      });

      expectForbidden(response);
    });
  });

  describe('DELETE /api/products/:productId', () => {
    test('should delete own product', async () => {
      const product = await createTestProduct({ seller, category });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/products/${product.id}`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify product is deleted
      const deletedProduct = await app.prisma.product.findUnique({
        where: { id: product.id }
      });
      expect(deletedProduct).toBeNull();
    });

    test('should not delete other seller\'s product', async () => {
      const otherSeller = await createTestSeller();
      const product = await createTestProduct({ seller: otherSeller, category });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/products/${product.id}`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        }
      });

      expectForbidden(response);
    });
  });

  describe('Stock Management Routes', () => {
    test('should update product stock', async () => {
      const product = await createTestProduct({ seller, category, stock: 100 });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/products/${product.id}/stock`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        },
        payload: {
          newStock: 50,
          changeType: 'ADJUSTMENT',
          reason: 'Inventory count correction'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.product.stock).toBe(50);
    });

    test('should get stock history', async () => {
      const product = await createTestProduct({ seller, category });

      // Create some stock changes
      await app.inject({
        method: 'PATCH',
        url: `/api/products/${product.id}/stock`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        },
        payload: {
          newStock: 80,
          changeType: 'SOLD',
          reason: 'Product sold'
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}/stock/history`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.history.length).toBeGreaterThan(0);
    });
  });

  describe('Product Analytics Routes', () => {
    test('should get product analytics for seller', async () => {
      const product = await createTestProduct({ seller, category });

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}/analytics`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty('views');
      expect(data).toHaveProperty('sales');
      expect(data).toHaveProperty('revenue');
    });

    test('should not allow other sellers to view analytics', async () => {
      const otherSeller = await createTestSeller();
      const product = await createTestProduct({ seller: otherSeller, category });

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${product.id}/analytics`,
        headers: {
          Authorization: `Bearer ${sellerToken}`
        }
      });

      expectForbidden(response);
    });
  });
});