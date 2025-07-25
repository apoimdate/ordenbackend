# OrdenDirecta Backend API Documentation

## Overview

This document provides comprehensive documentation for all API endpoints in the OrdenDirecta backend system. The API is built with Fastify 4, uses JWT authentication, and implements Role-Based Access Control (RBAC).

## Base URL

```
Production: https://api.ordendirecta.com
Staging: https://staging-api.ordendirecta.com
Development: http://localhost:3000
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### User Roles

- **USER** - Regular customer
- **SELLER** - Seller/vendor
- **ADMIN** - System administrator
- **SUPER_ADMIN** - Super administrator with full access

## API Endpoints

### Health Check

#### Health Status
```http
GET /health
```
**Access**: Public  
**Description**: Check if the API is running  
**Response**: `200 OK`
```json
{
  "status": "ok"
}
```

#### Readiness Check
```http
GET /ready
```
**Access**: Public  
**Description**: Check if the API is ready to accept requests  
**Response**: `200 OK`
```json
{
  "status": "ready",
  "database": "connected",
  "cache": "connected"
}
```

---

### Authentication Endpoints

#### Register
```http
POST /api/auth/register
```
**Access**: Public  
**Description**: Register a new user account  
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+5351234567"
}
```
**Response**: `201 Created`
```json
{
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "cuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### Login
```http
POST /api/auth/login
```
**Access**: Public  
**Description**: Login with email and password  
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response**: `200 OK`
```json
{
  "message": "Login successful",
  "data": {
    "user": {
      "id": "cuid",
      "email": "user@example.com",
      "role": "USER"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh
```
**Access**: Public  
**Description**: Refresh access token using refresh token  
**Request Body**:
```json
{
  "refreshToken": "refresh_token"
}
```
**Response**: `200 OK`
```json
{
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new_jwt_token"
  }
}
```

#### Logout
```http
POST /api/auth/logout
```
**Access**: Authenticated  
**Description**: Logout and invalidate refresh token  
**Response**: `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

#### Request Password Reset
```http
POST /api/auth/forgot-password
```
**Access**: Public  
**Description**: Request a password reset email  
**Request Body**:
```json
{
  "email": "user@example.com"
}
```
**Response**: `200 OK`
```json
{
  "message": "Password reset email sent"
}
```

#### Reset Password
```http
POST /api/auth/reset-password
```
**Access**: Public  
**Description**: Reset password using token from email  
**Request Body**:
```json
{
  "token": "reset_token",
  "password": "NewSecurePass123!"
}
```
**Response**: `200 OK`
```json
{
  "message": "Password reset successfully"
}
```

#### Change Password
```http
POST /api/auth/change-password
```
**Access**: Authenticated  
**Description**: Change password for authenticated user  
**Request Body**:
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```
**Response**: `200 OK`
```json
{
  "message": "Password changed successfully"
}
```

#### Enable Two-Factor Auth
```http
POST /api/auth/2fa/enable
```
**Access**: Authenticated  
**Description**: Enable two-factor authentication  
**Response**: `200 OK`
```json
{
  "message": "Two-factor authentication enabled",
  "data": {
    "secret": "base32_secret",
    "qrCode": "data:image/png;base64,..."
  }
}
```

#### Verify Two-Factor Auth
```http
POST /api/auth/2fa/verify
```
**Access**: Authenticated  
**Description**: Verify two-factor authentication code  
**Request Body**:
```json
{
  "code": "123456"
}
```
**Response**: `200 OK`
```json
{
  "message": "Two-factor authentication verified"
}
```

#### Disable Two-Factor Auth
```http
POST /api/auth/2fa/disable
```
**Access**: Authenticated  
**Description**: Disable two-factor authentication  
**Request Body**:
```json
{
  "code": "123456"
}
```
**Response**: `200 OK`
```json
{
  "message": "Two-factor authentication disabled"
}
```

---

### User Management

#### Get Current User Profile
```http
GET /api/users/profile
```
**Access**: Authenticated  
**Description**: Get current authenticated user's profile  
**Response**: `200 OK`
```json
{
  "message": "Profile fetched successfully",
  "data": {
    "id": "cuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+5351234567",
    "role": "USER",
    "isActive": true,
    "emailVerified": true
  }
}
```

#### Update User Profile
```http
PUT /api/users/profile
```
**Access**: Authenticated  
**Description**: Update current user's profile  
**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+5351234567"
}
```
**Response**: `200 OK`
```json
{
  "message": "Profile updated successfully",
  "data": {
    "id": "cuid",
    "firstName": "John",
    "lastName": "Smith"
  }
}
```

#### Get All Users (Admin)
```http
GET /api/admin/users
```
**Access**: Admin, Super Admin  
**Description**: Get all users with pagination and filters  
**Query Parameters**:
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20, max: 100)
- `search` (string) - Search by name or email
- `role` (string) - Filter by role
- `isActive` (boolean) - Filter by active status

**Response**: `200 OK`
```json
{
  "message": "Users fetched successfully",
  "data": {
    "users": [...],
    "total": 100,
    "page": 1,
    "totalPages": 5
  }
}
```

#### Get User by ID (Admin)
```http
GET /api/admin/users/:userId
```
**Access**: Admin, Super Admin  
**Description**: Get specific user details  
**Response**: `200 OK`
```json
{
  "message": "User fetched successfully",
  "data": {
    "id": "cuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "isActive": true
  }
}
```

#### Update User (Admin)
```http
PUT /api/admin/users/:userId
```
**Access**: Admin, Super Admin  
**Description**: Update user details  
**Request Body**:
```json
{
  "role": "SELLER",
  "isActive": true
}
```
**Response**: `200 OK`
```json
{
  "message": "User updated successfully",
  "data": {...}
}
```

#### Delete User (Admin)
```http
DELETE /api/admin/users/:userId
```
**Access**: Super Admin  
**Description**: Delete a user account  
**Response**: `200 OK`
```json
{
  "message": "User deleted successfully"
}
```

---

### Product Management

#### Get All Products
```http
GET /api/products
```
**Access**: Public  
**Description**: Get all products with pagination and filters  
**Query Parameters**:
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20)
- `search` (string) - Search in name and description
- `category` (string) - Filter by category ID
- `subcategory` (string) - Filter by subcategory ID
- `minPrice` (number) - Minimum price
- `maxPrice` (number) - Maximum price
- `sortBy` (string) - Sort field (price, name, createdAt)
- `sortOrder` (string) - Sort order (asc, desc)
- `inStock` (boolean) - Filter by stock availability

