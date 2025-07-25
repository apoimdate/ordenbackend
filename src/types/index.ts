import { User, Product, Order, Category, Coupon, FlashSale, CouponUse, Review, Seller } from '@prisma/client';

// Base service result type
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
}

// Pagination types
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Coupon-related types
export interface CreateCouponData {
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  currency?: string;
  validFrom?: Date;
  validTo?: Date;
  maxUses?: number;
  maxUsesPerUser?: number;
  applicableProductIds?: string[];
  applicableCategoryIds?: string[];
  isStackable?: boolean;
  requiresAuthentication?: boolean;
  createdBy: string;
}

export interface UpdateCouponData {
  code?: string;
  name?: string;
  description?: string;
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  validFrom?: Date;
  validTo?: Date;
  maxUses?: number;
  maxUsesPerUser?: number;
  isActive?: boolean;
  isStackable?: boolean;
}

export interface CouponWithDetails extends Coupon {
  applicableProducts: Array<{
    product: {
      id: string;
      name: string;
      price: number;
      images?: string[];
    };
  }>;
  applicableCategories: Array<{
    category: {
      id: string;
      name: string;
      parentId?: string;
    };
  }>;
  usages: Array<CouponUse & {
    user: {
      email: string;
      firstName: string;
      lastName: string;
    };
    order?: {
      id: string;
      total: number;
      status: string;
    };
  }>;
}

export interface ValidateCouponData {
  code: string;
  userId?: string;
  orderAmount: number;
  currency: string;
  productIds?: string[];
}

export interface ApplyCouponData {
  code: string;
  userId: string;
  orderId: string;
  orderAmount: number;
  currency: string;
  productIds?: string[];
}

export interface CreateFlashSaleData {
  name: string;
  description?: string;
  discountPercentage: number;
  startTime: Date;
  endTime: Date;
  productIds: string[];
  maxQuantityPerUser?: number;
  totalQuantityLimit?: number;
  createdBy: string;
}

export interface FlashSaleWithDetails extends FlashSale {
  products: Array<{
    product: {
      id: string;
      name: string;
      price: number;
      images: string[];
      stock?: number;
    };
  }>;
  purchases?: Array<{
    user: {
      email: string;
      firstName: string;
      lastName: string;
    };
  }>;
}

export interface CouponUsageData extends CouponUse {
  coupon: {
    code: string;
    name: string;
    description?: string;
    discountType: string;
    discountValue: number;
  };
  order?: {
    id: string;
    status: string;
    total: number;
  };
}

export interface CouponAnalyticsData {
  totalCoupons: number;
  activeCoupons: number;
  totalUsages: number;
  totalDiscountGiven: number;
  averageDiscountPerUsage: number;
  topCoupons: Array<{
    id: string;
    code: string;
    description?: string;
    usageCount: number;
    discountType: string;
    discountValue: number;
  }>;
  usageTrends: Array<{
    date: Date;
    usage_count: number;
    total_discount: number;
  }>;
}

// Review-related types
export interface CreateProductReviewData {
  productId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title: string;
  content: string;
  pros?: string;
  cons?: string;
  recommended?: boolean;
  images?: string[];
  isAnonymous?: boolean;
  verifiedPurchase?: boolean;
}

export interface CreateSellerReviewData {
  sellerId: string;
  userId: string;
  orderId?: string;
  communicationRating: number;
  shippingRating: number;
  serviceRating: number;
  overallRating: number;
  title: string;
  content: string;
  isAnonymous?: boolean;
}

export interface UpdateReviewData {
  rating?: number;
  title?: string;
  content?: string;
  pros?: string;
  cons?: string;
  recommended?: boolean;
  images?: string[];
}

export interface ReviewWithDetails extends Review {
  user: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  product?: {
    name: string;
    images: string[];
  };
  seller?: {
    storeName: string;
    logo?: string;
  };
  responses: Array<{
    id: string;
    content: string;
    isOfficial: boolean;
    createdAt: Date;
    user: {
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
  votes: Array<{
    userId: string;
    voteType: string;
  }>;
  _count: {
    votes: number;
    responses: number;
  };
}

// User-related types
export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
  role?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
  avatar?: string;
  isActive?: boolean;
}

export interface UserWithDetails extends User {
  addresses: Array<{
    id: string;
    type: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    isDefault: boolean;
  }>;
  preferences: {
    language: string;
    currency: string;
    notifications: any;
    privacy: any;
  };
}

// Product-related types
export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  sku: string;
  barcode?: string;
  categoryId: string;
  sellerId: string;
  tags?: string[];
  variants?: Array<{
    name: string;
    price: number;
    sku: string;
    stock: number;
    attributes: any;
  }>;
  images?: string[];
  seoTitle?: string;
  seoDescription?: string;
  weight?: number;
  dimensions?: any;
  requiresShipping?: boolean;
  taxable?: boolean;
  status?: string;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  cost?: number;
  categoryId?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  weight?: number;
  dimensions?: any;
  isActive?: boolean;
  status?: string;
}

