import { FastifyRequest, FastifyReply } from 'fastify';
import { CurrencyValidator, validateCurrencyInRequest } from '../utils/currency.validator';
import { logger } from '../utils/logger';

/**
 * Middleware to validate currency in requests
 */
export async function currencyValidationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Check request body
    if (request.body && typeof request.body === 'object') {
      validateCurrencyInRequest(request.body);
    }

    // Check query parameters
    if (request.query && typeof request.query === 'object') {
      const query = request.query as Record<string, any>;
      if (query.currency && !CurrencyValidator.isValidCurrency(query.currency)) {
        throw new Error(CurrencyValidator.getErrorMessage(query.currency));
      }
    }

    // Log blocked currency attempts
    const checkForBlockedCurrency = (data: any) => {
      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          if (key.toLowerCase().includes('currency') && typeof value === 'string') {
            if (CurrencyValidator.isBlockedCurrency(value)) {
              logger.warn({
                traceId: (request as any).traceId,
                userId: (request as any).userId,
                currency: value,
                ip: request.ip,
                path: request.url
              }, 'Blocked currency attempt');
            }
          }
        }
      }
    };

    checkForBlockedCurrency(request.body);
    checkForBlockedCurrency(request.query);

  } catch (error: any) {
    logger.error({
      traceId: (request as any).traceId,
      error: error.message,
      body: request.body,
      query: request.query
    }, 'Currency validation failed');

    return reply.status(400).send({
      error: {
        code: 'INVALID_CURRENCY',
        message: error.message,
        allowedCurrencies: CurrencyValidator.getAllowedCurrencies()
      }
    });
  }
}

/**
 * Route-specific currency validation
 */
export async function validatePaymentCurrency(
  request: FastifyRequest<{
    Body: { currency: string; amount: number }
  }>,
  reply: FastifyReply
) {
  const { currency } = request.body;

  if (!CurrencyValidator.isValidCurrency(currency)) {
    return reply.status(400).send({
      error: {
        code: 'INVALID_PAYMENT_CURRENCY',
        message: CurrencyValidator.getErrorMessage(currency),
        allowedCurrencies: CurrencyValidator.getAllowedCurrencies()
      }
    });
  }

  // Check if currency is supported by payment processor
  const processor = (request.headers['x-payment-processor'] as string) || 'STRIPE';
  if (!CurrencyValidator.isSupportedByProcessor(currency, processor as any)) {
    return reply.status(400).send({
      error: {
        code: 'CURRENCY_NOT_SUPPORTED_BY_PROCESSOR',
        message: `Currency ${currency} is not supported by ${processor}`,
        allowedCurrencies: CurrencyValidator.getAllowedCurrencies()
      }
    });
  }

}

/**
 * Product pricing currency validation
 */
export async function validateProductCurrency(
  request: FastifyRequest<{
    Body: { price: number; currency: string; compareAtPrice?: number }
  }>,
  reply: FastifyReply
) {
  const { currency } = request.body;

  if (!CurrencyValidator.isValidCurrency(currency)) {
    return reply.status(400).send({
      error: {
        code: 'INVALID_PRODUCT_CURRENCY',
        message: CurrencyValidator.getErrorMessage(currency),
        allowedCurrencies: CurrencyValidator.getAllowedCurrencies(),
        note: 'Products can only be listed in supported currencies'
      }
    });
  }

}