**Response**: `200 OK`
```json
{
  "message": "Products fetched successfully",
  "data": {
    "products": [
      {
        "id": "cuid",
        "name": "Product Name",
        "description": "Product description",
        "price": 99.99,
        "currency": "USD",
        "images": ["url1", "url2"],
        "stock": 100,
        "seller": {
          "id": "cuid",
          "businessName": "Seller Name"
        }
      }
    ],
    "total": 500,
    "page": 1,
    "totalPages": 25
  }
}
```

#### Get Product by ID
```http
GET /api/products/:productId
```
**Access**: Public  
**Description**: Get detailed product information  
**Response**: `200 OK`
```json
{
  "message": "Product fetched successfully",
  "data": {
    "id": "cuid",
    "name": "Product Name",
    "description": "Detailed description",
    "price": 99.99,
    "currency": "USD",
    "images": ["url1", "url2"],
    "stock": 100,
    "specifications": {...},
    "seller": {...},
    "category": {...},
    "reviews": {
      "average": 4.5,
      "count": 23
    }
  }
}
```

#### Create Product (Seller)
```http
POST /api/seller/products
```
**Access**: Seller  
**Description**: Create a new product  
**Request Body**:
```json
{
  "name": "New Product",
  "description": "Product description",
  "price": 99.99,
  "currency": "USD",
  "categoryId": "category_cuid",
  "subcategoryId": "subcategory_cuid",
  "images": ["url1", "url2"],
  "stock": 100,
  "sku": "SKU123",
  "specifications": {
    "weight": "1kg",
    "dimensions": "10x10x10cm"
  }
}
```
**Response**: `201 Created`
```json
{
  "message": "Product created successfully",
  "data": {...}
}
```

#### Update Product (Seller)
```http
PUT /api/seller/products/:productId
```
**Access**: Seller (owner)  
**Description**: Update product details  
**Request Body**: Same as create (partial update supported)  
**Response**: `200 OK`
```json
{
  "message": "Product updated successfully",
  "data": {...}
}
```

#### Delete Product (Seller)
```http
DELETE /api/seller/products/:productId
```
**Access**: Seller (owner)  
**Description**: Delete a product  
**Response**: `200 OK`
```json
{
  "message": "Product deleted successfully"
}
```

