import zodToJsonSchema from 'zod-to-json-schema';
import { schemas } from './validation-schemas';

// Convert Zod schemas to JSON Schema format for Fastify
const convertZodToJsonSchema = (zodSchema: any) => {
  return zodToJsonSchema(zodSchema, {
    name: undefined,
    target: 'jsonSchema7'
  });
};

// User schemas
export const userJsonSchemas = {
  create: convertZodToJsonSchema(schemas.user.create),
  update: convertZodToJsonSchema(schemas.user.update)
};

// Product schemas
export const productJsonSchemas = {
  create: convertZodToJsonSchema(schemas.product.create),
  update: convertZodToJsonSchema(schemas.product.update)
};

// Common schemas
export const commonJsonSchemas = {
  pagination: convertZodToJsonSchema(schemas.common.pagination),
  id: convertZodToJsonSchema(schemas.common.id),
  money: convertZodToJsonSchema(schemas.common.money),
  currency: convertZodToJsonSchema(schemas.common.currency)
};

// Payment schemas
export const paymentJsonSchemas = {
  create: convertZodToJsonSchema(schemas.payment.create),
  process: convertZodToJsonSchema(schemas.payment.process)
};

// Seller schemas
export const sellerJsonSchemas = {
  create: convertZodToJsonSchema(schemas.seller.create)
};

// Search schemas
export const searchJsonSchemas = {
  products: convertZodToJsonSchema(schemas.search.products)
};

// Currency schemas
export const currencyJsonSchemas = {
  conversion: convertZodToJsonSchema(schemas.currency.conversion)
};

// Export all JSON schemas
export const jsonSchemas = {
  user: userJsonSchemas,
  product: productJsonSchemas,
  common: commonJsonSchemas,
  payment: paymentJsonSchemas,
  seller: sellerJsonSchemas,
  search: searchJsonSchemas,
  currency: currencyJsonSchemas
};