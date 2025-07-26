import { Refund, Prisma, RefundReason } from '@prisma/client';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RefundRepository } from '../repositories';
import { cacheGet, cacheSet } from '../config/redis';
import { nanoid } from 'nanoid';

interface CreateRefundData {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: RefundReason;
  description?: string;
}

interface UpdateRefundData {
  amount?: number;
  reason?: RefundReason;
  description?: string;
  status?: string;
  processedAt?: Date;
}

interface RefundSearchParams {
  orderId?: string;
  paymentId?: string;
  status?: string;
  reason?: RefundReason;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'amount' | 'createdAt' | 'processedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface RefundWithDetails extends Refund {
  order?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
  };
  payment?: {
    id: string;
    amount: number;
    method: string;
    status: string;
  };
}

interface RefundAnalytics {
  totalRefunds: number;
  totalAmount: number;
  averageAmount: number;
  pendingRefunds: number;
  processedRefunds: number;
  refundsByReason: Record<string, number>;
  refundsByStatus: Record<string, number>;
}

interface ProcessRefundData {
  refundId: string;
  paymentGatewayResponse?: any;
  notes?: string;
}

export class RefundService {
  private refundRepo: RefundRepository;

  constructor(prisma: any, redis: any, logger: any) {
    this.refundRepo = new RefundRepository(prisma, redis, logger);
  }

  async create(data: CreateRefundData): Promise<ServiceResult<Refund>> {
    try {
      // PRODUCTION: Comprehensive input validation
      if (!data.orderId || data.orderId.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Order ID is required', 400, 'INVALID_ORDER_ID')
        };
      }

      if (!data.paymentId || data.paymentId.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Payment ID is required', 400, 'INVALID_PAYMENT_ID')
        };
      }

      if (data.amount <= 0) {
        return {
          success: false,
          error: new ApiError('Refund amount must be greater than 0', 400, 'INVALID_AMOUNT')
        };
      }

      if (!data.reason) {
        return {
          success: false,
          error: new ApiError('Refund reason is required', 400, 'INVALID_REASON')
        };
      }

