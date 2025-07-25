import { z } from 'zod';
import { CurrencyValidator } from './currency.validator';

// Custom currency validation
const currencySchema = z.string().refine(
  (currency) => CurrencyValidator.isValidCurrency(currency),
  (currency) => ({
    message: CurrencyValidator.getErrorMessage(currency || '')
  })
);

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const idSchema = z.object({
  id: z.string().cuid()
});

// Money schema with currency validation
export const moneySchema = z.object({
  amount: z.number().positive(),
  currency: currencySchema
});

// Product schemas
export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sku: z.string().min(1).max(100),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  currency: currencySchema,
  categoryId: z.string().cuid(),
  brandId: z.string().cuid().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  isPublished: z.boolean().default(false),
  seoTitle: z.string().max(60).optional(),
  seoDescription: z.string().max(160).optional()
});

export const updateProductSchema = createProductSchema.partial();

// Order schemas
export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    currency: currencySchema
  })).min(1),
  shippingAddressId: z.string().cuid(),
  billingAddressId: z.string().cuid().optional(),
  currency: currencySchema,
  shippingMethodId: z.string().cuid(),
  couponCode: z.string().optional(),
  notes: z.string().optional()
});

// Payment schemas
export const createPaymentSchema = z.object({
  orderId: z.string().cuid(),
  amount: z.number().positive(),
  currency: currencySchema,
  method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'STRIPE', 'BANK_TRANSFER']),
  processor: z.enum(['STRIPE', 'PAYPAL']),
  metadata: z.record(z.string(), z.any()).optional()
});

export const processPaymentSchema = z.object({
  paymentId: z.string().cuid(),
  paymentMethodId: z.string(), // Stripe/PayPal method ID
  returnUrl: z.string().url().optional(),
  savePaymentMethod: z.boolean().default(false)
});

// Refund schemas
export const createRefundSchema = z.object({
  paymentId: z.string().cuid(),
  amount: z.number().positive(),
  currency: currencySchema,
  reason: z.string().min(10).max(500),
  items: z.array(z.object({
    orderItemId: z.string().cuid(),
    quantity: z.number().int().positive()
  })).optional()
});

// Seller payout schemas
export const createPayoutSchema = z.object({
  sellerId: z.string().cuid(),
  amount: z.number().positive(),
  currency: currencySchema,
  bankAccountId: z.string().cuid(),
  period: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  })
});

// User schemas
export const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  username: z.string().min(3).max(30).toLowerCase(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
  preferredCurrency: currencySchema.default('USD'),
  acceptedTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  })
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  preferredCurrency: currencySchema.optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional()
});

// Seller schemas
export const createSellerSchema = z.object({
  userId: z.string().cuid(),
  storeName: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  email: z.string().email().toLowerCase(),
  phone: z.string(),
  businessType: z.enum(['INDIVIDUAL', 'COMPANY']),
  taxId: z.string().min(1),
  currency: currencySchema,
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().length(2), // ISO country code
    postalCode: z.string().min(1)
  }),
  bankAccount: z.object({
    accountHolder: z.string().min(1),
    accountNumber: z.string().min(1),
    routingNumber: z.string().min(1),
    bankName: z.string().min(1),
    currency: currencySchema
  }),
  documents: z.object({
    businessLicense: z.string().url(),
    taxDocument: z.string().url(),
    identityDocument: z.string().url()
  })
});

// Search schemas
export const searchProductsSchema = z.object({
  q: z.string().min(2).max(100),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  currency: currencySchema.optional(),
  sellerId: z.string().cuid().optional(),
  inStock: z.coerce.boolean().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  sortBy: z.enum(['relevance', 'price', 'rating', 'newest']).default('relevance'),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().positive().max(100).optional()
});

// Currency conversion schemas
export const currencyConversionSchema = z.object({
  amount: z.number().positive(),
  fromCurrency: currencySchema,
  toCurrency: currencySchema
});

// Export all schemas
export const schemas = {
  common: {
    pagination: paginationSchema,
    id: idSchema,
    money: moneySchema,
    currency: currencySchema
  },
  product: {
    create: createProductSchema,
    update: updateProductSchema
  },
  order: {
    create: createOrderSchema
  },
  payment: {
    create: createPaymentSchema,
    process: processPaymentSchema
  },
  refund: {
    create: createRefundSchema
  },
  payout: {
    create: createPayoutSchema
  },
  user: {
    create: createUserSchema,
    update: updateUserSchema
  },
  seller: {
    create: createSellerSchema
  },
  search: {
    products: searchProductsSchema
  },
  currency: {
    conversion: currencyConversionSchema
  }
};