#### Search Products
```http
GET /api/products/search
```
**Access**: Public  
**Description**: Search products using Typesense  
**Query Parameters**:
- `q` (string) - Search query
- `page` (number) - Page number
- `limit` (number) - Results per page

**Response**: `200 OK`
```json
{
  "message": "Search completed successfully",
  "data": {
    "results": [...],
    "total": 50,
    "facets": {...}
  }
}
```

---

### Order Management

#### Create Order
```http
POST /api/orders
```
**Access**: Customer  
**Description**: Create a new order  
**Request Body**:
```json
{
  "items": [
    {
      "productId": "product_cuid",
      "quantity": 2,
      "price": 99.99
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Havana",
    "state": "Havana",
    "postalCode": "10400",
    "country": "CU"
  },
  "paymentMethodId": "payment_method_cuid",
  "shippingMethodId": "shipping_method_cuid"
}
```
**Response**: `201 Created`
```json
{
  "message": "Order created successfully",
  "data": {
    "id": "cuid",
    "orderNumber": "ORD-2024-0001",
    "status": "pending",
    "totalAmount": 199.98,
    "currency": "USD"
  }
}
```

#### Get User Orders
```http
GET /api/orders
```
**Access**: Customer  
**Description**: Get authenticated user's orders  
**Query Parameters**:
- `page` (number) - Page number
- `limit` (number) - Items per page
- `status` (string) - Filter by status

**Response**: `200 OK`
```json
{
  "message": "Orders fetched successfully",
  "data": {
    "orders": [...],
    "total": 10,
    "page": 1,
    "totalPages": 1
  }
}
```

#### Get Order by ID
```http
GET /api/orders/:orderId
```
**Access**: Customer (owner), Seller (if their product), Admin  
**Description**: Get detailed order information  
**Response**: `200 OK`
```json
{
  "message": "Order fetched successfully",
  "data": {
    "id": "cuid",
    "orderNumber": "ORD-2024-0001",
    "status": "processing",
    "items": [...],
    "shippingAddress": {...},
    "payment": {...},
    "tracking": {...}
  }
}
```

#### Update Order Status (Seller)
```http
PATCH /api/seller/orders/:orderId/status
```
**Access**: Seller (for their items)  
**Description**: Update order item status  
**Request Body**:
```json
{
  "status": "shipped",
  "trackingNumber": "TRACK123456"
}
```
**Response**: `200 OK`
```json
{
  "message": "Order status updated successfully",
  "data": {...}
}
```

#### Cancel Order
```http
POST /api/orders/:orderId/cancel
```
**Access**: Customer (owner)  
**Description**: Cancel an order  
**Request Body**:
```json
{
  "reason": "Changed my mind"
}
```
**Response**: `200 OK`
```json
{
  "message": "Order cancelled successfully"
}
```

---

### Payment Management

#### Get Payment Methods
```http
GET /api/payments/methods
```
**Access**: Customer  
**Description**: Get user's saved payment methods  
**Response**: `200 OK`
```json
{
  "message": "Payment methods fetched successfully",
  "data": [
    {
      "id": "cuid",
      "type": "card",
      "last4": "4242",
      "brand": "visa",
      "isDefault": true
    }
  ]
}
```

#### Add Payment Method
```http
POST /api/payments/methods
```
**Access**: Customer  
**Description**: Add a new payment method  
**Request Body**:
```json
{
  "type": "card",
  "token": "stripe_token",
  "isDefault": true
}
```
**Response**: `201 Created`
```json
{
  "message": "Payment method added successfully",
  "data": {...}
}
```

#### Process Payment
```http
POST /api/payments/process
```
**Access**: Customer  
**Description**: Process payment for an order  
**Request Body**:
```json
{
  "orderId": "order_cuid",
  "paymentMethodId": "payment_method_cuid",
  "amount": 199.98,
  "currency": "USD"
}
```
**Response**: `200 OK`
```json
{
  "message": "Payment processed successfully",
  "data": {
    "transactionId": "txn_cuid",
    "status": "completed"
  }
}
```

#### Create Refund
```http
POST /api/payments/refund
```
**Access**: Admin  
**Description**: Create a refund for a payment  
**Request Body**:
```json
{
  "transactionId": "txn_cuid",
  "amount": 50.00,
  "reason": "Customer request"
}
```
**Response**: `200 OK`
```json
{
  "message": "Refund processed successfully",
  "data": {
    "refundId": "refund_cuid",
    "status": "completed"
  }
}
```

