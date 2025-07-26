// PRISMA ENUM RE-EXPORTS - Using single source of truth from schema
import { 
  Role as PrismaRole,
  OrderStatus as PrismaOrderStatus,
  PaymentStatus as PrismaPaymentStatus,
  PaymentMethod as PrismaPaymentMethod,
  ProductStatus as PrismaProductStatus,
  ProductType as PrismaProductType,
  SellerStatus as PrismaSellerStatus,
  ReviewStatus as PrismaReviewStatus,
  ShippingMethod as PrismaShippingMethod,
  Currency as PrismaCurrency,
  WalletTransactionType as PrismaWalletTransactionType,
  GiftCardStatus as PrismaGiftCardStatus,
  CouponStatus as PrismaCouponStatus,
  PromotionType as PrismaPromotionType,
  TaxType as PrismaTaxType,
  RefundReason as PrismaRefundReason,
  CustomsStatus as PrismaCustomsStatus,
  NotificationType as PrismaNotificationType,
  TicketStatus as PrismaTicketStatus,
  TicketPriority as PrismaTicketPriority,
  ConversationType as PrismaConversationType,
  CategoryType as PrismaCategoryType,
  ContentType as PrismaContentType,
  MembershipTier as PrismaMembershipTier,
  FraudCheckResult as PrismaFraudCheckResult,
  TwoFactorMethod as PrismaTwoFactorMethod
} from '@prisma/client';

// Re-export with original names
export const Role = PrismaRole;
export const OrderStatus = PrismaOrderStatus;
export const PaymentStatus = PrismaPaymentStatus;
export const PaymentMethod = PrismaPaymentMethod;
export const ProductStatus = PrismaProductStatus;
export const ProductType = PrismaProductType;
export const SellerStatus = PrismaSellerStatus;
export const ReviewStatus = PrismaReviewStatus;
export const ShippingMethod = PrismaShippingMethod;
export const Currency = PrismaCurrency;
export const WalletTransactionType = PrismaWalletTransactionType;
export const GiftCardStatus = PrismaGiftCardStatus;
export const CouponStatus = PrismaCouponStatus;
export const PromotionType = PrismaPromotionType;
export const TaxType = PrismaTaxType;
export const RefundReason = PrismaRefundReason;
export const CustomsStatus = PrismaCustomsStatus;
export const NotificationType = PrismaNotificationType;
export const TicketStatus = PrismaTicketStatus;
export const TicketPriority = PrismaTicketPriority;
export const ConversationType = PrismaConversationType;
export const CategoryType = PrismaCategoryType;
export const ContentType = PrismaContentType;
export const MembershipTier = PrismaMembershipTier;
export const FraudCheckResult = PrismaFraudCheckResult;
export const TwoFactorMethod = PrismaTwoFactorMethod;

// APPLICATION-SPECIFIC ENUMS (not in Prisma schema)
// These are application logic enums that don't map to database fields

// User interface roles (extends Prisma Role enum)
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN', 
  STAFF = 'STAFF',
  SELLER = 'SELLER',
  CUSTOMER = 'CUSTOMER',
  GUEST = 'GUEST'
}

// Shipping status for tracking (not in schema)
export enum ShippingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING', 
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETURNED = 'RETURNED'
}

// Return request status (not in schema)
export enum ReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Return request type (not in schema)
export enum ReturnType {
  RETURN = 'RETURN',
  EXCHANGE = 'EXCHANGE',
  REFUND = 'REFUND'
}

// Refund status (not in schema)
export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Payout status (not in schema)
export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Payout method (not in schema)
export enum PayoutMethod {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

// Transaction type (not in schema)
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
export const DEFAULT_CURRENCY = 'USD' as const;

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
  // Prisma enums (imported)
  Role,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ProductStatus,
  ProductType,
  SellerStatus,
  ReviewStatus,
  ShippingMethod,
  Currency,
  WalletTransactionType,
  GiftCardStatus,
  CouponStatus,
  PromotionType,
  TaxType,
  RefundReason,
  CustomsStatus,
  NotificationType,
  TicketStatus,
  TicketPriority,
  ConversationType,
  CategoryType,
  ContentType,
  MembershipTier,
  FraudCheckResult,
  TwoFactorMethod,
  
  // Application-specific enums
  UserRole,
  ShippingStatus,
  ReturnStatus,
  ReturnType,
  RefundStatus,
  PayoutStatus,
  PayoutMethod,
  TransactionType,
  AnalyticsEventType,
  FileUploadType,
  
  // Constants
  RATE_LIMITS,
  PAGINATION,
  SEARCH,
  IMAGE_UPLOAD,
  CACHE_TTL,
  EMAIL_TEMPLATES,
  SYSTEM_LIMITS,
  FRAUD_THRESHOLDS,
  BLOCKED_CURRENCIES,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  API_VERSION,
  JWT_EXPIRATION,
  SESSION_CONFIG,
  CORS_CONFIG,
  HEALTH_CHECK,
  WEBHOOK_CONFIG
};