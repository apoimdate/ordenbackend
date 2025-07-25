import { PickupLocation, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class PickupLocationRepository extends BaseRepository<
  PickupLocation,
  Prisma.PickupLocationCreateInput,
  Prisma.PickupLocationUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'pickupLocation', 300);
  }

  async findByEmail(email: string, options?: FindOptionsWithoutWhere): Promise<PickupLocation | null> {
    return this.findUnique({ email: email.toLowerCase() }, options);
  }

  async findBySellerId(sellerId: string, options?: FindOptionsWithoutWhere): Promise<PickupLocation[]> {
    return this.findMany({
      ...options,
      where: {
        
        sellerId
      }
    });
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<PickupLocation[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<PickupLocation[]> {
    return this.findMany({
      ...options,
      where: {
        
        name: {
          contains: name,
          mode: 'insensitive'
        }
      }
    });
  }
}