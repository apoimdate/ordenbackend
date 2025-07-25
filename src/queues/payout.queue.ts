import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { PayoutStatus } from '../utils/constants';

interface PayoutJobData {
  payoutId: string;
  sellerId: string;
  amount: number;
  method: 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER';
}

export class PayoutWorker {
  private worker: Worker;
  private prisma: PrismaClient;
  // TODO: Add payment services when implemented
  // private stripeService: StripeService;
  // private paypalService: PayPalService;
  // private bankTransferService: BankTransferService;

  constructor(redis: Redis, prisma: PrismaClient) {
    this.prisma = prisma;
    // TODO: Initialize payment services when implemented
    // this.stripeService = new StripeService();
    // this.paypalService = new PayPalService();
    // this.bankTransferService = new BankTransferService();

    this.worker = new Worker('payout', async (job: Job<PayoutJobData>) => {
      return this.processPayoutJob(job);
    }, {
      connection: redis,
      concurrency: 5
    });

    this.setupEventListeners();
  }

  private async processPayoutJob(job: Job<PayoutJobData>) {
    const { payoutId, sellerId, amount, method } = job.data;

    try {
      // Update payout status to processing
      await this.prisma.payout.update({
        where: { id: payoutId },
        data: { 
          status: PayoutStatus.PROCESSING as any,
        }
      });

      // Process based on payment method
      let result;
      switch (method) {
        case 'STRIPE':
          // TODO: Implement processPayout method
          // result = await this.stripeService.processPayout(sellerId, amount);
          break;
        case 'PAYPAL':
          // TODO: Implement processPayout method
          // result = await this.paypalService.processPayout(sellerId, amount);
          break;
        case 'BANK_TRANSFER':
          // TODO: Implement processPayout method
          // result = await this.bankTransferService.processPayout(sellerId, amount);
          break;
        default:
          throw new Error(`Unsupported payout method: ${method}`);
      }

      // Update payout with success
      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.COMPLETED as any,
          processedAt: new Date(),
        }
      });

      logger.info({ payoutId, sellerId, amount, method }, 'Payout processed successfully');
      return result;

    } catch (error) {
      // Update payout with failure
      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.FAILED as any,
        }
      });

      logger.error({ payoutId, sellerId, amount, method, error }, 'Payout processing failed');
      throw error;
    }
  }

  private setupEventListeners() {
    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Payout job completed');
    });

    this.worker.on('failed', (job, error) => {
      logger.error({ jobId: job?.id, error }, 'Payout job failed');
    });
  }

  async close() {
    await this.worker.close();
  }
}