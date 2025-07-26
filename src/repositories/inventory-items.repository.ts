import { BaseRepository } from './base.repository';
import { inventory_items, Prisma } from '@prisma/client';

export class InventoryItemsRepository extends BaseRepository<inventory_items, Prisma.inventory_itemsCreateInput, Prisma.inventory_itemsUpdateInput> {
  constructor(prisma: any, redis: any, logger: any) {
    super(prisma, redis, logger, 'inventory_items');
  }

  // PRODUCTION: Inventory-specific methods
  
  async findByProductId(productId: string): Promise<inventory_items[]> {
    return this.findMany({
      where: { product_id: productId }
    });
  }

  async findByLocationId(locationId: string): Promise<inventory_items[]> {
    return this.findMany({
      where: { location_id: locationId }
    });
  }

  async findByProductAndLocation(productId: string, locationId: string): Promise<inventory_items | null> {
    return this.findFirst({
      where: {
        product_id: productId,
        location_id: locationId
      }
    });
  }

  async updateQuantity(id: string, quantity: number): Promise<inventory_items> {
    return this.update(id, { quantity });
  }

  async adjustQuantity(id: string, adjustment: number): Promise<inventory_items> {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Inventory item not found');
    }
    
    const newQuantity = item.quantity + adjustment;
    if (newQuantity < 0) {
      throw new Error('Insufficient inventory quantity');
    }
    
    return this.update(id, { quantity: newQuantity });
  }

  async getLowStockItems(threshold = 10): Promise<inventory_items[]> {
    return this.findMany({
      where: {
        quantity: {
          lte: threshold
        }
      },
      orderBy: { quantity: 'asc' }
    });
  }

  async getInventoryByLocation(locationId: string): Promise<{
    totalItems: number;
    totalQuantity: number;
    lowStockCount: number;
  }> {
    const items = await this.findMany({
      where: { location_id: locationId }
    });

    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockCount = items.filter(item => item.quantity <= 10).length;

    return { totalItems, totalQuantity, lowStockCount };
  }

  async getInventoryByProduct(productId: string): Promise<{
    totalQuantity: number;
    locations: Array<{
      locationId: string;
      quantity: number;
    }>;
  }> {
    const items = await this.findMany({
      where: { product_id: productId }
    });

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const locations = items.map(item => ({
      locationId: item.location_id,
      quantity: item.quantity
    }));

    return { totalQuantity, locations };
  }
}