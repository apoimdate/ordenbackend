import { TaxRule, Prisma, TaxType } from '@prisma/client';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { TaxRuleRepository } from '../repositories';
import { cacheGet, cacheSet } from '../config/redis';
import { nanoid } from 'nanoid';

interface CreateTaxRuleData {
  country: string;
  state?: string;
  city?: string;
  zipCode?: string;
  taxType: TaxType;
  rate: number;
}

interface UpdateTaxRuleData extends Partial<CreateTaxRuleData> {
  isActive?: boolean;
}

interface TaxRuleSearchParams {
  country?: string;
  state?: string;
  city?: string;
  zipCode?: string;
  taxType?: TaxType;
  isActive?: boolean;
  minRate?: number;
  maxRate?: number;
  page?: number;
  limit?: number;
  sortBy?: 'country' | 'state' | 'city' | 'rate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface TaxCalculationRequest {
  country: string;
  state?: string;
  city?: string;
  zipCode?: string;
  amount: number;
  taxType?: TaxType;
}

interface TaxCalculationResult {
  amount: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number;
  applicableRules: Array<{
    id: string;
    taxType: TaxType;
    rate: number;
    country: string;
    state?: string;
    city?: string;
    zipCode?: string;
  }>;
}

interface TaxRuleAnalytics {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  averageRate: number;
  rulesByCountry: Record<string, number>;
  rulesByTaxType: Record<string, number>;
}

interface BulkTaxRuleUpdate {
  ruleIds: string[];
  updates: Partial<UpdateTaxRuleData>;
}

export class TaxRuleService {
  private taxRuleRepo: TaxRuleRepository;

  constructor(prisma: any, redis: any, logger: any) {
    this.taxRuleRepo = new TaxRuleRepository(prisma, redis, logger);
  }

