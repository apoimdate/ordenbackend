import { FastifyInstance } from 'fastify';
import { StockTransfer, Prisma } from '@prisma/client';
import { CrudService } from './crud.service';
import { ServiceResult } from '../types';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

export class StockTransferService extends CrudService<StockTransfer, Prisma.StockTransferCreateInput, Prisma.StockTransferUpdateInput> {
  modelName = 'stockTransfer' as const;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async findById(id: string): Promise<ServiceResult<StockTransfer | null>> {
    try {
      const stockTransfer = await this.prisma.stockTransfer.findUnique({
        where: { id },
      });
      return { success: true, data: stockTransfer };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to find stockTransfer');
      return { success: false, error: new ApiError('Failed to fetch stockTransfer', 500, error.code, error.message) };
    }
  }

  async update(id: string, data: Prisma.StockTransferUpdateInput): Promise<ServiceResult<StockTransfer>> {
    try {
      const stockTransfer = await this.prisma.stockTransfer.update({
        where: { id },
        data,
      });
      return { success: true, data: stockTransfer };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update stockTransfer');
      return { success: false, error: new ApiError('Failed to update stockTransfer', 500, error.code, error.message) };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      await this.prisma.stockTransfer.delete({
        where: { id },
      });
      return { success: true };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to delete stockTransfer');
      return { success: false, error: new ApiError('Failed to delete stockTransfer', 500, error.code, error.message) };
    }
  }
}