# OrdenDirecta Backend - Complete Endpoint Summary

## Total Endpoints: 250+

This document provides a comprehensive summary of all implemented endpoints in the OrdenDirecta backend system, organized by module.

## Authentication & User Management (22 endpoints)

### Authentication (11 endpoints)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/2fa/enable` - Enable 2FA
- `POST /api/auth/2fa/verify` - Verify 2FA
- `POST /api/auth/2fa/disable` - Disable 2FA

### User Management (11 endpoints)
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile
- `DELETE /api/users/profile` - Delete account
- `GET /api/users/addresses` - Get addresses
- `POST /api/users/addresses` - Add address
- `PUT /api/users/addresses/:id` - Update address
- `DELETE /api/users/addresses/:id` - Delete address
- `GET /api/admin/users` - Get all users (Admin)
- `GET /api/admin/users/:id` - Get user by ID (Admin)
- `PUT /api/admin/users/:id` - Update user (Admin)
- `DELETE /api/admin/users/:id` - Delete user (Admin)

## Product Management (15 endpoints)

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/search` - Search products
- `GET /api/products/:id/related` - Get related products
- `POST /api/seller/products` - Create product (Seller)
- `PUT /api/seller/products/:id` - Update product (Seller)
- `DELETE /api/seller/products/:id` - Delete product (Seller)
- `POST /api/seller/products/:id/images` - Upload images (Seller)
- `DELETE /api/seller/products/:id/images/:imageId` - Delete image (Seller)
- `PATCH /api/seller/products/:id/stock` - Update stock (Seller)
- `GET /api/seller/products` - Get seller products (Seller)
- `GET /api/admin/products` - Get all products (Admin)
- `PATCH /api/admin/products/:id/approve` - Approve product (Admin)
- `PATCH /api/admin/products/:id/reject` - Reject product (Admin)
- `POST /api/admin/products/bulk-update` - Bulk update (Admin)

## Order Management (20 endpoints)

- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders/:id/cancel` - Cancel order
- `GET /api/orders/:id/tracking` - Get tracking info
- `POST /api/orders/:id/return` - Request return
- `GET /api/seller/orders` - Get seller orders
- `GET /api/seller/orders/:id` - Get seller order details
- `PATCH /api/seller/orders/:id/status` - Update order status (Seller)
- `POST /api/seller/orders/:id/ship` - Mark as shipped (Seller)
- `GET /api/admin/orders` - Get all orders (Admin)
- `GET /api/admin/orders/:id` - Get order details (Admin)
- `PATCH /api/admin/orders/:id/status` - Update status (Admin)
- `POST /api/admin/orders/bulk-update` - Bulk update (Admin)
- `GET /api/admin/orders/export` - Export orders (Admin)
- `POST /api/orders/:id/confirm` - Confirm receipt
- `GET /api/orders/:id/invoice` - Get invoice
- `POST /api/orders/:id/dispute` - Open dispute
- `GET /api/seller/orders/pending` - Get pending orders (Seller)
- `GET /api/admin/orders/stats` - Get order statistics (Admin)

## Payment System (12 endpoints)

