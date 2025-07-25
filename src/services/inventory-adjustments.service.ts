import { FastifyInstance } from 'fastify';
import { InventoryAdjustment, Prisma, PrismaClient } from '@prisma/client';
import { CrudService } from './crud.service';

export class InventoryAdjustmentService extends CrudService<
  InventoryAdjustment,
  Prisma.InventoryAdjustmentCreateInput,
  Prisma.InventoryAdjustmentUpdateInput
> {
  protected modelName: keyof PrismaClient = 'inventoryAdjustment';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}