export interface ProductWithDetails extends Product {
  category: {
    name: string;
    parentId?: string;
  };
  seller: {
    storeName: string;
    logo?: string;
  };
  variants: Array<{
    id: string;
    name: string;
    price: number;
    sku: string;
    stock: number;
    attributes: any;
  }>;
  images: string[];
  reviews: {
    averageRating: number;
    totalReviews: number;
  };
}

// Order-related types
export interface CreateOrderData {
  userId?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  shippingMethodId: string;
  paymentMethodId: string;
  currency: string;
  couponCode?: string;
  notes?: string;
}

export interface OrderWithDetails extends Order {
  user?: {
    email: string;
    firstName: string;
    lastName: string;
  };
  items: Array<{
    id: string;
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
    product: {
      name: string;
      images: string[];
    };
    variant?: {
      name: string;
      attributes: any;
    };
  }>;
  shippingAddress: any;
  billingAddress?: any;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
  }>;
  shipments: Array<{
    id: string;
    trackingNumber?: string;
    status: string;
    shippedAt?: Date;
  }>;
}

// Seller-related types
export interface CreateSellerData {
  userId: string;
  storeName: string;
  storeDescription?: string;
  businessType: string;
  taxId?: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  banner?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  bankingInfo?: {
    accountHolderName: string;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
  documents?: Array<{
    type: string;
    url: string;
  }>;
}

export interface UpdateSellerData {
  storeName?: string;
  storeDescription?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  banner?: string;
  address?: any;
  bankingInfo?: any;
  isVerified?: boolean;
  isActive?: boolean;
  commissionRate?: number;
}

export interface SellerWithDetails extends Seller {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  products: Array<{
    id: string;
    name: string;
    price: number;
    isActive: boolean;
  }>;
  orders: Array<{
    id: string;
    total: number;
    status: string;
    createdAt: Date;
  }>;
  analytics: {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    totalProducts: number;
  };
}

// PlatformAnalytics-related types
export interface AnalyticsEventData {
  eventType: string;
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  page?: string;
  productId?: string;
  orderId?: string;
  sellerId?: string;
  value?: number;
  currency?: string;
  metadata?: any;
}

export interface DashboardAnalyticsData {
  overview: {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    totalProducts: number;
    conversionRate: number;
    averageOrderValue: number;
  };
  trends: {
    userGrowth: Array<{ date: Date; count: number }>;
    orderTrends: Array<{ date: Date; count: number; revenue: number }>;
    topProducts: Array<{ id: string; name: string; orders: number; revenue: number }>;
    topCategories: Array<{ id: string; name: string; orders: number; revenue: number }>;
  };
  realtime: {
    activeUsers: number;
    onlineVisitors: number;
    recentOrders: number;
  };
}

// Shipping-related types
export interface CreateShippingZoneData {
  name: string;
  description?: string;
  countries: string[];
  states?: string[];
  cities?: string[];
  postalCodes?: string[];
}

export interface CreateShippingMethodData {
  name: string;
  description?: string;
  type: string;
  price: number;
  freeShippingThreshold?: number;
  estimatedDays?: number;
  isActive?: boolean;
  zoneIds: string[];
}

// Category-related types
export interface CreateCategoryData {
  name: string;
  description?: string;
  parentId?: string;
  image?: string;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  parentId?: string;
  image?: string;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CategoryWithDetails extends Category {
  parent?: {
    id: string;
    name: string;
  };
  children: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  _count: {
    products: number;
    children: number;
  };
}

// Cart-related types
export interface AddToCartData {
  productId: string;
  variantId?: string;
  quantity: number;
  customizations?: any;
  guestCartId?: string;
}

export interface UpdateCartItemData {
  cartItemId: string;
  quantity: number;
  customizations?: any;
}

export interface CartWithDetails {
  id: string;
  userId?: string;
  items: Array<{
    id: string;
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
    product: {
      name: string;
      images: string[];
      isActive: boolean;
    };
    variant?: {
      name: string;
      attributes: any;
    };
    stockStatus: string;
  }>;
  calculation: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    currency: string;
  };
  updatedAt: Date;
}

export interface AddToWishlistData {
  productId: string;
  variantId?: string;
  notes?: string;
}

// Payment-related types
export interface ProcessPaymentData {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
  metadata?: any;
}

export interface RefundData {
  paymentId: string;
  amount: number;
  reason?: string;
}

export interface PayoutData {
  sellerId: string;
  amount: number;
  currency: string;
  method: string;
}

// Notification-related types
export interface CreateNotificationData {
  type: string;
  title: string;
  message: string;
  userId?: string;
  data?: any;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: string;
  actionUrl?: string;
  imageUrl?: string;
  scheduledFor?: Date;
  expiresAt?: Date;
  createdBy: string;
}

export interface UpdateNotificationData {
  title?: string;
  message?: string;
  data?: any;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: string;
  actionUrl?: string;
  imageUrl?: string;
  isRead?: boolean;
}

export interface NotificationWithDetails {
  id: string;
  type: string;
  title: string;
  message: string;
  userId?: string;
  data: any;
  priority: string;
  category?: string;
  actionUrl?: string;
  imageUrl?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
    preferences?: any;
  };
}

