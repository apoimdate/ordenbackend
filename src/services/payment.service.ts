import { Payment, PaymentMethod, PaymentStatus, Refund, Payout, Prisma, Currency } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { logger as appLogger } from '../utils/logger';
import Stripe from 'stripe';
import { config } from '../config';
import { CrudService } from './crud.service';
import { PaymentRepository } from '../repositories/payment.repository';
import { RefundRepository } from '../repositories/refund.repository';
import { PayoutRepository } from '../repositories/payout.repository';
import { OrderRepository } from '../repositories/order.repository';
import { UserRepository } from '../repositories/user.repository';
import { WalletRepository } from '../repositories/wallet.repository';
// import { WalletTransactionRepository } from '../repositories/wallet-transaction.repository'; // Currently not used
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';

interface CreatePaymentData {
  orderId: string;
  method: PaymentMethod;
  amount: number;
  currency: Currency;
  paymentMethodId?: string; // Stripe payment method ID
  walletId?: string; // For wallet payments
  metadata?: Record<string, any>;
}

interface ProcessPaymentData {
  paymentId: string;
  paymentIntentId?: string; // Stripe payment intent ID
  externalTransactionId?: string;
  metadata?: Record<string, any>;
}

interface CreateRefundData {
  paymentId: string;
  amount?: number; // Partial refund amount, if not provided, full refund
  reason: string;
  metadata?: Record<string, any>;
}

interface CreatePayoutData {
  sellerId: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  accountId?: string; // External account ID (Stripe, PayPal, etc.)
  metadata?: Record<string, any>;
}

interface PaymentSearchParams {
  orderId?: string;
  userId?: string;
  sellerId?: string;
  status?: PaymentStatus[];
  method?: PaymentMethod[];
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  currency?: Currency;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'amount_asc' | 'amount_desc';
  search?: string;
}

interface PaymentWithDetails extends Payment {
  order: {
    orderNumber: string;
    user: { email: string; firstName?: string; lastName?: string };
  };
  refunds?: Refund[];
}

export class PaymentService extends CrudService<
  Prisma.PaymentDelegate<any>,
  'payment'
