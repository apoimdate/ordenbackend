import { FastifyInstance } from 'fastify';
import { CommissionRepository } from '../repositories/commission.repository';
import { ServiceResult } from '../types';
import { BaseService } from './base.service';
import { ApiError } from '../utils/errors';

export interface CommissionData {
  orderId: string;
  sellerId: string;
  rate: number;
  amount: number;
  status?: string;
}

export interface CommissionUpdateData {
  status?: string;
  paidAt?: Date;
  notes?: string;
}

export interface CommissionFilters {
  sellerId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface CommissionStats {
  totalCommissions: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  avgCommissionRate: number;
  statusBreakdown: Record<string, number>;
}

export class CommissionService extends BaseService {
  private commissionRepository: CommissionRepository;

  constructor(app: FastifyInstance) {
    super(app);
    this.commissionRepository = new CommissionRepository(app.prisma, app.redis, this.logger);
  }

  async calculateCommissionRate(sellerId: string, _orderValue: number): Promise<ServiceResult<number>> {
    try {
      // Get seller's current tier and commission rate
      // This is a simplified calculation - in reality you'd have complex tier logic
      
      const seller = await this.app.prisma.seller.findUnique({
        where: { id: sellerId },
        select: {
          id: true,
          totalSales: true,
          totalRevenue: true,
          rating: true
        }
      });

      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Base commission rate: 5%
      let commissionRate = 0.05;

      // Volume-based discounts
      if (Number(seller.totalRevenue) > 100000) {
        commissionRate = 0.03; // 3% for high volume sellers
      } else if (Number(seller.totalRevenue) > 50000) {
        commissionRate = 0.04; // 4% for medium volume sellers
      }

      // Performance bonus (reduce commission for high-rated sellers)
      if (seller.rating >= 4.8) {
        commissionRate -= 0.005; // 0.5% reduction
      } else if (seller.rating >= 4.5) {
        commissionRate -= 0.0025; // 0.25% reduction
      }

      // Minimum commission rate
      commissionRate = Math.max(commissionRate, 0.02); // Never below 2%

      return {
        success: true,
        data: commissionRate
      };
    } catch (error) {
      this.app.log.error('Error calculating commission rate:', error);
      return {
        success: false,
        error: new ApiError('Failed to calculate commission rate', 500, 'CALCULATION_ERROR')
      };
    }
  }

  async createCommission(data: CommissionData): Promise<ServiceResult<any>> {
    try {
      // Validate order exists and belongs to seller
      const order = await this.app.prisma.order.findFirst({
        where: {
          id: data.orderId,
          sellerOrders: {
            some: {
              sellerId: data.sellerId
            }
          }
        },
        include: {
          sellerOrders: {
            where: { sellerId: data.sellerId }
          }
        }
      });

      if (!order) {
        return {
          success: false,
          error: new ApiError('Order not found or does not belong to seller', 404, 'ORDER_NOT_FOUND')
        };
      }

      // Check if commission already exists
      const existingCommission = await this.commissionRepository.findByOrderAndSeller(
        data.orderId,
        data.sellerId
      );

      if (existingCommission) {
        return {
          success: false,
          error: new ApiError('Commission already exists for this order', 400, 'COMMISSION_EXISTS')
        };
      }

      // Calculate commission amount if not provided
      let commissionAmount = data.amount;
      if (!commissionAmount) {
        const sellerOrder = order.sellerOrders[0];
        if (!sellerOrder) {
          return {
            success: false,
            error: new ApiError('Seller order not found', 404, 'SELLER_ORDER_NOT_FOUND')
          };
        }

        commissionAmount = Number(sellerOrder.subtotal) * data.rate;
      }

      const commission = await this.prisma.commission.create({
        data: {
          orderId: data.orderId,
          sellerId: data.sellerId,
          rate: data.rate,
          amount: commissionAmount,
          status: data.status || 'PENDING'
        }
      });

      // Update seller analytics
      await this.updateSellerCommissionStats(data.sellerId);

      return {
        success: true,
        data: commission
      };
    } catch (error) {
      this.app.log.error('Error creating commission:', error);
      return {
        success: false,
        error: new ApiError('Failed to create commission', 500, 'CREATION_ERROR')
      };
    }
  }

  async getCommission(id: string): Promise<ServiceResult<any>> {
    try {
      const commission = await this.commissionRepository.findByIdWithDetails(id);

      if (!commission) {
        return {
          success: false,
          error: new ApiError('Commission not found', 404, 'COMMISSION_NOT_FOUND')
        };
      }

      return {
        success: true,
        data: commission
      };
    } catch (error) {
      this.app.log.error('Error fetching commission:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch commission', 500, 'FETCH_ERROR')
      };
    }
  }