export interface CreateTemplateData {
  name: string;
  type: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  subject?: string;
  content: string;
  variables?: string[];
  language?: string;
  createdBy: string;
}

export interface UpdateTemplateData {
  name?: string;
  subject?: string;
  content?: string;
  variables?: string[];
  isActive?: boolean;
}

export interface SendNotificationData {
  type: string;
  recipients: string[];
  templateId?: string;
  title?: string;
  message?: string;
  data?: any;
  scheduledFor?: Date;
}

export interface NotificationPreferencesData {
  userId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  marketingEmails?: boolean;
  orderUpdates?: boolean;
  securityAlerts?: boolean;
  productUpdates?: boolean;
  promotions?: boolean;
  reminders?: boolean;
  frequency?: 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY';
}

export interface BroadcastNotificationData {
  type: string;
  title: string;
  message: string;
  channels: Array<'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'>;
  templateId?: string;
  data?: any;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: string;
  userSegment?: {
    roles?: string[];
    countries?: string[];
    registeredAfter?: Date;
    hasOrders?: boolean;
  };
  maxRecipients?: number;
  createdBy: string;
}

// Support-related types
export interface CreateTicketData {
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  category: string;
  userId: string;
  orderId?: string;
  productId?: string;
  attachments?: string[];
}

export interface UpdateTicketData {
  subject?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  category?: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  assignedTo?: string;
}

