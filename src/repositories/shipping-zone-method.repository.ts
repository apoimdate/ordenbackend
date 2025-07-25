import { ShippingZoneMethod, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ShippingZoneMethodRepository extends BaseRepository<
  ShippingZoneMethod,
  Prisma.ShippingZoneMethodCreateInput,
  Prisma.ShippingZoneMethodUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'shippingZoneMethod', 300);
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<ShippingZoneMethod[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<ShippingZoneMethod[]> {
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