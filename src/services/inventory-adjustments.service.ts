import { FastifyInstance } from 'fastify';
import { InventoryLog as InventoryAdjustment, Prisma, PrismaClient } from '@prisma/client';
import { CrudService } from './crud.service';

export class InventoryAdjustmentService extends CrudService<
  InventoryAdjustment,
  Prisma.InventoryLogCreateInput,
  Prisma.InventoryLogUpdateInput
> {
  public modelName: keyof PrismaClient = 'inventoryLog';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}