---

### Seller Management

#### Register as Seller
```http
POST /api/sellers/register
```
**Access**: Customer  
**Description**: Apply to become a seller  
**Request Body**:
```json
{
  "businessName": "My Store",
  "businessType": "individual",
  "taxId": "123456789",
  "address": {
    "street": "123 Business St",
    "city": "Havana",
    "state": "Havana",
    "postalCode": "10400",
    "country": "CU"
  },
  "bankAccount": {
    "bankName": "Bank Name",
    "accountNumber": "1234567890",
    "routingNumber": "123456789"
  }
}
```
**Response**: `201 Created`
```json
{
  "message": "Seller application submitted successfully",
  "data": {
    "id": "cuid",
    "status": "pending_approval"
  }
}
```

#### Get Seller Profile
```http
GET /api/sellers/profile
```
**Access**: Seller  
**Description**: Get seller's own profile  
**Response**: `200 OK`
```json
{
  "message": "Seller profile fetched successfully",
  "data": {
    "id": "cuid",
    "businessName": "My Store",
    "status": "active",
    "rating": 4.5,
    "totalSales": 150,
    "commissionRate": 0.05
  }
}
```

#### Update Seller Profile
```http
PUT /api/sellers/profile
```
**Access**: Seller  
**Description**: Update seller profile  
**Request Body**:
```json
{
  "businessName": "My Updated Store",
  "description": "Best products in town",
  "logo": "url_to_logo",
  "banner": "url_to_banner"
}
```
**Response**: `200 OK`
```json
{
  "message": "Seller profile updated successfully",
  "data": {...}
}
```

#### Get Seller Dashboard Stats
```http
GET /api/sellers/dashboard
```
**Access**: Seller  
**Description**: Get seller dashboard statistics  
**Response**: `200 OK`
```json
{
  "message": "Dashboard stats fetched successfully",
  "data": {
    "totalRevenue": 15000.00,
    "totalOrders": 150,
    "pendingOrders": 5,
    "totalProducts": 45,
    "averageRating": 4.5,
    "recentOrders": [...],
    "topProducts": [...]
  }
}
```

#### Approve Seller (Admin)
```http
PATCH /api/admin/sellers/:sellerId/approve
```
**Access**: Admin, Super Admin  
**Description**: Approve a seller application  
**Response**: `200 OK`
```json
{
  "message": "Seller approved successfully"
}
```

---

### Shipping Management

#### Get Shipping Methods
```http
GET /api/shipping/methods
```
**Access**: Public  
**Description**: Get available shipping methods  
**Query Parameters**:
- `country` (string) - Destination country
- `weight` (number) - Package weight in kg

**Response**: `200 OK`
```json
{
  "message": "Shipping methods fetched successfully",
  "data": [
    {
      "id": "cuid",
      "name": "Standard Shipping",
      "description": "5-7 business days",
      "baseRate": 10.00,
      "estimatedDays": 7
    }
  ]
}
```

#### Calculate Shipping Cost
```http
POST /api/shipping/calculate
```
**Access**: Public  
**Description**: Calculate shipping cost  
**Request Body**:
```json
{
  "origin": {
    "country": "US",
    "postalCode": "10001"
  },
  "destination": {
    "country": "CU",
    "postalCode": "10400"
  },
  "weight": 2.5,
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 10
  }
}
```
**Response**: `200 OK`
```json
{
  "message": "Shipping cost calculated successfully",
  "data": {
    "methods": [
      {
        "id": "cuid",
        "name": "Standard Shipping",
        "cost": 25.00,
        "estimatedDays": 7
      }
    ]
  }
}
```

#### Track Shipment
```http
GET /api/shipping/track/:trackingNumber
```
**Access**: Public  
**Description**: Track a shipment  
**Response**: `200 OK`
```json
{
  "message": "Tracking information fetched successfully",
  "data": {
    "trackingNumber": "TRACK123456",
    "status": "in_transit",
    "estimatedDelivery": "2024-03-20",
    "events": [
      {
        "date": "2024-03-15",
        "location": "Miami, FL",
        "description": "Package shipped"
      }
    ]
  }
}
```

---

### Category Management