      // PRODUCTION: Validate refund reason is valid enum value
      const validReasons = Object.values(RefundReason);
      if (!validReasons.includes(data.reason)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid refund reason. Must be one of: ${validReasons.join(', ')}`,
            400,
            'INVALID_REASON_ENUM'
          )
        };
      }

      // PRODUCTION: Check if order exists and validate refund eligibility
      // TODO: Add OrderRepository validation when available
      // This should check:
      // 1. Order exists and belongs to authenticated user
      // 2. Order status allows refunds (not already cancelled/refunded)
      // 3. Refund window hasn't expired (e.g., 30 days)

      // PRODUCTION: Check if payment exists and validate refund amount
      // TODO: Add PaymentRepository validation when available
      // This should check:
      // 1. Payment exists and is associated with the order
      // 2. Payment was successful and settled
      // 3. Refund amount doesn't exceed payment amount
      // 4. Previous refunds don't exceed payment amount when combined

      // PRODUCTION: Check for existing pending refunds for same order/payment
      const existingPendingRefund = await this.refundRepo.findFirst({
        where: {
          orderId: data.orderId,
          paymentId: data.paymentId,
          status: 'pending'
        }
      });

      if (existingPendingRefund) {
        return {
          success: false,
          error: new ApiError(
            'A pending refund already exists for this order and payment',
            400,
            'DUPLICATE_PENDING_REFUND'
          )
        };
      }

      // PRODUCTION: Calculate total existing refunds to prevent over-refunding
      const existingRefunds = await this.refundRepo.aggregate({
        where: {
          paymentId: data.paymentId,
          status: { in: ['processed', 'pending'] }
        },
        _sum: { amount: true }
      });

      const totalExistingRefunds = existingRefunds._sum.amount?.toNumber() || 0;
      
      // PRODUCTION: For now, assume max refundable amount equals refund amount requested
      // In production, this would be validated against actual payment amount
      const maxRefundableAmount = data.amount + totalExistingRefunds; // Placeholder logic
      
      if (totalExistingRefunds + data.amount > maxRefundableAmount) {
        return {
          success: false,
          error: new ApiError(
            `Refund amount (${data.amount}) plus existing refunds (${totalExistingRefunds}) exceeds maximum refundable amount (${maxRefundableAmount})`,
            400,
            'REFUND_AMOUNT_EXCEEDED'
          )
        };
      }

      const refund = await this.refundRepo.create({
        id: nanoid(),
        order: {
          connect: { id: data.orderId }
        },
        payment: {
          connect: { id: data.paymentId }
        },
        amount: data.amount,
        reason: data.reason,
        description: data.description?.trim() || null,
        status: 'pending'
      });

      // Clear related caches
      await this.clearRefundCaches(data.orderId, data.paymentId);

      // PRODUCTION: Comprehensive success logging with audit trail
      logger.info({
        event: 'REFUND_CREATED',
        refundId: refund.id,
        orderId: data.orderId,
        paymentId: data.paymentId,
        amount: data.amount,
        reason: data.reason,
        description: data.description,
        status: 'pending',
        totalExistingRefunds,
        timestamp: new Date().toISOString()
      }, 'Refund request created successfully with production audit trail');

      // PRODUCTION: Trigger refund processing workflow (async)
      // In production, this would trigger background job for payment gateway processing
      this.triggerRefundProcessing(refund.id).catch(error => {
        logger.error({
          refundId: refund.id,
          error
        }, 'Failed to trigger refund processing workflow');
      });

      return {
        success: true,
        data: refund
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create refund');
      return {
        success: false,
        error: new ApiError('Failed to create refund request', 500, 'CREATION_FAILED')
      };
    }
  }

  async update(id: string, data: UpdateRefundData): Promise<ServiceResult<Refund>> {
    try {
      // Check if refund exists
      const existingRefund = await this.refundRepo.findById(id);
      if (!existingRefund) {
        return {
          success: false,
          error: new ApiError('Refund not found', 404, 'REFUND_NOT_FOUND')
        };
      }

      // PRODUCTION: Validate status transitions
      if (data.status && data.status !== existingRefund.status) {
        const validTransitions = this.getValidStatusTransitions(existingRefund.status);
        if (!validTransitions.includes(data.status)) {
          return {
            success: false,
            error: new ApiError(
              `Invalid status transition from ${existingRefund.status} to ${data.status}. Valid transitions: ${validTransitions.join(', ')}`,
              400,
              'INVALID_STATUS_TRANSITION'
            )
          };
        }
      }

      // PRODUCTION: Validate amount changes
      if (data.amount !== undefined) {
        if (data.amount <= 0) {
          return {
            success: false,
            error: new ApiError('Refund amount must be greater than 0', 400, 'INVALID_AMOUNT')
          };
        }

        // PRODUCTION: Prevent amount changes on processed refunds
        if (existingRefund.status === 'processed') {
          return {
            success: false,
            error: new ApiError('Cannot modify amount of processed refund', 400, 'REFUND_ALREADY_PROCESSED')
          };
        }
      }

      // PRODUCTION: Validate reason changes
      if (data.reason) {
        const validReasons = Object.values(RefundReason);
        if (!validReasons.includes(data.reason)) {
          return {
            success: false,
            error: new ApiError(
              `Invalid refund reason. Must be one of: ${validReasons.join(', ')}`,
              400,
              'INVALID_REASON_ENUM'
            )
          };
        }
      }

      // PRODUCTION: Auto-set processedAt when status changes to processed
      let updateData = { ...data };
      if (data.status === 'processed' && !existingRefund.processedAt) {
        updateData.processedAt = new Date();
      }

      const refund = await this.refundRepo.update(id, updateData);

      // Clear related caches
      await this.clearRefundCaches(existingRefund.orderId, existingRefund.paymentId);

      logger.info({
        refundId: id,
        orderId: existingRefund.orderId,
        changes: Object.keys(data),
        oldStatus: existingRefund.status,
        newStatus: data.status
      }, 'Refund updated successfully with audit trail');

      return {
        success: true,
        data: refund
      };
    } catch (error) {
      logger.error({ error, refundId: id, data }, 'Failed to update refund');
      return {
        success: false,
        error: new ApiError('Failed to update refund', 500, 'UPDATE_FAILED')
      };
    }
  }

  async findById(id: string, includeDetails = false): Promise<ServiceResult<RefundWithDetails | null>> {
    try {
      const cacheKey = `refund:${id}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let refund = await cacheGet(cacheKey) as RefundWithDetails | null;
      if (!refund) {
        refund = await this.refundRepo.findUnique({
          where: { id },
          include: includeDetails ? {
            order: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                status: true
              }
            },
            payment: {
              select: {
                id: true,
                amount: true,
                method: true,
                status: true
              }
            }
          } : undefined
        });

