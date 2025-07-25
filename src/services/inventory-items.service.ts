import { FastifyInstance } from 'fastify';
import { inventory_items as InventoryItem, Prisma, PrismaClient } from '@prisma/client';
import { CrudService } from './crud.service';

export class InventoryItemService extends CrudService<
  InventoryItem,
  Prisma.inventory_itemsCreateInput,
  Prisma.inventory_itemsUpdateInput
> {
  public modelName: keyof PrismaClient = 'inventory_items';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}
