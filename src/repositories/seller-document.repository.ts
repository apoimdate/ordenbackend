import { SellerDocument, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SellerDocumentRepository extends BaseRepository<
  SellerDocument,
  Prisma.SellerDocumentCreateInput,
  Prisma.SellerDocumentUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'sellerDocument', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<SellerDocument[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findBySellerId(sellerId: string, options?: FindOptionsWithoutWhere): Promise<SellerDocument[]> {
    return this.findMany({
      ...options,
      where: {
        
        sellerId
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<SellerDocument[]> {
    return this.findMany({
      ...options,
      where: {
        
        type
      }
    });
  }
}