#### Get All Categories
```http
GET /api/categories
```
**Access**: Public  
**Description**: Get all product categories  
**Response**: `200 OK`
```json
{
  "message": "Categories fetched successfully",
  "data": [
    {
      "id": "cuid",
      "name": "Electronics",
      "slug": "electronics",
      "image": "url",
      "subcategories": [
        {
          "id": "cuid",
          "name": "Smartphones",
          "slug": "smartphones"
        }
      ]
    }
  ]
}
```

#### Create Category (Admin)
```http
POST /api/admin/categories
```
**Access**: Admin, Super Admin  
**Description**: Create a new category  
**Request Body**:
```json
{
  "name": "New Category",
  "slug": "new-category",
  "description": "Category description",
  "image": "url",
  "parentId": "parent_cuid" // optional for subcategory
}
```
**Response**: `201 Created`
```json
{
  "message": "Category created successfully",
  "data": {...}
}
```

---

### Review & Rating System

#### Get Product Reviews
```http
GET /api/products/:productId/reviews
```
**Access**: Public  
**Description**: Get reviews for a product  
**Query Parameters**:
- `page` (number) - Page number
- `limit` (number) - Items per page
- `rating` (number) - Filter by rating (1-5)
- `verified` (boolean) - Filter verified purchases

**Response**: `200 OK`
```json
{
  "message": "Reviews fetched successfully",
  "data": {
    "reviews": [
      {
        "id": "cuid",
        "rating": 5,
        "title": "Great product!",
        "comment": "Highly recommend",
        "user": {
          "name": "John D.",
          "isVerifiedPurchase": true
        },
        "helpful": 15,
        "notHelpful": 2
      }
    ],
    "summary": {
      "average": 4.5,
      "total": 123,
      "distribution": {
        "5": 80,
        "4": 30,
        "3": 10,
        "2": 2,
        "1": 1
      }
    }
  }
}
```

#### Create Product Review
```http
POST /api/reviews/products
```
**Access**: Customer  
**Description**: Create a product review  
**Request Body**:
```json
{
  "productId": "product_cuid",
  "orderId": "order_cuid",
  "rating": 5,
  "title": "Excellent product",
  "comment": "Very satisfied with the purchase",
  "images": ["url1", "url2"]
}
```
**Response**: `201 Created`
```json
{
  "message": "Review created successfully",
  "data": {...}
}
```

---

### Coupon & Promotion System

#### Apply Coupon
```http
POST /api/coupons/apply
```
**Access**: Customer  
**Description**: Apply a coupon code  
**Request Body**:
```json
{
  "code": "SAVE20",
  "orderAmount": 100.00,
  "products": ["product_id1", "product_id2"]
}
```
**Response**: `200 OK`
```json
{
  "message": "Coupon applied successfully",
  "data": {
    "discount": 20.00,
    "finalAmount": 80.00,
    "coupon": {
      "code": "SAVE20",
      "type": "percentage",
      "value": 20
    }
  }
}
```

#### Get Active Promotions
```http
GET /api/promotions/active
```
**Access**: Public  
**Description**: Get currently active promotions  
**Response**: `200 OK`
```json
{
  "message": "Active promotions fetched successfully",
  "data": [
    {
      "id": "cuid",
      "name": "Summer Sale",
      "description": "20% off all electronics",
      "type": "percentage",
      "value": 20,
      "validUntil": "2024-08-31"
    }
  ]
}
```

---

### Notification System

#### Get User Notifications
```http
GET /api/notifications
```
**Access**: Authenticated  
**Description**: Get user's notifications  
**Query Parameters**:
- `page` (number) - Page number
- `limit` (number) - Items per page
- `unreadOnly` (boolean) - Show only unread

**Response**: `200 OK`
```json
{
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "id": "cuid",
        "type": "order_status",
        "title": "Order Shipped",
        "message": "Your order #123 has been shipped",
        "isRead": false,
        "createdAt": "2024-03-15T10:00:00Z"
      }
    ],
    "unreadCount": 5
  }
}
```

#### Mark Notification as Read
```http
PATCH /api/notifications/:notificationId/read
```
**Access**: Authenticated (owner)  
**Description**: Mark a notification as read  
**Response**: `200 OK`
```json
{
  "message": "Notification marked as read"
}
```

---

### Support Ticket System

