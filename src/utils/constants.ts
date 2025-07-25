// Currency constants
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  CAD = 'CAD',
  AUD = 'AUD',
  JPY = 'JPY',
  CNY = 'CNY',
  BRL = 'BRL',
  MXN = 'MXN',
  INR = 'INR',
  KRW = 'KRW',
  SGD = 'SGD',
  HKD = 'HKD',
  NOK = 'NOK',
  SEK = 'SEK',
  DKK = 'DKK',
  CHF = 'CHF',
  PLN = 'PLN',
  CZK = 'CZK',
  HUF = 'HUF',
  ILS = 'ILS',
  NZD = 'NZD',
  ZAR = 'ZAR',
  THB = 'THB',
  MYR = 'MYR',
  PHP = 'PHP',
  IDR = 'IDR',
  VND = 'VND',
  TRY = 'TRY',
  RUB = 'RUB',
  AED = 'AED',
  SAR = 'SAR',
  EGP = 'EGP',
  MAD = 'MAD',
  NGN = 'NGN',
  KES = 'KES',
  GHS = 'GHS',
  // Note: CUP is intentionally excluded as per requirements
}

// User roles
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  SELLER = 'SELLER',
  CUSTOMER = 'CUSTOMER',
  GUEST = 'GUEST'
}

// Order status
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  RETURNED = 'RETURNED'
}

// Payment status
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

// Product status
export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
  OUT_OF_STOCK = 'OUT_OF_STOCK'
}

// Seller status
export enum SellerStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED'
}

// Coupon discount types
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING',
  BUY_X_GET_Y = 'BUY_X_GET_Y'
}

// Review status
export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED'
}

// Notification types
export enum NotificationType {
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PRODUCT_BACK_IN_STOCK = 'PRODUCT_BACK_IN_STOCK',
  PRICE_DROP = 'PRICE_DROP',
  REVIEW_REQUEST = 'REVIEW_REQUEST',
  SELLER_APPLICATION = 'SELLER_APPLICATION',
  COUPON_EXPIRING = 'COUPON_EXPIRING',
  FLASH_SALE_STARTING = 'FLASH_SALE_STARTING',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE'
}

// Shipping status
export enum ShippingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETURNED = 'RETURNED'
}

// Support ticket status
export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_CUSTOMER = 'PENDING_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

// Support ticket priority
export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL'
}

// Return request status
export enum ReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Return request type
export enum ReturnType {
  RETURN = 'RETURN',
  EXCHANGE = 'EXCHANGE',
  REFUND = 'REFUND'
}

// Refund status
export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Payout status
export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Payout method
export enum PayoutMethod {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

// Transaction type
export enum TransactionType {
  ORDER_PAYMENT = 'ORDER_PAYMENT',
  PAYOUT = 'PAYOUT',
  COMMISSION_FEE = 'COMMISSION_FEE'
}

// PlatformAnalytics event types
export enum AnalyticsEventType {
  PAGE_VIEW = 'PAGE_VIEW',
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  CART_ADD = 'CART_ADD',
  CART_REMOVE = 'CART_REMOVE',
  CHECKOUT_START = 'CHECKOUT_START',
  CHECKOUT_COMPLETE = 'CHECKOUT_COMPLETE',
  PURCHASE = 'PURCHASE',
  SEARCH = 'SEARCH',
  REVIEW_SUBMIT = 'REVIEW_SUBMIT',
  COUPON_APPLY = 'COUPON_APPLY',
  WISHLIST_ADD = 'WISHLIST_ADD'
}

// File upload types
export enum FileUploadType {
  PRODUCT_IMAGE = 'PRODUCT_IMAGE',
  SELLER_LOGO = 'SELLER_LOGO',
  SELLER_BANNER = 'SELLER_BANNER',
  USER_AVATAR = 'USER_AVATAR',
  CATEGORY_IMAGE = 'CATEGORY_IMAGE',
  REVIEW_IMAGE = 'REVIEW_IMAGE',
  DOCUMENT = 'DOCUMENT',
  BANNER = 'BANNER'
}

// API rate limits
export const RATE_LIMITS = {
  GUEST: {
    requests: 100,
    window: '15 minutes'
  },
  CUSTOMER: {
    requests: 1000,
    window: '15 minutes'
  },
  SELLER: {
    requests: 2000,
    window: '15 minutes'
  },
  ADMIN: {
    requests: 5000,
    window: '15 minutes'
  }
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Search constants
export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 100,
  DEFAULT_FUZZY_DISTANCE: 2,
  TYPO_TOLERANCE: true
};

// Image upload constants
export const IMAGE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  MAX_IMAGES_PER_PRODUCT: 10,
  THUMBNAIL_SIZE: 300,
  MEDIUM_SIZE: 600,
  LARGE_SIZE: 1200
};

