import { Prisma, CustomsDeclaration, CustomsItem, CustomsStatus, Currency } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export interface CustomsDeclarationWithDetails extends CustomsDeclaration {
  order: {
    id: string;
    orderNumber: string;
    userId: string;
    totalAmount: number;
  };
  items: (CustomsItem & {
    product: {
      id: string;
      name: string;
      sku: string;
      weight?: number;
    };
  })[];
}

export interface CustomsDeclarationCreateData {
  orderId: string;
  declarationNumber: string;
  countryFrom: string;
  countryTo: string;
  value: number;
  currency: Currency;
  description: string;
  hsCode?: string;
  weight?: number;
  notes?: string;
}

export interface CustomsDeclarationUpdateData {
  status?: CustomsStatus;
  customsDuty?: number;
  vat?: number;
  handlingFee?: number;
  declaredAt?: Date;
  clearedAt?: Date;
  releasedAt?: Date;
  notes?: string;
}

export interface CustomsItemCreateData {
  declarationId: string;
  productId: string;
  quantity: number;
  value: number;
  description: string;
  hsCode?: string;
  weight?: number;
  originCountry: string;
}

export interface CustomsDeclarationFilters {
  status?: CustomsStatus;
  countryFrom?: string;
  countryTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export class CustomsDeclarationRepository {
  protected prisma: PrismaClient;
  protected redis: Redis;
  protected logger: Logger;

  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
  }
  async create(data: CustomsDeclarationCreateData): Promise<CustomsDeclaration> {
    return this.prisma.customsDeclaration.create({
      data
    });
  }

  async findById(id: string): Promise<CustomsDeclarationWithDetails | null> {
    return this.prisma.customsDeclaration.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            totalAmount: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                weight: true
              }
            }
          }
        }
      }
    }) as Promise<CustomsDeclarationWithDetails | null>;
  }

  async findByOrderId(orderId: string): Promise<CustomsDeclarationWithDetails | null> {
    return this.prisma.customsDeclaration.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            totalAmount: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                weight: true
              }
            }
          }
        }
      }
    }) as Promise<CustomsDeclarationWithDetails | null>;
  }

  async findByDeclarationNumber(declarationNumber: string): Promise<CustomsDeclaration | null> {
    return this.prisma.customsDeclaration.findFirst({
      where: { declarationNumber }
    });
  }

  async findMany(filters: CustomsDeclarationFilters = {}, pagination = { page: 1, limit: 20 }) {
    const where: Prisma.CustomsDeclarationWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.countryFrom) {
      where.countryFrom = filters.countryFrom;
    }

    if (filters.countryTo) {
      where.countryTo = filters.countryTo;
    }

    if (filters.search) {
      where.OR = [
        {
          declarationNumber: {
            contains: filters.search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: filters.search,
            mode: 'insensitive'
          }
        },
        {
          order: {
            orderNumber: {
              contains: filters.search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [declarations, total] = await Promise.all([
      this.prisma.customsDeclaration.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              userId: true,
              totalAmount: true
            }
          },
          _count: {
            select: { items: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit
      }),
      this.prisma.customsDeclaration.count({ where })
    ]);

    return {
      declarations,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async update(id: string, data: CustomsDeclarationUpdateData): Promise<CustomsDeclaration> {
    return this.prisma.customsDeclaration.update({
      where: { id },
      data
    });
  }

  async updateStatus(
    id: string, 
    status: CustomsStatus, 
    additionalData?: Partial<CustomsDeclarationUpdateData>
  ): Promise<CustomsDeclaration> {
    const updateData: CustomsDeclarationUpdateData = {
      status,
      ...additionalData
    };

    // Add timestamp based on status
    switch (status) {
      case CustomsStatus.CLEARED:
        updateData.clearedAt = new Date();
        break;
    }

    return this.update(id, updateData);
  }

  async calculateTotalFees(id: string): Promise<number> {
    const declaration = await this.findById(id);
    if (!declaration) {
      throw new Error('Customs declaration not found');
    }

    const customsDuty = Number(declaration.customsDuty || 0);
    const vat = Number(declaration.vat || 0);
    const handlingFee = Number(declaration.handlingFee || 0);

    const totalFees = customsDuty + vat + handlingFee;

    // Update the total fees in the database
    await this.update(id, { handlingFee: totalFees });

    return totalFees;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customsDeclaration.delete({
      where: { id }
    });
  }

  // Customs Items methods
  async addItem(data: CustomsItemCreateData): Promise<CustomsItem> {
    return this.prisma.customsItem.create({
      data
    });
  }

  async updateItem(id: string, data: Partial<CustomsItemCreateData>): Promise<CustomsItem> {
    return this.prisma.customsItem.update({
      where: { id },
      data
    });
  }

  async removeItem(id: string): Promise<void> {
    await this.prisma.customsItem.delete({
      where: { id }
    });
  }

  async getItemsByDeclaration(declarationId: string): Promise<CustomsItem[]> {
    return this.prisma.customsItem.findMany({
      where: { declarationId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            weight: true
          }
        }
      }
    });
  }

  // PlatformAnalytics and reporting
  async getDeclarationStats(filters: CustomsDeclarationFilters = {}) {
    const where: Prisma.CustomsDeclarationWhereInput = {};

    if (filters.countryFrom) where.countryFrom = filters.countryFrom;
    if (filters.countryTo) where.countryTo = filters.countryTo;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [
      totalDeclarations,
      statusBreakdown,
      totalValue,
      totalFees
    ] = await Promise.all([
      this.prisma.customsDeclaration.count({ where }),
      
      this.prisma.customsDeclaration.groupBy({
        by: ['status'],
        where,
        _count: true
      }),

      this.prisma.customsDeclaration.aggregate({
        where,
        _sum: {
          value: true
        }
      }),

      this.prisma.customsDeclaration.aggregate({
        where,
        _sum: {
          handlingFee: true,
          vat: true,
          customsDuty: true
        }
      })
    ]);

    return {
      totalDeclarations,
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      totalValue: Number(totalValue._sum.value || 0),
      totalFees: Number(totalFees._sum.handlingFee || 0) + Number(totalFees._sum.vat || 0) + Number(totalFees._sum.customsDuty || 0)
    };
  }

  async getCountryTradeStats(dateFrom?: Date, dateTo?: Date) {
    const where: Prisma.CustomsDeclarationWhereInput = {};
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const tradeRoutes = await this.prisma.customsDeclaration.groupBy({
      by: ['countryFrom', 'countryTo'],
      where,
      _count: true,
      _sum: {
        value: true,
        handlingFee: true,
        vat: true,
        customsDuty: true
      }
    });

    return tradeRoutes.map(route => ({
      route: `${route.countryFrom} → ${route.countryTo}`,
      declarations: route._count,
      totalValue: Number(route._sum.value || 0),
      totalFees: Number(route._sum.handlingFee || 0) + Number(route._sum.vat || 0) + Number(route._sum.customsDuty || 0)
    }));
  }

  async getPendingDeclarations(): Promise<CustomsDeclaration[]> {
    return this.prisma.customsDeclaration.findMany({
      where: {
        status: { in: [CustomsStatus.PENDING] }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }
}
