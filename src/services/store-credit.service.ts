import { FastifyInstance } from 'fastify';
import { StoreCredit, Prisma } from '@prisma/client';
import { CrudService } from './crud.service';
import { ServiceResult } from '../types';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

export class StoreCreditService extends CrudService<StoreCredit, Prisma.StoreCreditCreateInput, Prisma.StoreCreditUpdateInput> {
  modelName = 'storeCredit' as const;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async findById(id: string): Promise<ServiceResult<StoreCredit | null>> {
    try {
      const storeCredit = await this.prisma.storeCredit.findUnique({
        where: { id },
      });
      return { success: true, data: storeCredit };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to find storeCredit');
      return { success: false, error: new ApiError('Failed to fetch storeCredit', 500, error.code, error.message) };
    }
  }

  async update(id: string, data: Prisma.StoreCreditUpdateInput): Promise<ServiceResult<StoreCredit>> {
    try {
      const storeCredit = await this.prisma.storeCredit.update({
        where: { id },
        data,
      });
      return { success: true, data: storeCredit };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update storeCredit');
      return { success: false, error: new ApiError('Failed to update storeCredit', 500, error.code, error.message) };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      await this.prisma.storeCredit.delete({
        where: { id },
      });
      return { success: true };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to delete storeCredit');
      return { success: false, error: new ApiError('Failed to delete storeCredit', 500, error.code, error.message) };
    }
  }
}