// Cache TTL (in seconds)
export const CACHE_TTL = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 30 * 60, // 30 minutes
  LONG: 60 * 60, // 1 hour
  VERY_LONG: 24 * 60 * 60 // 24 hours
};

// Email templates
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  EMAIL_VERIFICATION: 'email-verification',
  PASSWORD_RESET: 'password-reset',
  ORDER_CONFIRMATION: 'order-confirmation',
  ORDER_SHIPPED: 'order-shipped',
  ORDER_DELIVERED: 'order-delivered',
  SELLER_APPLICATION: 'seller-application',
  REVIEW_REQUEST: 'review-request',
  COUPON_CODE: 'coupon-code'
};

// System limits
export const SYSTEM_LIMITS = {
  MAX_CART_ITEMS: 100,
  MAX_WISHLIST_ITEMS: 500,
  MAX_ADDRESSES_PER_USER: 10,
  MAX_PAYMENT_METHODS_PER_USER: 5,
  MAX_CATEGORIES_DEPTH: 5,
  MAX_PRODUCT_VARIANTS: 100,
  MAX_COUPON_USAGE_PER_USER: 10,
  MAX_REVIEW_IMAGES: 5,
  MAX_SUPPORT_ATTACHMENTS: 5
};

// Fraud detection thresholds
export const FRAUD_THRESHOLDS = {
  VELOCITY_ORDERS: 5, // Max orders per hour
  VELOCITY_AMOUNT: 10000, // Max amount per hour
  HIGH_RISK_COUNTRIES: ['XX'], // Country codes
  SUSPICIOUS_EMAIL_PATTERNS: [
    /^[a-z0-9]{10,}@[a-z0-9]{5,}\.[a-z]{2,}$/i, // Random looking emails
    /disposable/i,
    /temp/i,
    /fake/i
  ],
  MAX_FAILED_PAYMENTS: 3,
  IP_GEOLOCATION_MISMATCH_THRESHOLD: 1000 // km
};

// Export blocked currencies (as per requirements)
export const BLOCKED_CURRENCIES = ['CUP']; // Cuban Peso blocked due to no payment processor support

// Default currency
export const DEFAULT_CURRENCY = Currency.USD;

// Supported locales
export const SUPPORTED_LOCALES = [
  'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 
  'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'ru-RU', 'hi-IN'
];

// Default locale
export const DEFAULT_LOCALE = 'en-US';

// API versioning
export const API_VERSION = 'v1';

// JWT token expiration
export const JWT_EXPIRATION = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
  RESET_TOKEN: '1h',
  EMAIL_VERIFICATION_TOKEN: '24h'
};

// Session configuration
export const SESSION_CONFIG = {
  MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  SECURE: process.env.NODE_ENV === 'production',
  HTTP_ONLY: true,
  SAME_SITE: 'strict' as const
};

// CORS configuration
export const CORS_CONFIG = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-request-id',
    'x-trace-id',
    'x-correlation-id',
    'x-api-key'
  ]
};

// Health check intervals
export const HEALTH_CHECK = {
  DATABASE_TIMEOUT: 5000, // 5 seconds
  REDIS_TIMEOUT: 3000, // 3 seconds
  EXTERNAL_SERVICE_TIMEOUT: 10000 // 10 seconds
};

// Webhook retry configuration
export const WEBHOOK_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  TIMEOUT: 30000 // 30 seconds
};

// Export all constants as default
export default {
  Currency,
  UserRole,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  SellerStatus,
  DiscountType,
  ReviewStatus,
  NotificationType,
  ShippingStatus,
  TicketStatus,
  TicketPriority,
  ReturnStatus,
  ReturnType,
  RefundStatus,
  PayoutStatus,
  PayoutMethod,
  TransactionType,
  AnalyticsEventType,
  FileUploadType,
  RATE_LIMITS,
  PAGINATION,
  SEARCH,
  IMAGE_UPLOAD,
  CACHE_TTL,
  EMAIL_TEMPLATES,
  SYSTEM_LIMITS,
  FRAUD_THRESHOLDS,
  BLOCKED_CURRENCIES,
  DEFAULT_CURRENCY,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  API_VERSION,
  JWT_EXPIRATION,
  SESSION_CONFIG,
  CORS_CONFIG,
  HEALTH_CHECK,
  WEBHOOK_CONFIG
};