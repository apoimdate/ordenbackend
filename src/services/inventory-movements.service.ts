import { FastifyInstance } from 'fastify';
import { inventory_movements as InventoryMovement, Prisma, PrismaClient } from '@prisma/client';
import { CrudService } from './crud.service';

export class InventoryMovementService extends CrudService<
  InventoryMovement,
  Prisma.inventory_movementsCreateInput,
  Prisma.inventory_movementsUpdateInput
> {
  public modelName: keyof PrismaClient = 'inventory_movements';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}

