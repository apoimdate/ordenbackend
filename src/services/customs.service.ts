import { FastifyInstance } from 'fastify';
import { CustomsDeclarationRepository } from '../repositories/customs-declaration.repository';
import { ServiceResult } from '../types';
import { CustomsStatus, Currency } from '@prisma/client';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface CreateCustomsDeclarationData {
  orderId: string;
  countryFrom: string;
  countryTo: string;
  description: string;
  hsCode?: string;
  weight?: number;
  notes?: string;
}

export interface UpdateCustomsDeclarationData {
  status?: CustomsStatus;
  customsDuty?: number;
  vat?: number;
  handlingFee?: number;
  declaredAt?: Date;
  clearedAt?: Date;
  releasedAt?: Date;
  notes?: string;
}

export interface CustomsItemData {
  productId: string;
  quantity: number;
  description: string;
  hsCode?: string;
  weight?: number;
}

export interface CustomsCalculationData {
  countryFrom: string;
  countryTo: string;
  totalValue: number;
  currency: Currency;
  weight?: number;
  items: CustomsItemData[];
}

export interface CustomsFilters {
  status?: CustomsStatus;
  countryFrom?: string;
  countryTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

// Cuban import duty rates (simplified - in production these would be in a config)
const CUBA_IMPORT_RATES = {
  defaultDutyRate: 0.30, // 30% default import duty
  vatRate: 0.10, // 10% VAT
  handlingFeeBase: 10, // $10 base handling fee
  handlingFeeRate: 0.02, // 2% of value
  exemptCategories: ['MEDICINE', 'BABY_FOOD', 'BOOKS'],
  reducedRateCategories: {
    'FOOD': 0.20,
    'CLOTHING': 0.25,
    'PERSONAL_HYGIENE': 0.20
  },
  weightBasedFee: 0.50 // $0.50 per kg
};

export class CustomsService {
  private customsRepository: CustomsDeclarationRepository;

  constructor(private app: FastifyInstance) {
    this.customsRepository = new CustomsDeclarationRepository(app.prisma, app.redis, logger);
  }