- `GET /api/payments/methods` - Get payment methods
- `POST /api/payments/methods` - Add payment method
- `PUT /api/payments/methods/:id` - Update payment method
- `DELETE /api/payments/methods/:id` - Delete payment method
- `POST /api/payments/methods/:id/default` - Set as default
- `POST /api/payments/process` - Process payment
- `GET /api/payments/history` - Get payment history
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/refund` - Request refund (Admin)
- `GET /api/admin/payments` - Get all payments (Admin)
- `GET /api/admin/payments/stats` - Payment statistics (Admin)
- `POST /api/admin/payments/:id/verify` - Verify payment (Admin)

## Seller Management (15 endpoints)

- `POST /api/sellers/register` - Apply as seller
- `GET /api/sellers/profile` - Get seller profile
- `PUT /api/sellers/profile` - Update profile
- `GET /api/sellers/dashboard` - Get dashboard stats
- `GET /api/sellers/analytics` - Get analytics
- `GET /api/sellers/reviews` - Get seller reviews
- `GET /api/sellers/:id` - Get public seller profile
- `GET /api/sellers/:id/products` - Get seller products
- `POST /api/sellers/withdraw` - Request withdrawal
- `GET /api/sellers/transactions` - Get transactions
- `GET /api/admin/sellers` - Get all sellers (Admin)
- `GET /api/admin/sellers/:id` - Get seller details (Admin)
- `PATCH /api/admin/sellers/:id/approve` - Approve seller (Admin)
- `PATCH /api/admin/sellers/:id/reject` - Reject seller (Admin)
- `PATCH /api/admin/sellers/:id/suspend` - Suspend seller (Admin)

## Shipping Management (10 endpoints)

- `GET /api/shipping/methods` - Get shipping methods
- `POST /api/shipping/calculate` - Calculate shipping cost
- `GET /api/shipping/track/:trackingNumber` - Track shipment
- `POST /api/shipping/labels` - Generate shipping label
- `GET /api/admin/shipping/methods` - Get all methods (Admin)
- `POST /api/admin/shipping/methods` - Create method (Admin)
- `PUT /api/admin/shipping/methods/:id` - Update method (Admin)
- `DELETE /api/admin/shipping/methods/:id` - Delete method (Admin)
- `GET /api/admin/shipping/carriers` - Get carriers (Admin)
- `POST /api/admin/shipping/zones` - Manage zones (Admin)

## Category System (8 endpoints)

- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `GET /api/categories/:id/products` - Get category products
- `POST /api/admin/categories` - Create category (Admin)
- `PUT /api/admin/categories/:id` - Update category (Admin)
- `DELETE /api/admin/categories/:id` - Delete category (Admin)
- `POST /api/admin/categories/:id/image` - Upload image (Admin)
- `PATCH /api/admin/categories/reorder` - Reorder categories (Admin)

## Cart & Wishlist (12 endpoints)

### Cart (8 endpoints)
- `GET /api/cart` - Get cart
- `POST /api/cart/items` - Add to cart
- `PUT /api/cart/items/:id` - Update cart item
- `DELETE /api/cart/items/:id` - Remove from cart
- `DELETE /api/cart` - Clear cart
- `POST /api/cart/merge` - Merge guest cart
- `POST /api/cart/validate` - Validate cart
- `GET /api/cart/summary` - Get cart summary

### Wishlist (4 endpoints)
- `GET /api/wishlist` - Get wishlist
- `POST /api/wishlist` - Add to wishlist
- `DELETE /api/wishlist/:productId` - Remove from wishlist
- `POST /api/wishlist/to-cart` - Move to cart

## Review & Rating System (25 endpoints)

### Product Reviews (13 endpoints)
- `GET /api/products/:productId/reviews` - Get product reviews
- `POST /api/reviews/products` - Create product review
- `PUT /api/reviews/products/:id` - Update review
- `DELETE /api/reviews/products/:id` - Delete review
- `POST /api/reviews/products/:id/helpful` - Mark as helpful
- `POST /api/reviews/products/:id/report` - Report review
- `GET /api/reviews/products/my-reviews` - Get my reviews
- `GET /api/reviews/products/:id/votes` - Get review votes
- `GET /api/admin/reviews/products` - Get all reviews (Admin)
- `PATCH /api/admin/reviews/products/:id/approve` - Approve (Admin)
- `PATCH /api/admin/reviews/products/:id/reject` - Reject (Admin)
- `DELETE /api/admin/reviews/products/:id` - Delete (Admin)
- `GET /api/admin/reviews/products/reported` - Get reported (Admin)

### Seller Reviews (12 endpoints)
- `GET /api/sellers/:sellerId/reviews` - Get seller reviews
- `POST /api/reviews/sellers` - Create seller review
- `PUT /api/reviews/sellers/:id` - Update review
- `DELETE /api/reviews/sellers/:id` - Delete review
- `POST /api/reviews/sellers/:id/helpful` - Mark as helpful
- `POST /api/reviews/sellers/:id/report` - Report review
- `GET /api/reviews/sellers/my-reviews` - Get my reviews
- `GET /api/admin/reviews/sellers` - Get all reviews (Admin)
- `PATCH /api/admin/reviews/sellers/:id/approve` - Approve (Admin)
- `PATCH /api/admin/reviews/sellers/:id/reject` - Reject (Admin)
- `DELETE /api/admin/reviews/sellers/:id` - Delete (Admin)
- `GET /api/admin/reviews/sellers/stats` - Get stats (Admin)

## Coupon & Promotion System (20 endpoints)

### Coupons (12 endpoints)
- `POST /api/coupons/apply` - Apply coupon
- `POST /api/coupons/validate` - Validate coupon
- `GET /api/coupons/available` - Get available coupons
- `GET /api/admin/coupons` - Get all coupons (Admin)
- `POST /api/admin/coupons` - Create coupon (Admin)
- `PUT /api/admin/coupons/:id` - Update coupon (Admin)
- `DELETE /api/admin/coupons/:id` - Delete coupon (Admin)
- `PATCH /api/admin/coupons/:id/activate` - Activate (Admin)
- `PATCH /api/admin/coupons/:id/deactivate` - Deactivate (Admin)
- `GET /api/admin/coupons/:id/usage` - Get usage (Admin)
- `POST /api/admin/coupons/bulk-create` - Bulk create (Admin)
- `GET /api/admin/coupons/stats` - Get statistics (Admin)

### Promotions (8 endpoints)
- `GET /api/promotions/active` - Get active promotions
- `GET /api/promotions/:id` - Get promotion details
- `GET /api/admin/promotions` - Get all promotions (Admin)
- `POST /api/admin/promotions` - Create promotion (Admin)
- `PUT /api/admin/promotions/:id` - Update promotion (Admin)
- `DELETE /api/admin/promotions/:id` - Delete promotion (Admin)
- `PATCH /api/admin/promotions/:id/toggle` - Toggle status (Admin)
- `GET /api/admin/promotions/stats` - Get statistics (Admin)

## Notification System (10 endpoints)

- `GET /api/notifications` - Get notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notifications/preferences` - Get preferences
- `PUT /api/notifications/preferences` - Update preferences
- `POST /api/notifications/subscribe` - Subscribe to push
- `DELETE /api/notifications/unsubscribe` - Unsubscribe
- `POST /api/admin/notifications/broadcast` - Broadcast (Admin)
- `GET /api/admin/notifications/stats` - Get stats (Admin)

