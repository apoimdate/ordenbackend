import { BaseRepository } from './base.repository';
import { inventory_reservations, Prisma } from '@prisma/client';

export class InventoryReservationsRepository extends BaseRepository<inventory_reservations, Prisma.inventory_reservationsCreateInput, Prisma.inventory_reservationsUpdateInput> {
  constructor(prisma: any, redis: any, logger: any) {
    super(prisma, redis, logger, 'inventory_reservations');
  }

  // PRODUCTION: Inventory reservation specific methods

  async findByProductId(productId: string): Promise<inventory_reservations[]> {
    return this.findMany({
      where: { product_id: productId },
      orderBy: { created_at: 'desc' }
    });
  }

  async findByOrderId(orderId: string): Promise<inventory_reservations[]> {
    return this.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' }
    });
  }

  async findByProductAndOrder(productId: string, orderId: string): Promise<inventory_reservations | null> {
    return this.findFirst({
      where: {
        product_id: productId,
        order_id: orderId
      }
    });
  }

  async getTotalReservedQuantity(productId: string): Promise<number> {
    const reservations = await this.findMany({
      where: {
        product_id: productId
      }
    });

    return reservations.reduce((total, reservation) => total + reservation.quantity, 0);
  }

  async createReservation(data: {
    product_id: string;
    order_id: string;
    quantity: number;
  }): Promise<inventory_reservations> {
    return this.create({
      id: require('nanoid').nanoid(),
      product: { connect: { id: data.product_id } },
      order: { connect: { id: data.order_id } },
      quantity: data.quantity,
      created_at: new Date()
    });
  }

  async deleteByOrder(orderId: string): Promise<{ count: number }> {
    return this.deleteMany({
      order_id: orderId
    });
  }

  async getReservationStats(): Promise<{
    totalReservations: number;
    totalQuantityReserved: number;
    averageQuantityPerReservation: number;
  }> {
    const reservations = await this.findMany({});

    const totalQuantityReserved = reservations.reduce(
      (total, reservation) => total + reservation.quantity, 
      0
    );

    const averageQuantityPerReservation = reservations.length > 0 
      ? totalQuantityReserved / reservations.length
      : 0;

    return {
      totalReservations: reservations.length,
      totalQuantityReserved,
      averageQuantityPerReservation: Math.round(averageQuantityPerReservation * 100) / 100
    };
  }

  async getReservationsByProduct(productId: string): Promise<{
    totalReservations: number;
    totalQuantityReserved: number;
  }> {
    const reservations = await this.findByProductId(productId);
    const totalQuantityReserved = reservations.reduce((sum, r) => sum + r.quantity, 0);

    return {
      totalReservations: reservations.length,
      totalQuantityReserved
    };
  }

  async findRecentReservations(limit = 20): Promise<inventory_reservations[]> {
    return this.findMany({
      orderBy: { created_at: 'desc' },
      take: limit
    });
  }

  async getReservationsByDateRange(startDate: Date, endDate: Date): Promise<inventory_reservations[]> {
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

  async updateReservationQuantity(id: string, newQuantity: number): Promise<inventory_reservations> {
    return this.update(id, {
      quantity: newQuantity
    });
  }

  async bulkCreateReservations(reservations: Array<{
    product_id: string;
    order_id: string;
    quantity: number;
  }>): Promise<inventory_reservations[]> {
    const results: inventory_reservations[] = [];
    
    for (const reservationData of reservations) {
      const reservation = await this.createReservation(reservationData);
      results.push(reservation);
    }
    
    return results;
  }

  async getTopReservedProducts(limit = 10): Promise<Array<{
    product_id: string;
    totalQuantityReserved: number;
    reservationCount: number;
  }>> {
    const reservations = await this.findMany({});
    
    const productReservations: Record<string, { quantity: number; count: number }> = {};
    
    reservations.forEach(reservation => {
      if (!productReservations[reservation.product_id]) {
        productReservations[reservation.product_id] = { quantity: 0, count: 0 };
      }
      productReservations[reservation.product_id].quantity += reservation.quantity;
      productReservations[reservation.product_id].count += 1;
    });

    return Object.entries(productReservations)
      .map(([product_id, data]) => ({
        product_id,
        totalQuantityReserved: data.quantity,
        reservationCount: data.count
      }))
      .sort((a, b) => b.totalQuantityReserved - a.totalQuantityReserved)
      .slice(0, limit);
  }
}