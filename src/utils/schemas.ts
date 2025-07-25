import { Type, Static } from '@sinclair/typebox';

/**
 * Common schema definitions using TypeBox
 */

// Pagination schema
export const PaginationSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  search: Type.Optional(Type.String()),
  sort: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')]))
});

export type PaginationQuery = Static<typeof PaginationSchema>;

// Common response schemas
export const SuccessResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.Optional(Type.String()),
  data: Type.Any()
});

export const ErrorResponseSchema = Type.Object({
  success: Type.Boolean({ default: false }),
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    statusCode: Type.Optional(Type.Number()),
    details: Type.Optional(Type.Any())
  })
});

export const PaginatedResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.Optional(Type.String()),
  data: Type.Array(Type.Any()),
  pagination: Type.Object({
    page: Type.Number(),
    limit: Type.Number(),
    total: Type.Number(),
    pages: Type.Number()
  })
});

// ID parameter schema
export const IdParamSchema = Type.Object({
  id: Type.String()
});

export type IdParam = Static<typeof IdParamSchema>;

// Common field schemas
export const EmailSchema = Type.String({ 
  format: 'email',
  minLength: 1,
  maxLength: 255 
});

export const PasswordSchema = Type.String({ 
  minLength: 8,
  maxLength: 100,
  description: 'Password must be at least 8 characters long'
});

export const PhoneSchema = Type.String({
  pattern: '^\\+?[1-9]\\d{1,14}$',
  description: 'Phone number in E.164 format'
});

export const CurrencySchema = Type.String({
  pattern: '^[A-Z]{3}$',
  description: 'ISO 4217 currency code'
});

export const TimestampSchema = Type.String({
  format: 'date-time'
});

// Address schema
export const AddressSchema = Type.Object({
  street: Type.String({ minLength: 1, maxLength: 255 }),
  city: Type.String({ minLength: 1, maxLength: 100 }),
  state: Type.String({ minLength: 1, maxLength: 100 }),
  country: Type.String({ minLength: 2, maxLength: 2, description: 'ISO 3166-1 alpha-2 country code' }),
  postalCode: Type.String({ minLength: 1, maxLength: 20 }),
  phone: Type.Optional(PhoneSchema),
  isDefault: Type.Optional(Type.Boolean()),
  type: Type.Optional(Type.Union([
    Type.Literal('BILLING'),
    Type.Literal('SHIPPING'),
    Type.Literal('BOTH')
  ])),
  instructions: Type.Optional(Type.String({ maxLength: 500 }))
});

export type Address = Static<typeof AddressSchema>;

// Price schema
export const PriceSchema = Type.Object({
  amount: Type.Number({ minimum: 0 }),
  currency: CurrencySchema
});

export type Price = Static<typeof PriceSchema>;

// Image schema
export const ImageSchema = Type.Object({
  url: Type.String({ format: 'uri' }),
  alt: Type.Optional(Type.String({ maxLength: 255 })),
  width: Type.Optional(Type.Integer({ minimum: 1 })),
  height: Type.Optional(Type.Integer({ minimum: 1 }))
});

export type Image = Static<typeof ImageSchema>;