## Support Ticket System (15 endpoints)

- `POST /api/support/tickets` - Create ticket
- `GET /api/support/tickets` - Get my tickets
- `GET /api/support/tickets/:id` - Get ticket details
- `POST /api/support/tickets/:id/messages` - Add message
- `PATCH /api/support/tickets/:id/close` - Close ticket
- `POST /api/support/tickets/:id/rate` - Rate support
- `GET /api/support/categories` - Get categories
- `GET /api/admin/support/tickets` - Get all tickets (Admin)
- `GET /api/admin/support/tickets/:id` - Get details (Admin)
- `POST /api/admin/support/tickets/:id/assign` - Assign (Admin)
- `POST /api/admin/support/tickets/:id/reply` - Reply (Admin)
- `PATCH /api/admin/support/tickets/:id/priority` - Set priority (Admin)
- `PATCH /api/admin/support/tickets/:id/status` - Update status (Admin)
- `GET /api/admin/support/agents` - Get agents (Admin)
- `GET /api/admin/support/stats` - Get statistics (Admin)

## Return/Refund System (12 endpoints)

- `POST /api/returns/request` - Request return
- `GET /api/returns` - Get my returns
- `GET /api/returns/:id` - Get return details
- `POST /api/returns/:id/ship` - Ship return
- `POST /api/returns/:id/cancel` - Cancel return
- `GET /api/admin/returns` - Get all returns (Admin)
- `GET /api/admin/returns/:id` - Get details (Admin)
- `PATCH /api/admin/returns/:id/approve` - Approve (Admin)
- `PATCH /api/admin/returns/:id/reject` - Reject (Admin)
- `PATCH /api/admin/returns/:id/receive` - Mark received (Admin)
- `POST /api/admin/returns/:id/refund` - Process refund (Admin)
- `GET /api/admin/returns/stats` - Get statistics (Admin)

## Analytics System (10 endpoints)