#### Create Support Ticket
```http
POST /api/support/tickets
```
**Access**: Authenticated  
**Description**: Create a new support ticket  
**Request Body**:
```json
{
  "subject": "Order Issue",
  "category": "order",
  "priority": "high",
  "message": "I haven't received my order yet",
  "orderId": "order_cuid" // optional
}
```
**Response**: `201 Created`
```json
{
  "message": "Support ticket created successfully",
  "data": {
    "id": "cuid",
    "ticketNumber": "TICKET-2024-0001",
    "status": "open"
  }
}
```

#### Get User Tickets
```http
GET /api/support/tickets
```
**Access**: Authenticated  
**Description**: Get user's support tickets  
**Response**: `200 OK`
```json
{
  "message": "Support tickets fetched successfully",
  "data": [
    {
      "id": "cuid",
      "ticketNumber": "TICKET-2024-0001",
      "subject": "Order Issue",
      "status": "open",
      "priority": "high",
      "createdAt": "2024-03-15T10:00:00Z"
    }
  ]
}
```

---

### Chat/Messaging System

#### Create Conversation
```http
POST /api/chat/conversations
```
**Access**: Authenticated  
**Description**: Create a new chat conversation  
**Request Body**:
```json
{
  "type": "CUSTOMER_SELLER",
  "participants": ["seller_user_id"],
  "title": "Question about product"
}
```
**Response**: `201 Created`
```json
{
  "message": "Conversation created successfully",
  "data": {
    "id": "cuid",
    "type": "CUSTOMER_SELLER",
    "participants": ["user_id1", "user_id2"],
    "lastMessageAt": null
  }
}
```

#### Send Message
```http
POST /api/chat/messages
```
**Access**: Authenticated  
**Description**: Send a message in a conversation  
**Request Body**:
```json
{
  "conversationId": "conversation_cuid",
  "type": "TEXT",
  "content": "Hello, I have a question about this product",
  "attachments": []
}
```
**Response**: `201 Created`
```json
{
  "message": "Message sent successfully",
  "data": {
    "id": "cuid",
    "content": "Hello, I have a question about this product",
    "status": "SENT",
    "createdAt": "2024-03-15T10:00:00Z"
  }
}
```

#### Get Conversations
```http
GET /api/chat/conversations
```
**Access**: Authenticated  
**Description**: Get user's chat conversations  
**Query Parameters**:
- `page` (number) - Page number
- `limit` (number) - Items per page
- `type` (string) - Filter by conversation type

**Response**: `200 OK`
```json
{
  "message": "Conversations fetched successfully",
  "data": {
    "conversations": [
      {
        "id": "cuid",
        "type": "CUSTOMER_SELLER",
        "participants": [...],
        "lastMessage": {...},
        "unreadCount": 2
      }
    ]
  }
}
```

---

### Commission System

#### Get Seller Commissions
```http
GET /api/seller/commissions
```
**Access**: Seller  
**Description**: Get seller's commission records  
**Query Parameters**:
- `page` (number) - Page number
- `limit` (number) - Items per page
- `status` (string) - Filter by status (pending, paid, cancelled)
- `dateFrom` (string) - Start date
- `dateTo` (string) - End date

**Response**: `200 OK`
```json
{
  "message": "Commissions fetched successfully",
  "data": {
    "commissions": [
      {
        "id": "cuid",
        "orderId": "order_cuid",
        "amount": 50.00,
        "rate": 0.05,
        "status": "pending",
        "createdAt": "2024-03-15"
      }
    ],
    "summary": {
      "totalPending": 250.00,
      "totalPaid": 1500.00,
      "currentRate": 0.05
    }
  }
}
```

#### Get Commission Statistics
```http
GET /api/seller/commissions/stats
```
**Access**: Seller  
**Description**: Get seller's commission statistics  
**Response**: `200 OK`
```json
{
  "message": "Commission statistics fetched successfully",
  "data": {
    "totalEarned": 5000.00,
    "pendingAmount": 250.00,
    "averageCommission": 45.50,
    "currentRate": 0.05,
    "monthlyTrend": [...]
  }
}
```

---

### Customs Declaration System

#### Calculate Customs Fees
```http
POST /api/customs/calculate
```
**Access**: Public  
**Description**: Calculate estimated customs fees for international orders  
**Request Body**:
```json
{
  "countryFrom": "US",
  "countryTo": "CU",
  "totalValue": 500.00,
  "currency": "USD",
  "weight": 2.5,
  "items": [
    {
      "productId": "product_cuid",
      "quantity": 2,
      "description": "Electronic device",
      "hsCode": "8517.12",
      "weight": 1.25
    }
  ]
}
```
**Response**: `200 OK`
```json
{
  "message": "Customs fees calculated successfully",
  "data": {
    "customsDuty": 150.00,
    "vat": 65.00,
    "handlingFee": 20.00,
    "totalFees": 235.00,
    "requiresDeclaration": true,
    "estimatedProcessingDays": 5
  }
}
```