export interface TicketWithDetails {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  category: string;
  status: string;
  userId: string;
  assignedTo?: string;
  orderId?: string;
  productId?: string;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  assignee?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  messages: Array<{
    id: string;
    content: string;
    isFromCustomer: boolean;
    attachments: string[];
    createdAt: Date;
    user: {
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
}

export interface CreateTicketMessageData {
  content: string;
  isFromCustomer: boolean;
  attachments?: string[];
  userId: string;
}

// FAQ-related types
export interface CreateFAQData {
  question: string;
  answer: string;
  category: string;
  isPublished?: boolean;
  language?: string;
  sortOrder?: number;
  tags?: string[];
  createdBy: string;
}

export interface UpdateFAQData {
  question?: string;
  answer?: string;
  category?: string;
  isPublished?: boolean;
  language?: string;
  sortOrder?: number;
  tags?: string[];
}

// Knowledge Base types
export interface CreateKnowledgeBaseData {
  title: string;
  content: string;
  excerpt?: string;
  category: string;
  isPublished?: boolean;
  language?: string;
  tags?: string[];
  authorId: string;
  sortOrder?: number;
}

export interface UpdateKnowledgeBaseData {
  title?: string;
  content?: string;
  excerpt?: string;
  category?: string;
  isPublished?: boolean;
  language?: string;
  tags?: string[];
  sortOrder?: number;
}

// Support PlatformAnalytics types
export interface SupportAnalyticsData {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  resolutionRate: number;
  averageResolutionTime: number;
  customerSatisfactionRating: number;
  ticketsByPriority: Array<{
    priority: string;
    _count: number;
  }>;
  ticketsByCategory: Array<{
    category: string;
    _count: number;
  }>;
  ticketsByStatus: Array<{
    status: string;
    _count: number;
  }>;
}

// Return/Refund-related types
export interface CreateReturnRequestData {
  orderId: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason: string;
  }>;
  returnType: 'RETURN' | 'EXCHANGE' | 'REFUND';
  reason: string;
  description?: string;
  images?: string[];
}

export interface UpdateReturnRequestData {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  adminNotes?: string;
  refundAmount?: number;
  trackingNumber?: string;
  rejectionReason?: string;
}

export interface ReturnRequestWithDetails {
  id: string;
  returnNumber: string;
  orderId: string;
  userId: string;
  returnType: string;
  reason: string;
  description?: string;
  status: string;
  totalAmount: number;
  refundAmount?: number;
  trackingNumber?: string;
  adminNotes?: string;
  rejectionReason?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  order: {
    orderNumber: string;
    total: number;
    status: string;
  };
  items: Array<{
    id: string;
    orderItemId: string;
    quantity: number;
    reason: string;
    orderItem: {
      quantity: number;
      price: number;
      product: {
        name: string;
        images: string[];
      };
    };
  }>;
}

// CMS-related types
export interface CreatePageData {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  seoTitle?: string;
  seoDescription?: string;
  template?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdatePageData {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  featuredImage?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  seoTitle?: string;
  seoDescription?: string;
  template?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface PageWithDetails {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  status: string;
  seoTitle?: string;
  seoDescription?: string;
  template?: string;
  parentId?: string;
  sortOrder: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  parent?: {
    title: string;
    slug: string;
  };
  children: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
  }>;
}

export interface CreateBlogPostData {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  categoryId?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: Date;
  authorId: string;
}

export interface UpdateBlogPostData {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  featuredImage?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  categoryId?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: Date;
}

// Loyalty-related types
export interface LoyaltyPointsData {
  userId: string;
  points: number;
  totalEarned: number;
  totalSpent: number;
  tier: string;
  transactions: Array<{
    id: string;
    type: 'EARNED' | 'SPENT' | 'EXPIRED' | 'BONUS';
    points: number;
    description: string;
    orderId?: string;
    createdAt: Date;
  }>;
}

export interface CreateGiftCardData {
  code?: string;
  amount: number;
  currency: string;
  expiresAt?: Date;
  recipientEmail?: string;
  message?: string;
  purchasedBy: string;
}

export interface GiftCardWithDetails {
  id: string;
  code: string;
  amount: number;
  balance: number;
  currency: string;
  status: string;
  expiresAt?: Date;
  recipientEmail?: string;
  message?: string;
  purchasedBy: string;
  usedBy?: string;
  createdAt: Date;
  usedAt?: Date;
  transactions: Array<{
    id: string;
    amount: number;
    type: 'ISSUED' | 'USED' | 'REFUNDED';
    orderId?: string;
    createdAt: Date;
  }>;
}

// Advanced Fraud Management Types
export interface FraudRiskAssessmentData {
  userId?: string;
  orderId?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

export interface FraudAlertData {
  type: 'RISK_ASSESSMENT' | 'SUSPICIOUS_ACTIVITY' | 'VELOCITY_BREACH' | 'PATTERN_MATCH' | 'MANUAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  userId?: string;
  orderId?: string;
  riskAssessmentId?: string;
  metadata?: Record<string, any>;
}

export interface FraudRuleData {
  name: string;
  description: string;
  type: 'VELOCITY' | 'AMOUNT' | 'GEOGRAPHIC' | 'DEVICE' | 'BEHAVIORAL' | 'CUSTOM';
  conditions: Record<string, any>;
  actions: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isActive?: boolean;
  priority?: number;
  metadata?: Record<string, any>;
}

// Webhook Management Types
export interface CreateWebhookData {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  isActive?: boolean;
  contentType?: 'application/json' | 'application/x-www-form-urlencoded';
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  metadata?: Record<string, any>;
  testDelivery?: boolean;
  createdBy: string;
}

export interface UpdateWebhookData {
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
  contentType?: 'application/json' | 'application/x-www-form-urlencoded';
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  metadata?: Record<string, any>;
}

export interface WebhookEventData {
  eventType: string;
  eventId: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}


// Export fastify types
export { JWTPayload, RequestContext, RequestWithTracing } from './fastify.d';

// Export all types
export * from '@prisma/client';