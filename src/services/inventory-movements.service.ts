import { FastifyInstance } from 'fastify';
import { InventoryMovement, Prisma, PrismaClient } from '@prisma/client';
import { CrudService } from './crud.service';

export class InventoryMovementService extends CrudService<
  InventoryMovement,
  Prisma.InventoryMovementCreateInput,
  Prisma.InventoryMovementUpdateInput
> {
  protected modelName: keyof PrismaClient = 'inventoryMovement';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}