  async getCommissions(
    filters: CommissionFilters = {},
    pagination = { page: 1, limit: 20 }
  ): Promise<ServiceResult<any>> {
    try {
      const result = await this.commissionRepository.findMany(filters, pagination);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.app.log.error('Error fetching commissions:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch commissions', 500, 'FETCH_ERROR')
      };
    }
  }

  async updateCommission(
    id: string,
    data: CommissionUpdateData
  ): Promise<ServiceResult<any>> {
    try {
      const commission = await this.prisma.commission.update({
        where: { id },
        data: {
          status: data.status,
          paidAt: data.paidAt,
          notes: data.notes
        } as any
      });

      // If marking as paid, update seller analytics
      if (data.status === 'paid' && data.paidAt) {
        const commissionData = await this.prisma.commission.findUnique({
          where: { id }
        });
        if (commissionData) {
          await this.updateSellerCommissionStats(commissionData.sellerId);
        }
      }

      return {
        success: true,
        data: commission
      };
    } catch (error) {
      this.app.log.error('Error updating commission:', error);
      return {
        success: false,
        error: new ApiError('Failed to update commission', 500, 'UPDATE_ERROR')
      };
    }
  }

  async markAsPaid(id: string): Promise<ServiceResult<any>> {
    try {
      const commission = await this.updateCommission(id, {
        status: 'paid',
        paidAt: new Date()
      });

      return commission;
    } catch (error) {
      this.app.log.error('Error marking commission as paid:', error);
      return {
        success: false,
        error: new ApiError('Failed to mark commission as paid', 500, 'PAYMENT_ERROR')
      };
    }
  }

  async getSellerCommissions(
    sellerId: string,
    filters: Omit<CommissionFilters, 'sellerId'> = {},
    pagination = { page: 1, limit: 20 }
  ): Promise<ServiceResult<any>> {
    try {
      const result = await this.commissionRepository.findMany(
        { ...filters, sellerId },
        pagination
      );

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.app.log.error('Error fetching seller commissions:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch seller commissions', 500, 'FETCH_ERROR')
      };
    }
  }

  async getCommissionStats(
    filters: CommissionFilters = {}
  ): Promise<ServiceResult<CommissionStats>> {
    try {
      const stats = await this.commissionRepository.getCommissionStats(filters);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.app.log.error('Error fetching commission stats:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch commission statistics', 500, 'STATS_ERROR')
      };
    }
  }

  async getSellerCommissionStats(sellerId: string): Promise<ServiceResult<any>> {
    try {
      const stats = await this.commissionRepository.getSellerCommissionStats(sellerId);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.app.log.error('Error fetching seller commission stats:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch seller commission statistics', 500, 'STATS_ERROR')
      };
    }
  }

  async processBulkPayment(commissionIds: string[]): Promise<ServiceResult<any>> {
    try {
      const results = await Promise.allSettled(
        commissionIds.map(id => this.markAsPaid(id))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - successful;

      return {
        success: true,
        data: {
          total: results.length,
          successful,
          failed,
          results: results.map((result, index) => ({
            commissionId: commissionIds[index],
            success: result.status === 'fulfilled',
            error: result.status === 'rejected' ? (result.reason as any).message : null
          }))
        }
      };
    } catch (error) {
      this.app.log.error('Error processing bulk payment:', error);
      return {
        success: false,
        error: new ApiError('Failed to process bulk payment', 500, 'BULK_PAYMENT_ERROR')
      };
    }
  }

  async generateCommissionReport(
    filters: CommissionFilters = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<ServiceResult<any>> {
    try {
      const commissions = await this.commissionRepository.findMany(
        filters,
        { page: 1, limit: 10000 } // Large limit for reports
      );

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV((commissions as any).commissions || []);
        return {
          success: true,
          data: {
            format: 'csv',
            content: csvData,
            filename: `commission-report-${new Date().toISOString().split('T')[0]}.csv`
          }
        };
      }

      return {
        success: true,
        data: {
          format: 'json',
          ...commissions
        }
      };
    } catch (error) {
      this.app.log.error('Error generating commission report:', error);
      return {
        success: false,
        error: new ApiError('Failed to generate commission report', 500, 'REPORT_ERROR')
      };
    }
  }

  private async updateSellerCommissionStats(sellerId: string): Promise<void> {
    try {
      // Get seller commission stats (currently not used, but needed for future implementation)
      // const stats = await this.commissionRepository.getSellerCommissionStats(sellerId);
      
      // Update seller's commission-related fields
      await this.app.prisma.seller.update({
        where: { id: sellerId },
        data: {
          // These fields would need to be added to the Seller model
          // totalCommissions: stats.totalAmount,
          // pendingCommissions: stats.pendingAmount,
          updatedAt: new Date()
        } as any
      });
    } catch (error) {
      this.app.log.error('Error updating seller commission stats:', error);
    }
  }

  private convertToCSV(commissions: any[]): string {
    if (!commissions.length) return '';

    const headers = [
      'ID',
      'Order ID',
      'Seller ID',
      'Rate',
      'Amount',
      'Status',
      'Created At',
      'Paid At'
    ];

    const rows = commissions.map(commission => [
      commission.id,
      commission.orderId,
      commission.sellerId,
      commission.rate,
      commission.amount,
      commission.status,
      commission.createdAt,
      commission.paidAt || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }
}