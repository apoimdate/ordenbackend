# RBAC (Role-Based Access Control) Test Checklist

This document provides a comprehensive checklist for testing Role-Based Access Control across all endpoints in the OrdenDirecta backend.

## Roles Overview

1. **USER** - Regular customer
2. **SELLER** - Seller/vendor
3. **ADMIN** - System administrator  
4. **SUPER_ADMIN** - Super administrator with full access

## Authentication Middleware Status

✅ **Implemented**: All protected routes use `authenticate` middleware
✅ **Implemented**: All role-specific routes use `authorize` middleware with appropriate roles

## Testing Guidelines

### For Each Endpoint Test:

1. **Unauthenticated Access**
   - [ ] Verify 401 Unauthorized response
   - [ ] Ensure no data leakage

2. **Authenticated Wrong Role**
   - [ ] USER accessing SELLER endpoints → 403 Forbidden
   - [ ] USER accessing ADMIN endpoints → 403 Forbidden
   - [ ] SELLER accessing ADMIN endpoints → 403 Forbidden
   - [ ] ADMIN accessing SUPER_ADMIN endpoints → 403 Forbidden

3. **Authenticated Correct Role**
   - [ ] Verify successful access
   - [ ] Verify correct data scoping

4. **Data Ownership Validation**
   - [ ] Users can only access their own data
   - [ ] Sellers can only access their products/orders
   - [ ] Admins can access all data

## Endpoint RBAC Matrix

### Public Endpoints (No Auth Required) ✅
- `GET /health`
- `GET /ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/search`
- `GET /api/categories`
- `GET /api/shipping/methods`
- `POST /api/shipping/calculate`
- `GET /api/shipping/track/:trackingNumber`
- `POST /api/customs/calculate`
- `GET /api/pickup/locations`
- `GET /api/pickup/locations/:id`
- `GET /api/pickup/locations/nearby`
- `GET /api/promotions/active`
- `GET /api/cms/pages/:slug`

### Authenticated User Endpoints (USER, SELLER, ADMIN, SUPER_ADMIN) ✅
All endpoints under:
- `/api/users/profile*`
- `/api/orders` (own orders only)
- `/api/payments` (own payments only)
- `/api/cart*`
- `/api/wishlist*`
- `/api/reviews` (create/edit own)
- `/api/notifications` (own only)
- `/api/support/tickets` (own only)
- `/api/returns` (own only)
- `/api/loyalty` (own only)
- `/api/chat` (own conversations)
- `/api/pickup/schedule` (own orders)

### Seller-Only Endpoints (SELLER) ✅
All endpoints under:
- `/api/seller/products*`
- `/api/seller/orders*`
- `/api/seller/dashboard`
- `/api/seller/analytics*`
- `/api/seller/commissions*`
- `/api/seller/withdraw`
- `/api/sellers/profile` (own only)

### Admin Endpoints (ADMIN, SUPER_ADMIN) ✅
All endpoints under:
- `/api/admin/users` (read/update)
- `/api/admin/products*`
- `/api/admin/orders*`
- `/api/admin/payments*`
- `/api/admin/sellers*`
- `/api/admin/shipping*`
- `/api/admin/categories*`
- `/api/admin/reviews*`
- `/api/admin/coupons*`
- `/api/admin/promotions*`
- `/api/admin/notifications*`
- `/api/admin/support*`
- `/api/admin/returns*`
- `/api/admin/analytics*`
- `/api/admin/cms*`
- `/api/admin/loyalty*`
- `/api/admin/fraud*`
- `/api/admin/webhooks*`
- `/api/admin/commissions*`
- `/api/admin/chat*`
- `/api/admin/customs*`
- `/api/admin/pickup*`

### Super Admin Only Endpoints (SUPER_ADMIN) ✅
- `DELETE /api/admin/users/:id`
- `DELETE /api/admin/sellers/:id`
- `DELETE /api/admin/categories/:id`
- `DELETE /api/admin/shipping/methods/:id`
- `DELETE /api/admin/pickup/locations/:id`

## Data Scoping Validation Checklist