  async calculateCustomsFees(data: CustomsCalculationData): Promise<ServiceResult<any>> {
    try {
      // Validate countries
      if (!data.countryFrom || !data.countryTo) {
        throw new ApiError('Country from and country to are required', 400);
      }

      // Only calculate fees for imports to Cuba
      if (data.countryTo !== 'CU') {
        return {
          success: true,
          data: {
            customsDuty: 0,
            vat: 0,
            handlingFee: 0,
            totalFees: 0,
            requiresDeclaration: false
          }
        };
      }

      const totalValue = Number(data.totalValue);
      const weight = data.weight || 0;

      // Calculate base customs duty
      let customsDuty = totalValue * CUBA_IMPORT_RATES.defaultDutyRate;

      // Apply category-based rates if available
      // In production, this would check actual product categories
      // For now, using default rate

      // Calculate VAT (on value + duty)
      const vat = (totalValue + customsDuty) * CUBA_IMPORT_RATES.vatRate;

      // Calculate handling fee
      const handlingFee = CUBA_IMPORT_RATES.handlingFeeBase +
        (totalValue * CUBA_IMPORT_RATES.handlingFeeRate) +
        (weight * CUBA_IMPORT_RATES.weightBasedFee);

      const totalFees = customsDuty + vat + handlingFee;

      return {
        success: true,
        data: {
          customsDuty: Math.round(customsDuty * 100) / 100,
          vat: Math.round(vat * 100) / 100,
          handlingFee: Math.round(handlingFee * 100) / 100,
          totalFees: Math.round(totalFees * 100) / 100,
          requiresDeclaration: true,
          estimatedProcessingDays: 5
        }
      };
    } catch (error) {
      this.app.log.error('Error calculating customs fees:', error);
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: 'Failed to calculate customs fees',
          statusCode: 500
        }
      };
    }
  }

  async createDeclaration(data: CreateCustomsDeclarationData): Promise<ServiceResult<any>> {
    try {
      // Validate order exists
      const order = await this.app.prisma.order.findUnique({
        where: { id: data.orderId },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!order) {
        throw new ApiError('Order not found', 404);
      }

      // Check if declaration already exists
      const existingDeclaration = await this.customsRepository.findByOrderId(data.orderId);
      if (existingDeclaration) {
        throw new ApiError('Customs declaration already exists for this order', 409);
      }

      // Generate unique declaration number
      const declarationNumber = `CD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Calculate fees
      const calculationResult = await this.calculateCustomsFees({
        countryFrom: data.countryFrom,
        countryTo: data.countryTo,
        totalValue: Number(order.totalAmount),
        currency: order.currency,
        weight: data.weight,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          description: item.product.name,
          weight: item.product.weight
        })) as any
      });

      if (!calculationResult.success) {
        return calculationResult;
      }

      const fees = calculationResult.data;

      // Create declaration
      const declaration = await this.customsRepository.create({
        ...data,
        declarationNumber,
        // totalValue: Number(order.total), // Field doesn't exist in CustomsDeclarationCreateData
        currency: order.currency,
        customsDuty: fees.customsDuty,
        vat: fees.vat,
        handlingFee: fees.handlingFee,
        totalFees: fees.totalFees,
      } as any);

      // Create customs items
      for (const orderItem of order.items) {
        await this.customsRepository.addItem({
          declarationId: declaration.id,
          productId: orderItem.productId,
          quantity: orderItem.quantity,
          description: orderItem.product.name,
          hsCode: (orderItem.product as any).hsCode || undefined,
          weight: orderItem.product.weight || undefined
        } as any);
      }

      // Get full declaration with details
      const declarationWithDetails = await this.customsRepository.findById(declaration.id);

      return {
        success: true,
        data: declarationWithDetails
      };
    } catch (error) {
      this.app.log.error('Error creating customs declaration:', error);
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'CREATION_ERROR',
          message: 'Failed to create customs declaration',
          statusCode: 500
        }
      };
    }
  }

  async getDeclaration(id: string): Promise<ServiceResult<any>> {
    try {
      const declaration = await this.customsRepository.findById(id);

      if (!declaration) {
        throw new ApiError('Customs declaration not found', 404);
      }

      return {
        success: true,
        data: declaration
      };
    } catch (error) {
      this.app.log.error('Error fetching customs declaration:', error);
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch customs declaration',
          statusCode: 500
        }
      };
    }
  }

  async getDeclarationByOrder(orderId: string): Promise<ServiceResult<any>> {
    try {
      const declaration = await this.customsRepository.findByOrderId(orderId);

      if (!declaration) {
        throw new ApiError('No customs declaration found for this order', 404);
      }

      return {
        success: true,
        data: declaration
      };
    } catch (error) {
      this.app.log.error('Error fetching customs declaration by order:', error);
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch customs declaration',
          statusCode: 500
        }
      };
    }
  }

  async getDeclarations(
    filters: CustomsFilters = {},
    pagination = { page: 1, limit: 20 }
  ): Promise<ServiceResult<any>> {
    try {
      const result = await this.customsRepository.findMany(filters, pagination);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.app.log.error('Error fetching customs declarations:', error);
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch customs declarations',
          statusCode: 500
        }
      };
    }
  }

  async updateDeclaration(
    id: string,
    data: UpdateCustomsDeclarationData
  ): Promise<ServiceResult<any>> {
    try {
      const declaration = await this.customsRepository.update(id, data);

      return {
        success: true,
        data: declaration
      };
    } catch (error) {
      this.app.log.error('Error updating customs declaration:', error);
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update customs declaration',
          statusCode: 500
        }
      };
    }
  }

  async updateDeclarationStatus(
    id: string,
    status: CustomsStatus,
    additionalData?: Partial<UpdateCustomsDeclarationData>
  ): Promise<ServiceResult<any>> {
    try {
      const declaration = await this.customsRepository.updateStatus(id, status, additionalData);

      // Update order status if declaration is cleared
      if (status === 'CLEARED') {
        const declarationData = await this.customsRepository.findById(id);
        if (declarationData) {
          await this.app.prisma.order.update({
            where: { id: declarationData.orderId },
            data: {
              fraudFlags: {
                push: 'CUSTOMS_CLEARED'
              },
              updatedAt: new Date()
            }
          });
        }
      }

      return {
        success: true,
        data: declaration
      };
    } catch (error) {
      this.app.log.error('Error updating customs declaration status:', error);
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update customs declaration status',
          statusCode: 500
        }
      };
    }
  }

  async getDeclarationStats(filters: CustomsFilters = {}): Promise<ServiceResult<any>> {
    try {
      const stats = await this.customsRepository.getDeclarationStats(filters);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.app.log.error('Error fetching customs declaration stats:', error);
      return {
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to fetch customs declaration statistics',
          statusCode: 500
        }
      };
    }
  }

  async getTradeStats(dateFrom?: Date, dateTo?: Date): Promise<ServiceResult<any>> {
    try {
      const stats = await this.customsRepository.getCountryTradeStats(dateFrom, dateTo);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.app.log.error('Error fetching trade statistics:', error);
      return {
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to fetch trade statistics',
          statusCode: 500
        }
      };
    }
  }

  async getPendingDeclarations(): Promise<ServiceResult<any>> {
    try {
      const declarations = await this.customsRepository.getPendingDeclarations();

      return {
        success: true,
        data: declarations
      };
    } catch (error) {
      this.app.log.error('Error fetching pending declarations:', error);
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch pending declarations',
          statusCode: 500
        }
      };
    }
  }

  async addCustomsItem(data: {
    declarationId: string;
    productId: string;
    quantity: number;
    unitValue: number;
    description: string;
    hsCode?: string;
    weight?: number;
  }): Promise<ServiceResult<any>> {
    try {
      const item = await this.customsRepository.addItem({
        ...data,
        // totalValue: data.unitValue * data.quantity // Field doesn't exist in CustomsItemCreateData
      } as any);

      // Recalculate total fees
      await this.customsRepository.calculateTotalFees(data.declarationId);

      return {
        success: true,
        data: item
      };
    } catch (error) {
      this.app.log.error('Error adding customs item:', error);
      return {
        success: false,
        error: {
          code: 'ADD_ITEM_ERROR',
          message: 'Failed to add customs item',
          statusCode: 500
        }
      };
    }
  }

  async updateCustomsItem(
    itemId: string,
    data: Partial<{
      quantity: number;
      unitValue: number;
      description: string;
      hsCode?: string;
      weight?: number;
    }>
  ): Promise<ServiceResult<any>> {
    try {
      const item = await this.customsRepository.updateItem(itemId, {
        ...data,
        // totalValue: data.unitValue && data.quantity ? data.unitValue * data.quantity : undefined // Field doesn't exist
      } as any);

      return {
        success: true,
        data: item
      };
    } catch (error) {
      this.app.log.error('Error updating customs item:', error);
      return {
        success: false,
        error: {
          code: 'UPDATE_ITEM_ERROR',
          message: 'Failed to update customs item',
          statusCode: 500
        }
      };
    }
  }

  async removeCustomsItem(itemId: string): Promise<ServiceResult<any>> {
    try {
      await this.customsRepository.removeItem(itemId);

      return {
        success: true,
        data: { message: 'Customs item removed successfully' }
      };
    } catch (error) {
      this.app.log.error('Error removing customs item:', error);
      return {
        success: false,
        error: {
          code: 'REMOVE_ITEM_ERROR',
          message: 'Failed to remove customs item',
          statusCode: 500
        }
      };
    }
  }

  async generateCustomsReport(
    filters: CustomsFilters = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<ServiceResult<any>> {
    try {
      const declarations = await this.customsRepository.findMany(
        filters,
        { page: 1, limit: 10000 } // Large limit for reports
      );

      if (format === 'csv') {
        const csvData = this.convertToCSV(declarations.declarations);
        return {
          success: true,
          data: {
            format: 'csv',
            content: csvData,
            filename: `customs-report-${new Date().toISOString().split('T')[0]}.csv`
          }
        };
      }

      return {
        success: true,
        data: {
          format: 'json',
          ...declarations
        }
      };
    } catch (error) {
      this.app.log.error('Error generating customs report:', error);
      return {
        success: false,
        error: {
          code: 'REPORT_ERROR',
          message: 'Failed to generate customs report',
          statusCode: 500
        }
      };
    }
  }

  private convertToCSV(declarations: any[]): string {
    if (!declarations.length) return '';

    const headers = [
      'Declaration Number',
      'Order Number',
      'Status',
      'Country From',
      'Country To',
      'Total Value',
      'Currency',
      'Customs Duty',
      'VAT',
      'Handling Fee',
      'Total Fees',
      'Created At',
      'Declared At',
      'Cleared At'
    ];

    const rows = declarations.map(declaration => [
      declaration.declarationNumber,
      declaration.order?.orderNumber || '',
      declaration.status,
      declaration.countryFrom,
      declaration.countryTo,
      declaration.totalValue,
      declaration.currency,
      declaration.customsDuty || 0,
      declaration.vat || 0,
      declaration.handlingFee || 0,
      declaration.totalFees || 0,
      declaration.createdAt,
      declaration.declaredAt || '',
      declaration.clearedAt || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }
}