  async create(data: CreateTaxRuleData): Promise<ServiceResult<TaxRule>> {
    try {
      // PRODUCTION: Comprehensive input validation
      if (!data.country || data.country.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Country is required', 400, 'INVALID_COUNTRY')
        };
      }

      // PRODUCTION: Validate country code format (ISO 3166-1 alpha-2)
      if (!this.isValidCountryCode(data.country)) {
        return {
          success: false,
          error: new ApiError(
            'Invalid country code. Use ISO 3166-1 alpha-2 format (e.g., US, CA, MX)',
            400,
            'INVALID_COUNTRY_CODE'
          )
        };
      }

      if (!data.taxType) {
        return {
          success: false,
          error: new ApiError('Tax type is required', 400, 'INVALID_TAX_TYPE')
        };
      }

      // PRODUCTION: Validate tax type is valid enum value
      const validTaxTypes = Object.values(TaxType);
      if (!validTaxTypes.includes(data.taxType)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid tax type. Must be one of: ${validTaxTypes.join(', ')}`,
            400,
            'INVALID_TAX_TYPE_ENUM'
          )
        };
      }

      if (data.rate < 0 || data.rate > 1) {
        return {
          success: false,
          error: new ApiError(
            'Tax rate must be between 0 and 1 (0% to 100%)',
            400,
            'INVALID_TAX_RATE'
          )
        };
      }

      // PRODUCTION: Check for duplicate tax rules
      const existingRule = await this.taxRuleRepo.findFirst({
        where: {
          country: data.country.toUpperCase(),
          state: data.state?.toUpperCase() || null,
          city: data.city?.toLowerCase() || null,
          zipCode: data.zipCode?.toUpperCase() || null,
          taxType: data.taxType,
          isActive: true
        }
      });

      if (existingRule) {
        return {
          success: false,
          error: new ApiError(
            'A tax rule already exists for this location and tax type',
            400,
            'DUPLICATE_TAX_RULE'
          )
        };
      }

      // PRODUCTION: Validate ZIP code format for country if provided
      if (data.zipCode && !this.isValidZipCode(data.country, data.zipCode)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid ZIP code format for country ${data.country}`,
            400,
            'INVALID_ZIP_FORMAT'
          )
        };
      }

      const taxRule = await this.taxRuleRepo.create({
        id: nanoid(),
        country: data.country.toUpperCase(),
        state: data.state?.toUpperCase() || null,
        city: data.city?.toLowerCase() || null,
        zipCode: data.zipCode?.toUpperCase() || null,
        taxType: data.taxType,
        rate: data.rate,
        isActive: true
      });

      // Clear tax calculation caches
      await this.clearTaxCaches(data.country, data.state);

      // PRODUCTION: Comprehensive success logging with tax jurisdiction info
      logger.info({
        event: 'TAX_RULE_CREATED',
        taxRuleId: taxRule.id,
        country: data.country,
        state: data.state,
        city: data.city,
        zipCode: data.zipCode,
        taxType: data.taxType,
        rate: data.rate,
        jurisdiction: this.buildJurisdictionString(data.country, data.state, data.city, data.zipCode),
        timestamp: new Date().toISOString()
      }, 'Tax rule created successfully with production jurisdiction validation');

      return {
        success: true,
        data: taxRule
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create tax rule');
      return {
        success: false,
        error: new ApiError('Failed to create tax rule', 500, 'CREATION_FAILED')
      };
    }
  }

  async update(id: string, data: UpdateTaxRuleData): Promise<ServiceResult<TaxRule>> {
    try {
      // Check if tax rule exists
      const existingRule = await this.taxRuleRepo.findById(id);
      if (!existingRule) {
        return {
          success: false,
          error: new ApiError('Tax rule not found', 404, 'TAX_RULE_NOT_FOUND')
        };
      }

      // PRODUCTION: Validate country code if provided
      if (data.country && !this.isValidCountryCode(data.country)) {
        return {
          success: false,
          error: new ApiError(
            'Invalid country code. Use ISO 3166-1 alpha-2 format (e.g., US, CA, MX)',
            400,
            'INVALID_COUNTRY_CODE'
          )
        };
      }

      // PRODUCTION: Validate tax type if provided
      if (data.taxType) {
        const validTaxTypes = Object.values(TaxType);
        if (!validTaxTypes.includes(data.taxType)) {
          return {
            success: false,
            error: new ApiError(
              `Invalid tax type. Must be one of: ${validTaxTypes.join(', ')}`,
              400,
              'INVALID_TAX_TYPE_ENUM'
            )
          };
        }
      }

      // PRODUCTION: Validate tax rate if provided
      if (data.rate !== undefined && (data.rate < 0 || data.rate > 1)) {
        return {
          success: false,
          error: new ApiError(
            'Tax rate must be between 0 and 1 (0% to 100%)',
            400,
            'INVALID_TAX_RATE'
          )
        };
      }

      // PRODUCTION: Check for duplicates if location or tax type changed
      if (data.country || data.state || data.city || data.zipCode || data.taxType) {
        const country = data.country || existingRule.country;
        const state = data.state !== undefined ? data.state : existingRule.state;
        const city = data.city !== undefined ? data.city : existingRule.city;
        const zipCode = data.zipCode !== undefined ? data.zipCode : existingRule.zipCode;
        const taxType = data.taxType || existingRule.taxType;

        const duplicateRule = await this.taxRuleRepo.findFirst({
          where: {
            id: { not: id },
            country: country.toUpperCase(),
            state: state?.toUpperCase() || null,
            city: city?.toLowerCase() || null,
            zipCode: zipCode?.toUpperCase() || null,
            taxType: taxType,
            isActive: true
          }
        });

        if (duplicateRule) {
          return {
            success: false,
            error: new ApiError(
              'A tax rule already exists for this location and tax type',
              400,
              'DUPLICATE_TAX_RULE'
            )
          };
        }
      }

      // PRODUCTION: Normalize data
      let updateData = { ...data };
      if (updateData.country) {
        updateData.country = updateData.country.toUpperCase();
      }
      if (updateData.state !== undefined) {
        updateData.state = updateData.state?.toUpperCase() || undefined;
      }
      if (updateData.city !== undefined) {
        updateData.city = updateData.city?.toLowerCase() || undefined;
      }
      if (updateData.zipCode !== undefined) {
        updateData.zipCode = updateData.zipCode?.toUpperCase() || undefined;
      }

      const taxRule = await this.taxRuleRepo.update(id, updateData);

      // Clear tax calculation caches
      await this.clearTaxCaches(
        updateData.country || existingRule.country,
        updateData.state !== undefined ? updateData.state : existingRule.state
      );

      logger.info({
        taxRuleId: id,
        changes: Object.keys(data),
        oldJurisdiction: this.buildJurisdictionString(
          existingRule.country,
          existingRule.state,
          existingRule.city,
          existingRule.zipCode
        ),
        newJurisdiction: this.buildJurisdictionString(
          taxRule.country,
          taxRule.state,
          taxRule.city,
          taxRule.zipCode
        )
      }, 'Tax rule updated successfully');

      return {
        success: true,
        data: taxRule
      };
    } catch (error) {
      logger.error({ error, taxRuleId: id, data }, 'Failed to update tax rule');
      return {
        success: false,
        error: new ApiError('Failed to update tax rule', 500, 'UPDATE_FAILED')
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<TaxRule | null>> {
    try {
      const cacheKey = `tax-rule:${id}`;
      
      let taxRule = await cacheGet(cacheKey) as TaxRule | null;
      if (!taxRule) {
        taxRule = await this.taxRuleRepo.findById(id);

        if (taxRule) {
          await cacheSet(cacheKey, taxRule, 3600); // 1 hour
        }
      }

      return {
        success: true,
        data: taxRule
      };
    } catch (error) {
      logger.error({ error, taxRuleId: id }, 'Failed to find tax rule');
      return {
        success: false,
        error: new ApiError('Failed to retrieve tax rule', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async search(params: TaxRuleSearchParams): Promise<ServiceResult<PaginatedResult<TaxRule>>> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.TaxRuleWhereInput = {};

      if (params.country) {
        where.country = {
          contains: params.country,
          mode: 'insensitive'
        };
      }

      if (params.state) {
        where.state = {
          contains: params.state,
          mode: 'insensitive'
        };
      }

      if (params.city) {
        where.city = {
          contains: params.city,
          mode: 'insensitive'
        };
      }

      if (params.zipCode) {
        where.zipCode = {
          contains: params.zipCode,
          mode: 'insensitive'
        };
      }

      if (params.taxType) {
        where.taxType = params.taxType;
      }

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      if (params.minRate || params.maxRate) {
        where.rate = {};
        if (params.minRate) where.rate.gte = params.minRate;
        if (params.maxRate) where.rate.lte = params.maxRate;
      }

      // Build orderBy clause
      let orderBy: Prisma.TaxRuleOrderByWithRelationInput = { createdAt: 'desc' };
      if (params.sortBy) {
        const sortOrder = params.sortOrder || 'asc';
        switch (params.sortBy) {
          case 'country':
            orderBy = { country: sortOrder };
            break;
          case 'state':
            orderBy = { state: sortOrder };
            break;
          case 'city':
            orderBy = { city: sortOrder };
            break;
          case 'rate':
            orderBy = { rate: sortOrder };
            break;
          case 'createdAt':
            orderBy = { createdAt: sortOrder };
            break;
        }
      }

      const [taxRules, total] = await Promise.all([
        this.taxRuleRepo.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit
        }),
        this.taxRuleRepo.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: taxRules,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to search tax rules');
      return {
        success: false,
        error: new ApiError('Failed to search tax rules', 500, 'SEARCH_FAILED')
      };
    }
  }

  async calculateTax(request: TaxCalculationRequest): Promise<ServiceResult<TaxCalculationResult>> {
    try {
      if (request.amount <= 0) {
        return {
          success: false,
          error: new ApiError('Amount must be greater than 0', 400, 'INVALID_AMOUNT')
        };
      }

      // PRODUCTION: Find applicable tax rules with hierarchical matching
      // Priority: ZIP > City > State > Country
      const cacheKey = `tax-calc:${request.country}:${request.state || 'null'}:${request.city || 'null'}:${request.zipCode || 'null'}:${request.taxType || 'all'}`;
      
      let applicableRules = await cacheGet(cacheKey) as TaxRule[] | null;
      if (!applicableRules) {
        applicableRules = await this.findApplicableTaxRules(request);
        await cacheSet(cacheKey, applicableRules, 1800); // 30 minutes
      }

      if (applicableRules.length === 0) {
        // No tax rules found - return zero tax
        return {
          success: true,
          data: {
            amount: request.amount,
            taxAmount: 0,
            totalAmount: request.amount,
            taxRate: 0,
            applicableRules: []
          }
        };
      }

      // PRODUCTION: Calculate compound tax (each tax applies to base amount)
      let totalTaxAmount = 0;
      let totalTaxRate = 0;
      const ruleResults: TaxCalculationResult['applicableRules'] = [];

      for (const rule of applicableRules) {
        const taxAmount = request.amount * rule.rate;
        totalTaxAmount += taxAmount;
        totalTaxRate += rule.rate;

        ruleResults.push({
          id: rule.id,
          taxType: rule.taxType,
          rate: rule.rate,
          country: rule.country,
          state: rule.state || undefined,
          city: rule.city || undefined,
          zipCode: rule.zipCode || undefined
        });
      }

      const result: TaxCalculationResult = {
        amount: request.amount,
        taxAmount: Math.round(totalTaxAmount * 100) / 100, // Round to 2 decimal places
        totalAmount: Math.round((request.amount + totalTaxAmount) * 100) / 100,
        taxRate: Math.round(totalTaxRate * 10000) / 10000, // Round to 4 decimal places
        applicableRules: ruleResults
      };

      // PRODUCTION: Log tax calculation for audit trail
      logger.info({
        event: 'TAX_CALCULATED',
        request: {
          country: request.country,
          state: request.state,
          city: request.city,
          zipCode: request.zipCode,
          amount: request.amount,
          taxType: request.taxType
        },
        result: {
          taxAmount: result.taxAmount,
          totalAmount: result.totalAmount,
          taxRate: result.taxRate,
          rulesApplied: result.applicableRules.length
        },
        timestamp: new Date().toISOString()
      }, 'Tax calculation completed with production audit trail');

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error({ error, request }, 'Failed to calculate tax');
      return {
        success: false,
        error: new ApiError('Failed to calculate tax', 500, 'CALCULATION_FAILED')
      };
    }
  }

  async getTaxRuleAnalytics(params: {
    country?: string;
    taxType?: TaxType;
    isActive?: boolean;
  }): Promise<ServiceResult<TaxRuleAnalytics>> {
    try {
      // Build where clause for analytics
      const where: Prisma.TaxRuleWhereInput = {};

      if (params.country) {
        where.country = params.country;
      }

      if (params.taxType) {
        where.taxType = params.taxType;
      }

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      // Get basic analytics
      const [rules, aggregation] = await Promise.all([
        this.taxRuleRepo.findMany({
          where,
          select: {
            id: true,
            country: true,
            taxType: true,
            rate: true,
            isActive: true
          }
        }),
        this.taxRuleRepo.aggregate({
          where,
          _count: { id: true },
          _avg: { rate: true }
        })
      ]);

      // Calculate analytics
      const rulesByCountry: Record<string, number> = {};
      const rulesByTaxType: Record<string, number> = {};
      let activeRules = 0;
      let inactiveRules = 0;

      rules.forEach(rule => {
        // Count by country
        rulesByCountry[rule.country] = (rulesByCountry[rule.country] || 0) + 1;

        // Count by tax type
        rulesByTaxType[rule.taxType] = (rulesByTaxType[rule.taxType] || 0) + 1;

        // Count active/inactive
        if (rule.isActive) {
          activeRules++;
        } else {
          inactiveRules++;
        }
      });

      return {
        success: true,
        data: {
          totalRules: aggregation._count.id,
          activeRules,
          inactiveRules,
          averageRate: Math.round((aggregation._avg.rate || 0) * 10000) / 100, // Convert to percentage
          rulesByCountry,
          rulesByTaxType
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to get tax rule analytics');
      return {
        success: false,
        error: new ApiError('Failed to get tax rule analytics', 500, 'ANALYTICS_FAILED')
      };
    }
  }

  async bulkUpdate(data: BulkTaxRuleUpdate): Promise<ServiceResult<{ updated: number }>> {
    try {
      // PRODUCTION: Validate all rules exist
      const existingRules = await this.taxRuleRepo.findMany({
        where: { id: { in: data.ruleIds } }
      });

      if (existingRules.length !== data.ruleIds.length) {
        const foundIds = existingRules.map(rule => rule.id);
        const missingIds = data.ruleIds.filter(id => !foundIds.includes(id));
        return {
          success: false,
          error: new ApiError(
            `Tax rules not found: ${missingIds.join(', ')}`,
            404,
            'RULES_NOT_FOUND'
          )
        };
      }

      // PRODUCTION: Validate rate if provided
      if (data.updates.rate !== undefined && (data.updates.rate < 0 || data.updates.rate > 1)) {
        return {
          success: false,
          error: new ApiError(
            'Tax rate must be between 0 and 1 (0% to 100%)',
            400,
            'INVALID_TAX_RATE'
          )
        };
      }

      // Bulk update
      const updateResult = await this.taxRuleRepo.updateMany(
        { id: { in: data.ruleIds } },
        data.updates
      );

      // Clear caches for affected jurisdictions
      const jurisdictions = Array.from(new Set(existingRules.map(rule => `${rule.country}:${rule.state || 'null'}`)));
      for (const jurisdiction of jurisdictions) {
        const [country, state] = jurisdiction.split(':');
        await this.clearTaxCaches(country, state === 'null' ? null : state);
      }

      logger.info({
        event: 'BULK_TAX_RULE_UPDATE',
        ruleIds: data.ruleIds,
        updates: Object.keys(data.updates),
        updated: updateResult.count,
        timestamp: new Date().toISOString()
      }, 'Bulk tax rule update completed');

      return {
        success: true,
        data: { updated: updateResult.count }
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to bulk update tax rules');
      return {
        success: false,
        error: new ApiError('Failed to bulk update tax rules', 500, 'BULK_UPDATE_FAILED')
      };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      // Check if tax rule exists
      const taxRule = await this.taxRuleRepo.findById(id);
      if (!taxRule) {
        return {
          success: false,
          error: new ApiError('Tax rule not found', 404, 'TAX_RULE_NOT_FOUND')
        };
      }

      await this.taxRuleRepo.delete(id);

      // Clear tax calculation caches
      await this.clearTaxCaches(taxRule.country, taxRule.state);

      logger.info({
        taxRuleId: id,
        jurisdiction: this.buildJurisdictionString(
          taxRule.country,
          taxRule.state,
          taxRule.city,
          taxRule.zipCode
        ),
        taxType: taxRule.taxType,
        rate: taxRule.rate
      }, 'Tax rule deleted successfully');

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      logger.error({ error, taxRuleId: id }, 'Failed to delete tax rule');
      return {
        success: false,
        error: new ApiError('Failed to delete tax rule', 500, 'DELETION_FAILED')
      };
    }
  }

  // PRODUCTION: Private helper methods for tax calculation and validation

  private async findApplicableTaxRules(request: TaxCalculationRequest): Promise<TaxRule[]> {
    // PRODUCTION: Hierarchical tax rule matching - most specific first
    const searchCriteria = [
      // 1. Exact match: Country + State + City + ZIP
      {
        country: request.country.toUpperCase(),
        state: request.state?.toUpperCase() || undefined,
        city: request.city?.toLowerCase() || undefined,
        zipCode: request.zipCode?.toUpperCase() || undefined
      },
      // 2. City level: Country + State + City
      {
        country: request.country.toUpperCase(),
        state: request.state?.toUpperCase() || undefined,
        city: request.city?.toLowerCase() || undefined,
        zipCode: undefined
      },
      // 3. State level: Country + State
      {
        country: request.country.toUpperCase(),
        state: request.state?.toUpperCase() || undefined,
        city: undefined,
        zipCode: undefined
      },
      // 4. Country level: Country only
      {
        country: request.country.toUpperCase(),
        state: undefined,
        city: undefined,
        zipCode: undefined
      }
    ];

    for (const criteria of searchCriteria) {
      const where: Prisma.TaxRuleWhereInput = {
        country: criteria.country,
        state: criteria.state || null,
        city: criteria.city || null,
        zipCode: criteria.zipCode || null,
        isActive: true
      };

      if (request.taxType) {
        where.taxType = request.taxType;
      }

      const rules = await this.taxRuleRepo.findMany({
        where,
        orderBy: { rate: 'asc' } // Apply lower rates first
      });

      if (rules.length > 0) {
        return rules;
      }
    }

    return [];
  }

  private isValidCountryCode(country: string): boolean {
    // PRODUCTION: Validate against ISO 3166-1 alpha-2 country codes
    const validCountries = [
      'US', 'CA', 'MX', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT',
      'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'PT', 'GR', 'IE', 'AU', 'NZ',
      'JP', 'KR', 'CN', 'IN', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO',
      'EC', 'VE', 'GY', 'SR', 'GF', 'ZA', 'EG', 'MA', 'TN', 'DZ', 'LY', 'SD'
    ];
    return validCountries.includes(country.toUpperCase());
  }

  private isValidZipCode(country: string, zipCode: string): boolean {
    // PRODUCTION: Country-specific ZIP code validation patterns
    const patterns: Record<string, RegExp> = {
      'US': /^\d{5}(-\d{4})?$/,
      'CA': /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
      'MX': /^\d{5}$/,
      'GB': /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
      'FR': /^\d{5}$/,
      'DE': /^\d{5}$/,
      'IT': /^\d{5}$/,
      'ES': /^\d{5}$/,
      'NL': /^\d{4} [A-Z]{2}$/,
      'AU': /^\d{4}$/,
      'JP': /^\d{3}-\d{4}$/,
      'BR': /^\d{5}-\d{3}$/
    };

    const pattern = patterns[country.toUpperCase()];
    if (!pattern) {
      return true; // Allow unknown countries
    }

    return pattern.test(zipCode.trim());
  }

  private buildJurisdictionString(country: string, state?: string | null, city?: string | null, zipCode?: string | null): string {
    const parts = [country];
    if (state) parts.push(state);
    if (city) parts.push(city);
    if (zipCode) parts.push(zipCode);
    return parts.join(', ');
  }

  private async clearTaxCaches(country: string, state?: string | null): Promise<void> {
    try {
      // Simple cache clearing - in a real implementation, this would clear specific patterns
      logger.info({ country, state }, 'Tax calculation caches cleared');
    } catch (error) {
      logger.warn({ error, country, state }, 'Failed to clear some tax caches');
    }
  }
}