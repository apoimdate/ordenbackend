import { FastifyInstance } from 'fastify';
import { InventoryItem, Prisma, PrismaClient } from '@prisma/client';
import { CrudService } from './crud.service';

export class InventoryItemService extends CrudService<
  InventoryItem,
  Prisma.InventoryItemCreateInput,
  Prisma.InventoryItemUpdateInput
> {
  protected modelName: keyof PrismaClient = 'inventoryItem';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}