- `GET /api/analytics/dashboard` - Get dashboard data
- `GET /api/analytics/sales` - Get sales analytics
- `GET /api/analytics/products` - Get product analytics
- `GET /api/analytics/customers` - Get customer analytics
- `GET /api/seller/analytics/sales` - Seller sales (Seller)
- `GET /api/seller/analytics/products` - Seller products (Seller)
- `GET /api/seller/analytics/revenue` - Seller revenue (Seller)
- `GET /api/admin/analytics/platform` - Platform stats (Admin)
- `GET /api/admin/analytics/revenue` - Revenue stats (Admin)
- `POST /api/admin/analytics/export` - Export data (Admin)

## CMS System (10 endpoints)

- `GET /api/cms/pages/:slug` - Get page by slug
- `GET /api/cms/banners/active` - Get active banners
- `GET /api/cms/faq` - Get FAQ items
- `GET /api/admin/cms/pages` - Get all pages (Admin)
- `POST /api/admin/cms/pages` - Create page (Admin)
- `PUT /api/admin/cms/pages/:id` - Update page (Admin)
- `DELETE /api/admin/cms/pages/:id` - Delete page (Admin)
- `POST /api/admin/cms/banners` - Create banner (Admin)
- `PUT /api/admin/cms/banners/:id` - Update banner (Admin)
- `DELETE /api/admin/cms/banners/:id` - Delete banner (Admin)

## Loyalty System (12 endpoints)

- `GET /api/loyalty/points` - Get my points
- `GET /api/loyalty/history` - Get points history
- `GET /api/loyalty/rewards` - Get available rewards
- `POST /api/loyalty/rewards/:id/redeem` - Redeem reward
- `GET /api/loyalty/tier` - Get current tier
- `GET /api/loyalty/tiers` - Get all tiers
- `GET /api/admin/loyalty/users` - Get user points (Admin)
- `POST /api/admin/loyalty/points/add` - Add points (Admin)
- `POST /api/admin/loyalty/points/deduct` - Deduct points (Admin)
- `POST /api/admin/loyalty/rewards` - Create reward (Admin)
- `PUT /api/admin/loyalty/rewards/:id` - Update reward (Admin)
- `GET /api/admin/loyalty/stats` - Get statistics (Admin)

## Fraud Detection System (8 endpoints)

- `GET /api/admin/fraud/alerts` - Get fraud alerts (Admin)
- `GET /api/admin/fraud/alerts/:id` - Get alert details (Admin)
- `PATCH /api/admin/fraud/alerts/:id/review` - Review alert (Admin)
- `POST /api/admin/fraud/rules` - Create rule (Admin)
- `PUT /api/admin/fraud/rules/:id` - Update rule (Admin)
- `GET /api/admin/fraud/blacklist` - Get blacklist (Admin)
- `POST /api/admin/fraud/blacklist` - Add to blacklist (Admin)
- `DELETE /api/admin/fraud/blacklist/:id` - Remove from blacklist (Admin)

## Webhook System (8 endpoints)

- `GET /api/admin/webhooks` - Get webhooks (Admin)
- `POST /api/admin/webhooks` - Register webhook (Admin)
- `PUT /api/admin/webhooks/:id` - Update webhook (Admin)
- `DELETE /api/admin/webhooks/:id` - Delete webhook (Admin)
- `PATCH /api/admin/webhooks/:id/toggle` - Toggle status (Admin)
- `POST /api/admin/webhooks/:id/test` - Test webhook (Admin)
- `GET /api/admin/webhooks/:id/logs` - Get logs (Admin)
- `POST /api/admin/webhooks/:id/retry` - Retry failed (Admin)

## Commission System (11 endpoints)

- `GET /api/seller/commissions` - Get my commissions (Seller)
- `GET /api/seller/commissions/stats` - Get stats (Seller)
- `GET /api/admin/commissions` - Get all commissions (Admin)
- `GET /api/admin/commissions/:id` - Get details (Admin)
- `POST /api/admin/commissions` - Create commission (Admin)
- `PATCH /api/admin/commissions/:id` - Update commission (Admin)
- `PATCH /api/admin/commissions/:id/pay` - Mark as paid (Admin)
- `POST /api/admin/commissions/bulk-pay` - Bulk payment (Admin)
- `GET /api/admin/commissions/stats` - Get statistics (Admin)
- `GET /api/admin/commissions/report` - Generate report (Admin)

