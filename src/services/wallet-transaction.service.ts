import { FastifyInstance } from 'fastify';
import { WalletTransaction, Prisma } from '@prisma/client';
import { CrudService } from './crud.service';
import { ServiceResult } from '../types';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

export class WalletTransactionService extends CrudService<WalletTransaction, Prisma.WalletTransactionCreateInput, Prisma.WalletTransactionUpdateInput> {
  modelName = 'walletTransaction' as const;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async findById(id: string): Promise<ServiceResult<WalletTransaction | null>> {
    try {
      const walletTransaction = await this.prisma.walletTransaction.findUnique({
        where: { id },
      });
      return { success: true, data: walletTransaction };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to find walletTransaction');
      return { success: false, error: new ApiError('Failed to fetch walletTransaction', 500, error.code, error.message) };
    }
  }

  async update(id: string, data: Prisma.WalletTransactionUpdateInput): Promise<ServiceResult<WalletTransaction>> {
    try {
      const walletTransaction = await this.prisma.walletTransaction.update({
        where: { id },
        data,
      });
      return { success: true, data: walletTransaction };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update walletTransaction');
      return { success: false, error: new ApiError('Failed to update walletTransaction', 500, error.code, error.message) };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      await this.prisma.walletTransaction.delete({
        where: { id },
      });
      return { success: true };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to delete walletTransaction');
      return { success: false, error: new ApiError('Failed to delete walletTransaction', 500, error.code, error.message) };
    }
  }
}