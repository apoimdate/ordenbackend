import { Currency } from '@prisma/client';
import { logger } from '../utils/logger';

// Blocked currencies that no payment processor supports
const BLOCKED_CURRENCIES = ['CUP'];

// Supported currencies by payment processor
const PAYMENT_PROCESSOR_SUPPORT = {
  STRIPE: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MXN', 'BRL'],
  PAYPAL: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MXN', 'BRL']
};

export class CurrencyValidator {
  private static allowedCurrencies: Set<string> = new Set(['USD', 'EUR']);

  /**
   * Check if a currency is valid and supported
   */
  static isValidCurrency(currency: string): boolean {
    // Check if it's a valid enum value
    if (!Object.values(Currency).includes(currency as Currency)) {
      return false;
    }

    // Check if it's blocked
    if (BLOCKED_CURRENCIES.includes(currency)) {
      logger.warn({ currency }, 'Blocked currency attempted');
      return false;
    }

    // Check if it's in allowed list
    return this.allowedCurrencies.has(currency);
  }

  /**
   * Check if a currency is blocked
   */
  static isBlockedCurrency(currency: string): boolean {
    return BLOCKED_CURRENCIES.includes(currency);
  }

  /**
   * Get list of allowed currencies
   */
  static getAllowedCurrencies(): string[] {
    return Array.from(this.allowedCurrencies);
  }

  /**
   * Validate currency for a specific payment processor
   */
  static isSupportedByProcessor(currency: string, processor: 'STRIPE' | 'PAYPAL'): boolean {
    if (!this.isValidCurrency(currency)) {
      return false;
    }

    return PAYMENT_PROCESSOR_SUPPORT[processor]?.includes(currency) || false;
  }

  /**
   * Get error message for invalid currency
   */
  static getErrorMessage(currency: string): string {
    if (BLOCKED_CURRENCIES.includes(currency)) {
      return `Currency ${currency} is not supported. No payment processor accepts ${currency}.`;
    }

    if (!this.allowedCurrencies.has(currency)) {
      return `Currency ${currency} is not allowed. Allowed currencies: ${this.getAllowedCurrencies().join(', ')}`;
    }

    return `Invalid currency: ${currency}`;
  }

  /**
   * Convert amount between currencies (placeholder - implement with real rates)
   */
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (!this.isValidCurrency(fromCurrency) || !this.isValidCurrency(toCurrency)) {
      throw new Error('Invalid currency for conversion');
    }

    if (fromCurrency === toCurrency) {
      return amount;
    }

    // TODO: Implement real currency conversion with exchange rates
    // For now, return a placeholder conversion
    logger.warn(
      { amount, fromCurrency, toCurrency },
      'Currency conversion not implemented - returning same amount'
    );

    return amount;
  }
}

/**
 * Validation function for Zod schemas
 */
export function validateCurrency(currency: string): boolean {
  return CurrencyValidator.isValidCurrency(currency);
}

/**
 * Middleware to validate currency in request
 */
export function validateCurrencyInRequest(data: any): void {
  const currencyFields = ['currency', 'fromCurrency', 'toCurrency', 'priceCurrency'];
  
  for (const field of currencyFields) {
    if (data[field]) {
      if (!CurrencyValidator.isValidCurrency(data[field])) {
        throw new Error(CurrencyValidator.getErrorMessage(data[field]));
      }
    }
  }

  // Check nested objects
  if (data.payment?.currency) {
    if (!CurrencyValidator.isValidCurrency(data.payment.currency)) {
      throw new Error(CurrencyValidator.getErrorMessage(data.payment.currency));
    }
  }

  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item.currency && !CurrencyValidator.isValidCurrency(item.currency)) {
        throw new Error(CurrencyValidator.getErrorMessage(item.currency));
      }
    }
  }
}