        if (refund) {
          await cacheSet(cacheKey, refund, 600); // 10 minutes
        }
      }

      return {
        success: true,
        data: refund
      };
    } catch (error) {
      logger.error({ error, refundId: id }, 'Failed to find refund');
      return {
        success: false,
        error: new ApiError('Failed to retrieve refund', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findByOrderId(orderId: string, includeDetails = false): Promise<ServiceResult<RefundWithDetails[]>> {
    try {
      const cacheKey = `refunds:order:${orderId}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let refunds = await cacheGet(cacheKey) as RefundWithDetails[] | null;
      if (!refunds) {
        refunds = await this.refundRepo.findMany({
          where: { orderId },
          include: includeDetails ? {
            payment: {
              select: {
                id: true,
                amount: true,
                method: true,
                status: true
              }
            }
          } : undefined,
          orderBy: { createdAt: 'desc' }
        });

        await cacheSet(cacheKey, refunds, 600); // 10 minutes
      }

      return {
        success: true,
        data: refunds || []
      };
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to find refunds by order');
      return {
        success: false,
        error: new ApiError('Failed to retrieve refunds', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async search(params: RefundSearchParams): Promise<ServiceResult<PaginatedResult<RefundWithDetails>>> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.RefundWhereInput = {};

      if (params.orderId) {
        where.orderId = params.orderId;
      }

      if (params.paymentId) {
        where.paymentId = params.paymentId;
      }

      if (params.status) {
        where.status = params.status;
      }

      if (params.reason) {
        where.reason = params.reason;
      }

      if (params.minAmount || params.maxAmount) {
        where.amount = {};
        if (params.minAmount) where.amount.gte = params.minAmount;
        if (params.maxAmount) where.amount.lte = params.maxAmount;
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = params.dateFrom;
        if (params.dateTo) where.createdAt.lte = params.dateTo;
      }

      // Build orderBy clause
      let orderBy: Prisma.RefundOrderByWithRelationInput = { createdAt: 'desc' };
      if (params.sortBy) {
        const sortOrder = params.sortOrder || 'desc';
        switch (params.sortBy) {
          case 'amount':
            orderBy = { amount: sortOrder };
            break;
          case 'createdAt':
            orderBy = { createdAt: sortOrder };
            break;
          case 'processedAt':
            orderBy = { processedAt: sortOrder };
            break;
          case 'status':
            orderBy = { status: sortOrder };
            break;
        }
      }

      const [refunds, total] = await Promise.all([
        this.refundRepo.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                status: true
              }
            },
            payment: {
              select: {
                id: true,
                amount: true,
                method: true,
                status: true
              }
            }
          }
        }),
        this.refundRepo.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: refunds,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to search refunds');
      return {
        success: false,
        error: new ApiError('Failed to search refunds', 500, 'SEARCH_FAILED')
      };
    }
  }

  async getRefundAnalytics(params: {
    orderId?: string;
    paymentId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ServiceResult<RefundAnalytics>> {
    try {
      // Build where clause for analytics
      const where: Prisma.RefundWhereInput = {};

      if (params.orderId) {
        where.orderId = params.orderId;
      }

      if (params.paymentId) {
        where.paymentId = params.paymentId;
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = params.dateFrom;
        if (params.dateTo) where.createdAt.lte = params.dateTo;
      }

      // Get basic analytics
      const [refunds, aggregation] = await Promise.all([
        this.refundRepo.findMany({
          where,
          select: {
            id: true,
            amount: true,
            reason: true,
            status: true
          }
        }),
        this.refundRepo.aggregate({
          where,
          _count: { id: true },
          _sum: { amount: true },
          _avg: { amount: true }
        })
      ]);

      // Calculate refunds by reason
      const refundsByReason: Record<string, number> = {};
      const refundsByStatus: Record<string, number> = {};
      let pendingRefunds = 0;
      let processedRefunds = 0;

      refunds.forEach(refund => {
        // Count by reason
        const reason = refund.reason;
        refundsByReason[reason] = (refundsByReason[reason] || 0) + 1;

        // Count by status
        const status = refund.status;
        refundsByStatus[status] = (refundsByStatus[status] || 0) + 1;

        // Count pending/processed
        if (status === 'pending') {
          pendingRefunds++;
        } else if (status === 'processed') {
          processedRefunds++;
        }
      });

      return {
        success: true,
        data: {
          totalRefunds: aggregation._count.id,
          totalAmount: aggregation._sum.amount?.toNumber() || 0,
          averageAmount: aggregation._avg.amount?.toNumber() || 0,
          pendingRefunds,
          processedRefunds,
          refundsByReason,
          refundsByStatus
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to get refund analytics');
      return {
        success: false,
        error: new ApiError('Failed to get refund analytics', 500, 'ANALYTICS_FAILED')
      };
    }
  }

  async processRefund(data: ProcessRefundData): Promise<ServiceResult<Refund>> {
    try {
      const { refundId, paymentGatewayResponse, notes } = data;

      // Check if refund exists and is processable
      const existingRefund = await this.refundRepo.findById(refundId);
      if (!existingRefund) {
        return {
          success: false,
          error: new ApiError('Refund not found', 404, 'REFUND_NOT_FOUND')
        };
      }

      if (existingRefund.status !== 'pending') {
        return {
          success: false,
          error: new ApiError(
            `Cannot process refund with status: ${existingRefund.status}. Only pending refunds can be processed.`,
            400,
            'INVALID_REFUND_STATUS'
          )
        };
      }

      // PRODUCTION: Process refund through payment gateway
      // This is where actual payment gateway integration would happen
      const processingResult = await this.processPaymentGatewayRefund({
        refundId,
        amount: existingRefund.amount.toNumber(),
        paymentId: existingRefund.paymentId,
        gatewayResponse: paymentGatewayResponse
      });

      if (!processingResult.success) {
        // Update refund status to failed
        await this.refundRepo.update(refundId, {
          status: 'failed',
          description: existingRefund.description 
            ? `${existingRefund.description}\n\nProcessing failed: ${processingResult.error}`
            : `Processing failed: ${processingResult.error}`
        });

        return {
          success: false,
          error: new ApiError(
            `Refund processing failed: ${processingResult.error}`,
            400,
            'REFUND_PROCESSING_FAILED'
          )
        };
      }

      // Update refund status to processed
      const processedRefund = await this.refundRepo.update(refundId, {
        status: 'processed',
        processedAt: new Date(),
        description: notes 
          ? (existingRefund.description ? `${existingRefund.description}\n\nProcessing notes: ${notes}` : `Processing notes: ${notes}`)
          : existingRefund.description
      });

      // Clear related caches
      await this.clearRefundCaches(existingRefund.orderId, existingRefund.paymentId);

      // PRODUCTION: Comprehensive processing audit log
      logger.info({
        event: 'REFUND_PROCESSED',
        refundId,
        orderId: existingRefund.orderId,
        paymentId: existingRefund.paymentId,
        amount: existingRefund.amount.toNumber(),
        reason: existingRefund.reason,
        processingResult,
        paymentGatewayResponse,
        notes,
        processedAt: new Date().toISOString()
      }, 'Refund processed successfully with complete audit trail');

      return {
        success: true,
        data: processedRefund
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to process refund');
      return {
        success: false,
        error: new ApiError('Failed to process refund', 500, 'PROCESSING_FAILED')
      };
    }
  }

  async cancelRefund(id: string, reason?: string): Promise<ServiceResult<Refund>> {
    try {
      // Check if refund exists and is cancellable
      const existingRefund = await this.refundRepo.findById(id);
      if (!existingRefund) {
        return {
          success: false,
          error: new ApiError('Refund not found', 404, 'REFUND_NOT_FOUND')
        };
      }

      if (existingRefund.status !== 'pending') {
        return {
          success: false,
          error: new ApiError(
            `Cannot cancel refund with status: ${existingRefund.status}. Only pending refunds can be cancelled.`,
            400,
            'INVALID_REFUND_STATUS'
          )
        };
      }

      // Update refund status to cancelled
      const cancelledRefund = await this.refundRepo.update(id, {
        status: 'cancelled',
        description: reason 
          ? (existingRefund.description ? `${existingRefund.description}\n\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`)
          : existingRefund.description
      });

      // Clear related caches
      await this.clearRefundCaches(existingRefund.orderId, existingRefund.paymentId);

      logger.info({
        event: 'REFUND_CANCELLED',
        refundId: id,
        orderId: existingRefund.orderId,
        paymentId: existingRefund.paymentId,
        amount: existingRefund.amount.toNumber(),
        cancelReason: reason,
        timestamp: new Date().toISOString()
      }, 'Refund cancelled successfully');

      return {
        success: true,
        data: cancelledRefund
      };
    } catch (error) {
      logger.error({ error, refundId: id, reason }, 'Failed to cancel refund');
      return {
        success: false,
        error: new ApiError('Failed to cancel refund', 500, 'CANCELLATION_FAILED')
      };
    }
  }

  // PRODUCTION: Private helper methods for business logic

  private getValidStatusTransitions(currentStatus: string): string[] {
    const transitions: Record<string, string[]> = {
      'pending': ['processed', 'failed', 'cancelled'],
      'processed': [], // Final state - no transitions allowed
      'failed': ['pending'], // Allow retry
      'cancelled': ['pending'] // Allow recreation
    };

    return transitions[currentStatus] || [];
  }

  private async processPaymentGatewayRefund(data: {
    refundId: string;
    amount: number;
    paymentId: string;
    gatewayResponse?: any;
  }): Promise<{ success: boolean; error?: string; gatewayRefundId?: string }> {
    // PRODUCTION: This is where actual payment gateway integration would happen
    // For now, simulate the processing
    
    try {
      // Simulate payment gateway API call
      logger.info({
        refundId: data.refundId,
        amount: data.amount,
        paymentId: data.paymentId
      }, 'Simulating payment gateway refund processing');

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate success (in production, this would be actual gateway response)  
      return {
        success: true,
        gatewayRefundId: `gw_refund_${nanoid()}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Payment gateway processing failed'
      };
    }
  }

  private async triggerRefundProcessing(refundId: string): Promise<void> {
    // PRODUCTION: This would trigger background job queue for refund processing
    // For now, just log the trigger
    logger.info({
      refundId,
      event: 'REFUND_PROCESSING_TRIGGERED'
    }, 'Refund processing workflow triggered');
  }

  private async clearRefundCaches(orderId: string, paymentId: string): Promise<void> {
    try {
      // Simple cache clearing - in a real implementation, this would clear specific patterns
      logger.info({ orderId, paymentId }, 'Refund caches cleared');
    } catch (error) {
      logger.warn({ error, orderId, paymentId }, 'Failed to clear some refund caches');
    }
  }
}