> {
  modelName: 'payment' = 'payment';

  private paymentRepo: PaymentRepository;
  private refundRepo: RefundRepository;
  private payoutRepo: PayoutRepository;
  private orderRepo: OrderRepository;
  private userRepo: UserRepository;
  private walletRepo: WalletRepository;
  private stripe!: Stripe;

  constructor(app: FastifyInstance) {
    super(app);
    this.paymentRepo = new PaymentRepository(app.prisma, app.redis, appLogger);
    this.refundRepo = new RefundRepository(app.prisma, app.redis, appLogger);
    this.payoutRepo = new PayoutRepository(app.prisma, app.redis, appLogger);
    this.orderRepo = new OrderRepository(app.prisma, app.redis, appLogger);
    this.userRepo = new UserRepository(app.prisma, app.redis, appLogger);
    this.walletRepo = new WalletRepository(app.prisma, app.redis, appLogger);
    
    // Initialize Stripe if API key is provided
    if (config.payment.stripe.secretKey) {
      this.stripe = new Stripe(config.payment.stripe.secretKey, {
        apiVersion: '2023-10-16'
      });
    }
  }

  async createPayment(data: CreatePaymentData): Promise<ServiceResult<Payment>> {
    try {
      // Validate order exists and is in correct state
      const order = await this.orderRepo.findById(data.orderId);
      if (!order) {
        return {
          success: false,
          error: new ApiError('Order not found', 404, 'ORDER_NOT_FOUND')
        };
      }

      if (order.paymentStatus !== PaymentStatus.PENDING) {
        return {
          success: false,
          error: new ApiError('Order payment is not in pending state', 400, 'INVALID_PAYMENT_STATE')
        };
      }

      // Validate amount matches order total
      if (Math.abs(data.amount - Number(order.totalAmount)) > 0.01) {
        return {
          success: false,
          error: new ApiError('Payment amount does not match order total', 400, 'AMOUNT_MISMATCH')
        };
      }

      // Check if payment already exists for this order
      const existingPayment = await this.paymentRepo.findFirst({ where: { orderId: data.orderId } });
      if (existingPayment) {
        return {
          success: false,
          error: new ApiError('Payment already exists for this order', 400, 'PAYMENT_EXISTS')
        };
      }

      const payment = await this.prisma.$transaction(async (tx) => {
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            orderId: data.orderId,
            method: data.method,
            amount: data.amount,
            currency: data.currency,
            status: PaymentStatus.PENDING,
            transactionId: this.generateTransactionId(),
            gatewayResponse: data.metadata || {}
          }
        });

        // Update order payment status
        await tx.order.update({
          where: { id: data.orderId },
          data: { paymentStatus: PaymentStatus.PENDING }
        });

        return payment;
      });

      this.logger.info({ 
        paymentId: payment.id,
        orderId: data.orderId,
        method: data.method,
        amount: data.amount 
      }, 'Payment created');

      return {
        success: true,
        data: payment
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create payment');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create payment', 500)
      };
    }
  }

  async processPayment(data: ProcessPaymentData): Promise<ServiceResult<Payment>> {
    try {
      const payment = await this.paymentRepo.findById(data.paymentId);
      if (!payment) {
        return {
          success: false,
          error: new ApiError('Payment not found', 404, 'PAYMENT_NOT_FOUND')
        };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        return {
          success: false,
          error: new ApiError('Payment is not in pending state', 400, 'INVALID_PAYMENT_STATE')
        };
      }

      let result: { success: boolean; error?: string; transactionId?: string };

      // Process payment based on method
      switch (payment.method) {
        case PaymentMethod.CREDIT_CARD:
          result = await this.processStripePayment(payment, data.paymentIntentId!);
          break;
        case PaymentMethod.PAYPAL:
          result = await this.processPayPalPayment(payment, data.externalTransactionId!);
          break;
        case PaymentMethod.WALLET:
          result = await this.processWalletPayment(payment);
          break;
        case PaymentMethod.BANK_TRANSFER:
          result = await this.processBankTransferPayment(payment, data.externalTransactionId!);
          break;
        default:
          return {
            success: false,
            error: new ApiError(`Payment method ${payment.method} not supported`, 400, 'UNSUPPORTED_METHOD')
          };
      }

      if (!result.success) {
        // Update payment as failed
        const updatedPayment = await this.updatePaymentStatus(
          payment.id,
          PaymentStatus.FAILED,
          result.error
        );
        
        return {
          success: false,
          error: new ApiError(result.error || 'Payment processing failed', 400, 'PAYMENT_FAILED'),
          data: updatedPayment
        };
      }

      // Update payment as completed
      const completedPayment = await this.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            transactionId: result.transactionId,
            completedAt: new Date(),
            gatewayResponse: {
              ...payment.gatewayResponse as any,
              ...data.metadata
            }
          }
        });

        // Update order payment status
        await tx.order.update({
          where: { id: payment.orderId },
          data: { 
            paymentStatus: PaymentStatus.PAID,
            status: 'PROCESSING' // Move order to confirmed status
          }
        });

        // Create order history entry
        await tx.orderHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'PROCESSING',
            note: `Payment completed via ${payment.method}`,
            createdBy: 'system'
          }
        });

        return updatedPayment;
      });

      // Emit payment completed event
      this.app.events?.emit('payment.completed', {
        paymentId: completedPayment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        method: payment.method
      });

      this.logger.info({ 
        paymentId: completedPayment.id,
        orderId: payment.orderId,
        amount: payment.amount 
      }, 'Payment processed successfully');

      return {
        success: true,
        data: completedPayment
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to process payment');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to process payment', 500)
      };
    }
  }

  async createRefund(data: CreateRefundData): Promise<ServiceResult<Refund>> {
    try {
      const payment = await this.paymentRepo.findById(data.paymentId);
      if (!payment) {
        return {
          success: false,
          error: new ApiError('Payment not found', 404, 'PAYMENT_NOT_FOUND')
        };
      }

      if (payment.status !== PaymentStatus.PAID) {
        return {
          success: false,
          error: new ApiError('Payment is not completed', 400, 'INVALID_PAYMENT_STATE')
        };
      }

      const refundAmount = data.amount || Number(payment.amount);
      
      // Check if refund amount is valid
      const existingRefunds = await this.refundRepo.findMany({ where: { paymentId: data.paymentId } });
      const totalRefunded = existingRefunds.reduce((sum: any, refund: any) => 
        sum + Number(refund.amount), 0
      );
      
      if (totalRefunded + refundAmount > Number(payment.amount)) {
        return {
          success: false,
          error: new ApiError('Refund amount exceeds available balance', 400, 'INSUFFICIENT_BALANCE')
        };
      }

      let result: { success: boolean; error?: string; refundId?: string };

      // Process refund based on original payment method
      switch (payment.method) {
        case PaymentMethod.CREDIT_CARD:
          result = await this.processStripeRefund(payment, refundAmount);
          break;
        case PaymentMethod.PAYPAL:
          result = await this.processPayPalRefund(payment, refundAmount);
          break;
        case PaymentMethod.WALLET:
          result = await this.processWalletRefund(payment, refundAmount);
          break;
        default:
          result = { success: true, refundId: this.generateTransactionId() };
          break;
      }

      if (!result.success) {
        return {
          success: false,
          error: new ApiError(result.error || 'Refund processing failed', 400, 'REFUND_FAILED')
        };
      }

      const refund = await this.prisma.$transaction(async (tx) => {
        // Create refund record
        const refund = await tx.refund.create({
          data: {
            orderId: payment.orderId,
            paymentId: data.paymentId,
            amount: refundAmount,
            reason: 'OTHER' as any,
            description: data.reason,
            status: 'COMPLETED',
            processedAt: new Date()
          }
        });

        // Update payment status if fully refunded
        const newTotalRefunded = totalRefunded + refundAmount;
        const paymentStatus = newTotalRefunded >= Number(payment.amount)
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PAID;

        await tx.payment.update({
          where: { id: data.paymentId },
          data: { status: paymentStatus }
        });

        // Update order payment status
        await tx.order.update({
          where: { id: payment.orderId },
          data: { 
            paymentStatus,
            status: paymentStatus === PaymentStatus.REFUNDED ? 'RETURNED' : undefined
          }
        });

        return refund;
      });

      // Emit refund created event
      this.app.events?.emit('refund.created', {
        refundId: refund.id,
        paymentId: data.paymentId,
        amount: refundAmount,
        reason: data.reason
      });

      this.logger.info({ 
        refundId: refund.id,
        paymentId: data.paymentId,
        amount: refundAmount 
      }, 'Refund processed successfully');

      return {
        success: true,
        data: refund
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create refund');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create refund', 500)
      };
    }
  }

  async createPayout(data: CreatePayoutData): Promise<ServiceResult<Payout>> {
    try {
      // Validate seller and available balance
      const seller = await this.userRepo.findById(data.sellerId);
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Check available balance (this would typically come from a commission/earnings calculation)
      const availableBalance = await this.getSellerAvailableBalance(data.sellerId);
      if (availableBalance < data.amount) {
        return {
          success: false,
          error: new ApiError('Insufficient available balance', 400, 'INSUFFICIENT_BALANCE')
        };
      }

      let result: { success: boolean; error?: string; payoutId?: string };

      // Process payout based on method
      switch (data.method) {
        case PaymentMethod.BANK_TRANSFER:
          result = await this.processStripePayout(data);
          break;
        case PaymentMethod.PAYPAL:
          result = await this.processPayPalPayout(data);
          break;
        case PaymentMethod.BANK_TRANSFER:
          result = await this.processBankTransferPayout(data);
          break;
        default:
          return {
            success: false,
            error: new ApiError(`Payout method ${data.method} not supported`, 400, 'UNSUPPORTED_METHOD')
          };
      }

      if (!result.success) {
        return {
          success: false,
          error: new ApiError(result.error || 'Payout processing failed', 400, 'PAYOUT_FAILED')
        };
      }

      const payout = await this.payoutRepo.create({
        seller: {
          connect: { id: data.sellerId }
        },
        amount: data.amount,
        currency: data.currency,
        method: data.method,
        status: 'PENDING',
        reference: result.payoutId
      } as any);

      // Emit payout created event
      this.app.events?.emit('payout.created', {
        payoutId: payout.id,
        sellerId: data.sellerId,
        amount: data.amount,
        method: data.method
      });

      this.logger.info({ 
        payoutId: payout.id,
        sellerId: data.sellerId,
        amount: data.amount 
      }, 'Payout created successfully');

      return {
        success: true,
        data: payout
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create payout');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create payout', 500)
      };
    }
  }

  async searchPayments(params: PaymentSearchParams): Promise<ServiceResult<PaginatedResult<PaymentWithDetails>>> {
    try {
      const cacheKey = `payments:search:${JSON.stringify(params)}`;
      const cached = await this.app.redis?.get(cacheKey) as PaginatedResult<PaymentWithDetails> | null;
      if (cached) {
        return { success: true, data: cached };
      }

      const where: Prisma.PaymentWhereInput = {};

      if (params.orderId) {
        where.orderId = params.orderId;
      }

      if (params.userId) {
        where.order = { userId: params.userId };
      }

      if (params.status?.length) {
        where.status = { in: params.status };
      }

      if (params.method?.length) {
        where.method = { in: params.method };
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = params.dateFrom;
        if (params.dateTo) where.createdAt.lte = params.dateTo;
      }

      if (params.minAmount || params.maxAmount) {
        where.amount = {};
        if (params.minAmount) where.amount.gte = params.minAmount;
        if (params.maxAmount) where.amount.lte = params.maxAmount;
      }

      if (params.currency) {
        where.currency = params.currency;
      }

      // Determine sort order
      let orderBy: Prisma.PaymentOrderByWithRelationInput = { createdAt: 'desc' };
      switch (params.sortBy) {
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'amount_asc':
          orderBy = { amount: 'asc' };
          break;
        case 'amount_desc':
          orderBy = { amount: 'desc' };
          break;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        this.paymentRepo.findMany({
          where,
          include: {
            order: {
              select: {
                orderNumber: true,
                user: {
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            refunds: true
          },
          orderBy,
          skip,
          take: limit
        }),
        this.paymentRepo.count({ where })
      ]);

      const result: PaginatedResult<PaymentWithDetails> = {
        data: payments as PaymentWithDetails[],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

      // Cache for 5 minutes
      await this.app.redis?.setex(cacheKey, 300, JSON.stringify(result));

      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ error }, 'Failed to search payments');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search payments', 500)
      };
    }
  }

  // Private helper methods

  private async processStripePayment(_payment: Payment, paymentIntentId: string): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    try {
      if (!this.stripe) {
        return { success: false, error: 'Stripe not configured' };
      }

      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        return { 
          success: true, 
          transactionId: paymentIntent.id 
        };
      } else {
        return { 
          success: false, 
          error: `Payment intent status: ${paymentIntent.status}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Stripe error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async processPayPalPayment(_payment: Payment, transactionId: string): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    // PayPal integration would go here
    // For now, return success with the provided transaction ID
    return { 
      success: true, 
      transactionId 
    };
  }

  private async processWalletPayment(payment: Payment): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    try {
      // Get user's wallet
      const order = await this.orderRepo.findById(payment.orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      const wallet = await this.walletRepo.findFirst({ where: { userId: order.userId } });
      if (!wallet) {
        return { success: false, error: 'Wallet not found' };
      }

      if (Number(wallet.balance) < Number(payment.amount)) {
        return { success: false, error: 'Insufficient wallet balance' };
      }

      // Deduct from wallet
      await this.prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { 
            balance: { 
              decrement: payment.amount 
            } 
          }
        });

        const newBalance = Number(wallet.balance) - Number(payment.amount);
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'PURCHASE',
            amount: payment.amount,
            balance: newBalance,
            description: `Payment for order ${order.orderNumber}`,
            referenceId: payment.id,
            referenceType: 'PAYMENT'
          }
        });
      });

      return { 
        success: true, 
        transactionId: this.generateTransactionId() 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Wallet payment failed' 
      };
    }
  }

  private async processBankTransferPayment(_payment: Payment, transactionId: string): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    // Bank transfer verification would go here
    // For now, return success with the provided transaction ID
    return { 
      success: true, 
      transactionId 
    };
  }

  private async processStripeRefund(payment: Payment, amount: number): Promise<{ success: boolean; error?: string; refundId?: string }> {
    try {
      if (!this.stripe || !payment.transactionId) {
        return { success: false, error: 'Stripe not configured or no external transaction ID' };
      }

      const refund = await this.stripe.refunds.create({
        charge: payment.transactionId,
        amount: Math.round(amount * 100), // Stripe expects cents
      });

      return { 
        success: true, 
        refundId: refund.id 
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Stripe refund error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async processPayPalRefund(_payment: Payment, _amount: number): Promise<{ success: boolean; error?: string; refundId?: string }> {
    // PayPal refund integration would go here
    return { 
      success: true, 
      refundId: this.generateTransactionId() 
    };
  }

  private async processWalletRefund(payment: Payment, amount: number): Promise<{ success: boolean; error?: string; refundId?: string }> {
    try {
      const order = await this.orderRepo.findById(payment.orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      const wallet = await this.walletRepo.findFirst({ where: { userId: order.userId } });
      if (!wallet) {
        return { success: false, error: 'Wallet not found' };
      }

      // Add refund to wallet
      await this.prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { 
            balance: { 
              increment: amount 
            } 
          }
        });

        const newBalance = Number(wallet.balance) + amount;
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'REFUND',
            amount: amount,
            balance: newBalance,
            description: `Refund for order ${order.orderNumber}`,
            referenceId: payment.id,
            referenceType: 'REFUND'
          }
        });
      });

      return { 
        success: true, 
        refundId: this.generateTransactionId() 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Wallet refund failed' 
      };
    }
  }

  private async processStripePayout(_data: CreatePayoutData): Promise<{ success: boolean; error?: string; payoutId?: string }> {
    // Stripe payout integration would go here
    return { 
      success: true, 
      payoutId: this.generateTransactionId() 
    };
  }

  private async processPayPalPayout(_data: CreatePayoutData): Promise<{ success: boolean; error?: string; payoutId?: string }> {
    // PayPal payout integration would go here
    return { 
      success: true, 
      payoutId: this.generateTransactionId() 
    };
  }

  private async processBankTransferPayout(_data: CreatePayoutData): Promise<{ success: boolean; error?: string; payoutId?: string }> {
    // Bank transfer payout integration would go here
    return { 
      success: true, 
      payoutId: this.generateTransactionId() 
    };
  }

  private async updatePaymentStatus(paymentId: string, status: PaymentStatus, errorMessage?: string): Promise<Payment> {
    return this.paymentRepo.update(paymentId, {
        status,
        gatewayResponse: {
          ...((await this.paymentRepo.findById(paymentId))?.gatewayResponse as any),
          error: errorMessage
        },
        completedAt: new Date()
    });
  }

  private async getSellerAvailableBalance(_sellerId: string): Promise<number> {
    // This would calculate the seller's available balance from commissions, sales, etc.
    // For now, return a placeholder value
    return 1000.00;
  }

  private generateTransactionId(): string {
    return `TXN-${Date.now()}-${nanoid(8).toUpperCase()}`;
  }
}