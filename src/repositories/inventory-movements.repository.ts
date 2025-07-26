import { BaseRepository } from './base.repository';
import { inventory_movements, Prisma } from '@prisma/client';

export class InventoryMovementsRepository extends BaseRepository<inventory_movements, Prisma.inventory_movementsCreateInput, Prisma.inventory_movementsUpdateInput> {
  constructor(prisma: any, redis: any, logger: any) {
    super(prisma, redis, logger, 'inventory_movements');
  }

  // PRODUCTION: Inventory movement specific methods

  async findByProductId(productId: string): Promise<inventory_movements[]> {
    return this.findMany({
      where: { product_id: productId },
      orderBy: { created_at: 'desc' }
    });
  }

  async findByInventoryItemId(inventoryItemId: string): Promise<inventory_movements[]> {
    return this.findMany({
      where: { inventory_item_id: inventoryItemId },
      orderBy: { created_at: 'desc' }
    });
  }

  async findByMovementType(movementType: string): Promise<inventory_movements[]> {
    return this.findMany({
      where: { type: movementType },
      orderBy: { created_at: 'desc' }
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<inventory_movements[]> {
    return this.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async getMovementsByProduct(productId: string, limit = 50): Promise<inventory_movements[]> {
    return this.findMany({
      where: { product_id: productId },
      orderBy: { created_at: 'desc' },
      take: limit
    });
  }

  async getMovementSummary(productId: string): Promise<{
    totalIn: number;
    totalOut: number;
    netMovement: number;
    lastMovement: Date | null;
  }> {
    const movements = await this.findByProductId(productId);
    
    let totalIn = 0;
    let totalOut = 0;
    let lastMovement: Date | null = null;

    movements.forEach(movement => {
      if (movement.quantity > 0) {
        totalIn += movement.quantity;
      } else {
        totalOut += Math.abs(movement.quantity);
      }
      
      if (!lastMovement || movement.created_at > lastMovement) {
        lastMovement = movement.created_at;
      }
    });

    return {
      totalIn,
      totalOut,
      netMovement: totalIn - totalOut,
      lastMovement
    };
  }

  async getMovementsByType(): Promise<Record<string, number>> {
    const movements = await this.findMany({});
    const typeCount: Record<string, number> = {};

    movements.forEach(movement => {
      typeCount[movement.type] = (typeCount[movement.type] || 0) + 1;
    });

    return typeCount;
  }

  async createMovement(data: {
    product_id: string;
    inventory_item_id: string;
    type: string;
    quantity: number;
  }): Promise<inventory_movements> {
    return this.create({
      id: require('nanoid').nanoid(),
      product: { connect: { id: data.product_id } },
      inventory_item: { connect: { id: data.inventory_item_id } },
      type: data.type,
      quantity: data.quantity,
      created_at: new Date()
    });
  }

  async getRecentMovements(limit = 20): Promise<inventory_movements[]> {
    return this.findMany({
      orderBy: { created_at: 'desc' },
      take: limit
    });
  }

  async getMovementAnalytics(dateFrom?: Date, dateTo?: Date): Promise<{
    totalMovements: number;
    movementsByType: Record<string, number>;
    totalQuantityIn: number;
    totalQuantityOut: number;
    averageMovementSize: number;
  }> {
    const where: Prisma.inventory_movementsWhereInput = {};
    
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = dateFrom;
      if (dateTo) where.created_at.lte = dateTo;
    }

    const movements = await this.findMany({ where });
    
    const movementsByType: Record<string, number> = {};
    let totalQuantityIn = 0;
    let totalQuantityOut = 0;

    movements.forEach(movement => {
      movementsByType[movement.type] = (movementsByType[movement.type] || 0) + 1;
      
      if (movement.quantity > 0) {
        totalQuantityIn += movement.quantity;
      } else {
        totalQuantityOut += Math.abs(movement.quantity);
      }
    });

    const totalQuantity = totalQuantityIn + totalQuantityOut;
    const averageMovementSize = movements.length > 0 ? totalQuantity / movements.length : 0;

    return {
      totalMovements: movements.length,
      movementsByType,
      totalQuantityIn,
      totalQuantityOut,
      averageMovementSize
    };
  }
}