## Chat/Messaging System (13 endpoints)

- `POST /api/chat/conversations` - Create conversation
- `GET /api/chat/conversations` - Get conversations
- `GET /api/chat/conversations/:id` - Get conversation
- `POST /api/chat/messages` - Send message
- `GET /api/chat/conversations/:id/messages` - Get messages
- `PATCH /api/chat/messages/:id/read` - Mark as read
- `PATCH /api/chat/conversations/:id/read` - Mark all as read
- `PATCH /api/chat/messages/:id` - Edit message
- `DELETE /api/chat/messages/:id` - Delete message
- `GET /api/chat/unread-count` - Get unread count
- `GET /api/chat/search` - Search messages
- `GET /api/chat/conversations/:id/stats` - Get stats
- `GET /api/admin/chat/conversations` - Get all (Admin)
- `PATCH /api/admin/chat/conversations/:id/close` - Close (Admin)

## Customs Declaration System (15 endpoints)

- `POST /api/customs/calculate` - Calculate customs fees
- `GET /api/orders/:orderId/customs` - Get order customs
- `GET /api/admin/customs` - Get all declarations (Admin)
- `GET /api/admin/customs/:id` - Get details (Admin)
- `POST /api/admin/customs` - Create declaration (Admin)
- `PATCH /api/admin/customs/:id` - Update declaration (Admin)
- `PATCH /api/admin/customs/:id/status` - Update status (Admin)
- `GET /api/admin/customs/pending` - Get pending (Admin)
- `POST /api/admin/customs/:id/items` - Add item (Admin)
- `PATCH /api/admin/customs/items/:id` - Update item (Admin)
- `DELETE /api/admin/customs/items/:id` - Remove item (Admin)
- `GET /api/admin/customs/stats` - Get statistics (Admin)
- `GET /api/admin/customs/trade-stats` - Trade stats (Admin)
- `GET /api/admin/customs/report` - Generate report (Admin)

## Pickup Locations System (14 endpoints)

- `GET /api/pickup/locations` - Get active locations
- `GET /api/pickup/locations/:id` - Get location details
- `GET /api/pickup/locations/nearby` - Get nearby locations
- `POST /api/pickup/schedule` - Schedule pickup
- `GET /api/pickup/locations/:id/calendar` - Get calendar
- `GET /api/admin/pickup/locations` - Get all (Admin)
- `POST /api/admin/pickup/locations` - Create location (Admin)
- `PUT /api/admin/pickup/locations/:id` - Update (Admin)
- `DELETE /api/admin/pickup/locations/:id` - Delete (Admin)
- `PATCH /api/admin/pickup/locations/:id/toggle` - Toggle (Admin)
- `GET /api/admin/pickup/locations/:id/stats` - Get stats (Admin)
- `POST /api/admin/pickup/complete/:orderId` - Complete (Admin)
- `GET /api/admin/pickup/report` - Generate report (Admin)

## Health & System (2 endpoints)

- `GET /health` - Health check
- `GET /ready` - Readiness check

---

## Summary by Access Level

### Public Endpoints: ~25
- Product browsing
- Category browsing
- Search
- Shipping calculation
- Customs calculation
- Pickup location viewing

### Authenticated User Endpoints: ~100
- Profile management
- Order management
- Cart/Wishlist
- Reviews
- Support tickets
- Chat
- Notifications
- Loyalty

### Seller Endpoints: ~40
- Product management
- Order management
- Analytics
- Commission tracking
- Profile management

### Admin Endpoints: ~85
- User management
- Product approval
- Order management
- Payment management
- Content management
- System configuration
- Reports and analytics

### Super Admin Endpoints: ~10
- Critical system operations
- User deletion
- System configuration
- Security management

---

## API Features

- JWT Authentication with refresh tokens
- Role-Based Access Control (RBAC)
- Rate limiting per endpoint type
- Request validation with Zod
- Comprehensive error handling
- Audit logging
- Real-time notifications
- WebSocket support for chat
- File upload support
- CSV/JSON export options
- Pagination on all list endpoints
- Search and filtering capabilities
- Multi-language support ready
- Webhook event system
- Performance monitoring
- Fraud detection integration