#### Get Order Customs Declaration
```http
GET /api/orders/:orderId/customs
```
**Access**: Customer (order owner)  
**Description**: Get customs declaration for a specific order  
**Response**: `200 OK`
```json
{
  "message": "Customs declaration fetched successfully",
  "data": {
    "id": "cuid",
    "declarationNumber": "CD-2024-ABC123",
    "status": "PENDING",
    "totalValue": 500.00,
    "customsDuty": 150.00,
    "vat": 65.00,
    "handlingFee": 20.00,
    "totalFees": 235.00
  }
}
```

---

### Analytics & Reporting

#### Get Sales Analytics (Seller)
```http
GET /api/seller/analytics/sales
```
**Access**: Seller  
**Description**: Get sales analytics for seller  
**Query Parameters**:
- `period` (string) - Time period (day, week, month, year)
- `startDate` (string) - Start date
- `endDate` (string) - End date

**Response**: `200 OK`
```json
{
  "message": "Sales analytics fetched successfully",
  "data": {
    "totalRevenue": 15000.00,
    "totalOrders": 150,
    "averageOrderValue": 100.00,
    "topProducts": [...],
    "salesTrend": [...],
    "conversionRate": 2.5
  }
}
```

#### Get Platform Analytics (Admin)
```http
GET /api/admin/analytics/platform
```
**Access**: Admin, Super Admin  
**Description**: Get platform-wide analytics  
**Response**: `200 OK`
```json
{
  "message": "Platform analytics fetched successfully",
  "data": {
    "totalUsers": 10000,
    "totalSellers": 500,
    "totalOrders": 50000,
    "totalRevenue": 2500000.00,
    "platformGrowth": {...},
    "topCategories": [...]
  }
}
```

---

### Webhook Management

#### Register Webhook (Admin)
```http
POST /api/admin/webhooks
```
**Access**: Admin, Super Admin  
**Description**: Register a new webhook endpoint  
**Request Body**:
```json
{
  "url": "https://example.com/webhook",
  "events": ["order.created", "order.shipped"],
  "secret": "webhook_secret",
  "isActive": true
}
```
**Response**: `201 Created`
```json
{
  "message": "Webhook registered successfully",
  "data": {
    "id": "cuid",
    "url": "https://example.com/webhook",
    "events": ["order.created", "order.shipped"]
  }
}
```

---

## Error Responses

