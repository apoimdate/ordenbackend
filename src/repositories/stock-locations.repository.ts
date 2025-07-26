import { BaseRepository } from './base.repository';
import { stock_locations, Prisma } from '@prisma/client';

export class StockLocationsRepository extends BaseRepository<stock_locations, Prisma.stock_locationsCreateInput, Prisma.stock_locationsUpdateInput> {
  constructor(prisma: any, redis: any, logger: any) {
    super(prisma, redis, logger, 'stock_locations');
  }

  // PRODUCTION: Stock location specific methods

  async findBySellerId(sellerId: string): Promise<stock_locations[]> {
    return this.findMany({
      where: { seller_id: sellerId },
      orderBy: { name: 'asc' }
    });
  }

  async searchLocations(query: string): Promise<stock_locations[]> {
    return this.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive'
        }
      }
    });
  }

  async createLocation(data: {
    seller_id: string;
    name: string;
  }): Promise<stock_locations> {
    return this.create({
      id: require('nanoid').nanoid(),
      seller: { connect: { id: data.seller_id } },
      name: data.name,
      created_at: new Date()
    });
  }

  async updateLocation(id: string, data: {
    name?: string;
  }): Promise<stock_locations> {
    return this.update(id, data);
  }

  async getLocationStats(): Promise<{
    totalProducts: number;
    // This would be calculated by joining with inventory_items
  }> {
    // Placeholder - would involve joins with inventory_items
    return {
      totalProducts: 0
    };
  }

  async getLocationsByRegion(): Promise<Record<string, number>> {
    const locations = await this.findMany({});

    const regionCount: Record<string, number> = {};
    locations.forEach(location => {
      // Using name as region since no address fields exist
      const region = location.name.split(' ')[0] || 'Unknown';
      regionCount[region] = (regionCount[region] || 0) + 1;
    });

    return regionCount;
  }

  async findByName(name: string): Promise<stock_locations[]> {
    return this.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive'
        }
      }
    });
  }

  async getRecentLocations(limit = 10): Promise<stock_locations[]> {
    return this.findMany({
      orderBy: { created_at: 'desc' },
      take: limit
    });
  }

  async bulkCreateLocations(locations: Array<{
    seller_id: string;
    name: string;
  }>): Promise<stock_locations[]> {
    const results: stock_locations[] = [];
    
    for (const locationData of locations) {
      const location = await this.createLocation(locationData);
      results.push(location);
    }
    
    return results;
  }

  async getLocationCount(): Promise<number> {
    return this.count({});
  }

  async getLocationsBySeller(): Promise<Record<string, number>> {
    const locations = await this.findMany({});
    
    const sellerCount: Record<string, number> = {};
    locations.forEach(location => {
      sellerCount[location.seller_id] = (sellerCount[location.seller_id] || 0) + 1;
    });

    return sellerCount;
  }

  async deleteLocationsBySeller(sellerId: string): Promise<{ count: number }> {
    return this.deleteMany({
      seller_id: sellerId
    });
  }

  async findLocationsByDateRange(startDate: Date, endDate: Date): Promise<stock_locations[]> {
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

  async getLocationAnalytics(): Promise<{
    totalLocations: number;
    locationsBySeller: Record<string, number>;
    averageLocationsPerSeller: number;
    recentlyCreated: number; // last 30 days
  }> {
    const locations = await this.findMany({});
    
    const locationsBySeller = this.getLocationsBySeller();
    const sellerCount = Object.keys(locationsBySeller).length;
    const averageLocationsPerSeller = sellerCount > 0 ? locations.length / sellerCount : 0;

    // Count recently created (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyCreated = locations.filter(loc => loc.created_at >= thirtyDaysAgo).length;

    return {
      totalLocations: locations.length,
      locationsBySeller: await locationsBySeller,
      averageLocationsPerSeller: Math.round(averageLocationsPerSeller * 100) / 100,
      recentlyCreated
    };
  }

  async findEmptyLocations(): Promise<stock_locations[]> {
    // This would involve checking for locations with no inventory_items
    // For now, return empty array as placeholder
    return [];
  }

  async renameLocation(id: string, newName: string): Promise<stock_locations> {
    return this.updateLocation(id, { name: newName });
  }
}