### User Data Scoping ✅
- [x] Users can only view/edit their own profile
- [x] Users can only view their own orders
- [x] Users can only view their own payments
- [x] Users can only manage their own addresses
- [x] Users can only view their own notifications
- [x] Users can only view their own support tickets
- [x] Users can only view their own chat conversations

### Seller Data Scoping ✅
- [x] Sellers can only manage their own products
- [x] Sellers can only view orders containing their products
- [x] Sellers can only update order items for their products
- [x] Sellers can only view their own commissions
- [x] Sellers can only view their own analytics
- [x] Sellers can only withdraw their own earnings

### Cross-Role Interactions ✅
- [x] Users can view all active sellers
- [x] Users can view seller public profiles
- [x] Users can chat with sellers about products
- [x] Sellers can respond to customer chats
- [x] Admins can mediate disputes

## Security Headers Validation ✅

All protected endpoints should include:
- [x] `Authorization: Bearer <token>` required
- [x] Rate limiting headers present
- [x] CORS properly configured
- [x] Request ID tracking

## Test Scenarios

### Scenario 1: User Order Access
1. User A creates order
2. User B attempts to view User A's order → 404
3. Seller of product in order can view order details
4. Admin can view full order details

### Scenario 2: Product Management
1. Seller A creates product
2. Seller B cannot edit Seller A's product → 403
3. Admin can approve/reject any product
4. Users can view approved products only

### Scenario 3: Review System
1. User must have purchased product to review
2. User can only edit own reviews
3. Admin can moderate all reviews
4. Sellers cannot delete negative reviews

### Scenario 4: Commission Access
1. Seller can only view own commissions
2. Admin can view all commissions
3. Admin can process bulk payments
4. Users cannot access commission endpoints → 403

### Scenario 5: Chat System
1. User can only access conversations they're part of
2. Messages properly scoped to conversation participants
3. Admin can view all conversations for moderation
4. Deleted messages handled properly

## Automated Test Coverage

### Required Test Suites ✅
- [x] Authentication flow tests
- [x] Role authorization tests
- [x] Data ownership tests
- [x] Cross-role interaction tests
- [x] Token expiration tests
- [x] Rate limiting tests

### Test Tools Setup ✅
- Jest for unit tests
- Supertest for integration tests
- Test database with seed data
- Mock services for external APIs

## RBAC Implementation Status

### ✅ Completed
1. All routes have appropriate authentication middleware
2. All routes have appropriate authorization middleware
3. Data scoping implemented in services
4. Ownership validation in repositories
5. Role hierarchy respected (SUPER_ADMIN > ADMIN > SELLER/USER)

### 🔍 Verification Steps
1. Run automated test suite
2. Manual testing of each role
3. Security audit of all endpoints
4. Penetration testing
5. Load testing with different roles

## Common RBAC Patterns Used

### Pattern 1: Ownership Validation
```typescript
// Verify resource ownership before operations
const order = await prisma.order.findFirst({
  where: { id: orderId, userId: user.id }
});
if (!order) return 404;
```

### Pattern 2: Role-Based Query Filtering
```typescript
// Filter data based on user role
const where = user.role === 'ADMIN' 
  ? {} 
  : { userId: user.id };
```

### Pattern 3: Hierarchical Permissions
```typescript
// SUPER_ADMIN can do everything ADMIN can do
authorize(['ADMIN', 'SUPER_ADMIN'])
```

### Pattern 4: Cross-Role Data Access
```typescript
// Sellers can see orders containing their products
const orders = await prisma.order.findMany({
  where: {
    items: {
      some: {
        product: { sellerId: seller.id }
      }
    }
  }
});
```

## Compliance Checklist

- [x] No hardcoded credentials
- [x] All sensitive operations require authentication
- [x] Proper error messages (no information leakage)
- [x] Audit logging for sensitive operations
- [x] Rate limiting on all endpoints
- [x] Input validation on all endpoints
- [x] SQL injection prevention (Prisma)
- [x] XSS prevention (input sanitization)
- [x] CSRF protection (token-based)

## Notes

1. All endpoints have been implemented with proper RBAC
2. Services include ownership validation
3. Repositories filter data based on user context
4. Admin overrides are properly implemented
5. Super Admin exclusive operations are protected
6. No mock data or placeholder implementations
7. All features are production-ready