All API endpoints follow a consistent error response format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional details
}
```

### Common Error Codes

- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate email)
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authenticated requests**: 100 requests per minute
- **Unauthenticated requests**: 20 requests per minute
- **Auth endpoints**: 5 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

---

## Pagination

All list endpoints support pagination with consistent parameters:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

Response format:
```json
{
  "data": {
    "items": [...],
    "total": 1000,
    "page": 1,
    "totalPages": 50,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Webhooks

The platform supports webhooks for real-time event notifications. Available events:

- `order.created` - New order placed
- `order.updated` - Order status changed
- `order.cancelled` - Order cancelled
- `payment.completed` - Payment successful
- `payment.failed` - Payment failed
- `product.created` - New product listed
- `product.updated` - Product details changed
- `seller.approved` - Seller application approved
- `review.created` - New review posted

Webhook payload format:
```json
{
  "event": "order.created",
  "timestamp": "2024-03-15T10:00:00Z",
  "data": {
    // Event-specific data
  }
}
```

---

### Pickup Locations System

#### Get Active Pickup Locations
```http
GET /api/pickup/locations
```
**Access**: Public  
**Description**: Get all active pickup locations with filters  
**Query Parameters**:
- `type` (string) - Filter by location type (STORE, WAREHOUSE, PARTNER, LOCKER)
- `city` (string) - Filter by city
- `state` (string) - Filter by state
- `country` (string) - Filter by country code
- `search` (string) - Search in name and address
- `page` (number) - Page number
- `limit` (number) - Items per page

**Response**: `200 OK`
```json
{
  "message": "Pickup locations fetched successfully",
  "data": {
    "locations": [
      {
        "id": "cuid",
        "name": "Downtown Store",
        "type": "STORE",
        "address": {
          "street": "123 Main St",
          "city": "Havana",
          "state": "Havana",
          "postalCode": "10400",
          "country": "CU"
        },
        "operatingHours": {
          "monday": { "open": "09:00", "close": "18:00" },
          "tuesday": { "open": "09:00", "close": "18:00" }
        },
        "capacity": 50,
        "isActive": true
      }
    ],
    "total": 10,
    "page": 1,
    "totalPages": 1
  }
}
```

#### Get Nearby Pickup Locations
```http
GET /api/pickup/locations/nearby
```
**Access**: Public  
**Description**: Get pickup locations near specific coordinates  
**Query Parameters**:
- `latitude` (number) - Required latitude
- `longitude` (number) - Required longitude
- `radius` (number) - Search radius in km (default: 10)
- `type` (string) - Filter by location type

**Response**: `200 OK`
```json
{
  "message": "Nearby pickup locations fetched successfully",
  "data": [
    {
      "id": "cuid",
      "name": "Downtown Store",
      "distance": 2.5,
      "address": {...},
      "operatingHours": {...}
    }
  ]
}
```

#### Schedule Order Pickup
```http
POST /api/pickup/schedule
```
**Access**: Customer  
**Description**: Schedule a pickup for an order  
**Request Body**:
```json
{
  "orderId": "order_cuid",
  "pickupLocationId": "location_cuid",
  "scheduledDate": "2024-03-20T14:00:00Z",
  "notes": "Please call when ready"
}
```
**Response**: `200 OK`
```json
{
  "message": "Pickup scheduled successfully",
  "data": {
    "id": "order_cuid",
    "orderNumber": "ORD-2024-0001",
    "pickupLocation": {
      "name": "Downtown Store",
      "address": {...}
    },
    "pickupScheduledAt": "2024-03-20T14:00:00Z"
  }
}
```

#### Get Pickup Calendar
```http
GET /api/pickup/locations/:locationId/calendar
```
**Access**: Public  
**Description**: Get availability calendar for a pickup location  
**Query Parameters**:
- `startDate` (string) - Required start date
- `endDate` (string) - Required end date

**Response**: `200 OK`
```json
{
  "message": "Pickup calendar fetched successfully",
  "data": {
    "location": {...},
    "calendar": [
      {
        "date": "2024-03-20",
        "scheduledPickups": 15,
        "availableSlots": 35,
        "isFull": false
      }
    ]
  }
}
```

#### Create Pickup Location (Admin)
```http
POST /api/admin/pickup/locations
```
**Access**: Admin, Super Admin  
**Description**: Create a new pickup location  
**Request Body**:
```json
{
  "name": "New Pickup Point",
  "type": "PARTNER",
  "address": {
    "street": "456 Oak Ave",
    "city": "Havana",
    "state": "Havana",
    "postalCode": "10401",
    "country": "CU"
  },
  "phone": "+5351234567",
  "email": "pickup@partner.com",
  "operatingHours": {
    "monday": { "open": "08:00", "close": "20:00" },
    "tuesday": { "open": "08:00", "close": "20:00" }
  },
  "capacity": 100
}
```
**Response**: `201 Created`
```json
{
  "message": "Pickup location created successfully",
  "data": {...}
}
```

#### Complete Order Pickup (Admin)
```http
POST /api/admin/pickup/complete/:orderId
```
**Access**: Admin, Super Admin  
**Description**: Mark an order as picked up  
**Request Body**:
```json
{
  "signature": "base64_signature_image"
}
```
**Response**: `200 OK`
```json
{
  "message": "Pickup completed successfully",
  "data": {
    "id": "order_cuid",
    "status": "completed",
    "pickupCompletedAt": "2024-03-20T14:30:00Z"
  }
}
```

---

## Testing

### Test Environment

- Base URL: `https://test-api.ordendirecta.com`
- Test credentials available upon request
- Webhook testing endpoint: `https://test-api.ordendirecta.com/webhook-test`

### Postman Collection

A complete Postman collection is available for testing all endpoints:
[Download Postman Collection](https://api.ordendirecta.com/docs/postman-collection.json)

---

## Support

For API support and questions:
- Email: api-support@ordendirecta.com
- Developer Portal: https://developers.ordendirecta.com
- Status Page: https://status.ordendirecta.com