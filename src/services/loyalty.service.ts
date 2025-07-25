import { FastifyInstance } from 'fastify';
import { Prisma, PrismaClient, LoyaltyPoints, GiftCard, LoyaltyTransaction } from '@prisma/client';
import { CrudService } from './crud.service';
import { ApiError } from '../utils/errors';

export interface LoyaltyPointsData {
  totalPoints: number;
  availablePoints: number;
  totalEarned: number;
  totalSpent: number;
  tier: string;
  nextTierPoints: number;
  transactions: LoyaltyTransaction[];
}

export interface CreateGiftCardData {
  code: string;
  value: number;
  expiresAt?: Date;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  isActive?: boolean;
}

export interface GiftCardWithDetails extends GiftCard {
  transactions: any[];
}

export class LoyaltyService extends CrudService<
  LoyaltyPoints,
  Prisma.LoyaltyPointsCreateInput,
  Prisma.LoyaltyPointsUpdateInput
> {
  public modelName: keyof PrismaClient = 'loyaltyPoints';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // Loyalty Points Management

  async getUserLoyaltyPoints(userId: string): Promise<LoyaltyPointsData> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          loyaltyPoints: {
            include: {
              transactions: {
                orderBy: { createdAt: 'desc' },
                take: 50, // Last 50 transactions
              },
            },
          },
        },
      });

      if (!user) {
        throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Create loyalty points record if it doesn't exist
      if (!user.loyaltyPoints) {
        const newLoyaltyPoints = await this.prisma.loyaltyPoints.create({
          data: {
            user: {
              connect: {
                id: userId,
              },
            },
            points: 0,
            totalEarned: 0,
            totalSpent: 0,
            tier: 'BRONZE',
          },
        });
        return {
          totalPoints: newLoyaltyPoints.points,
          availablePoints: newLoyaltyPoints.points,
          totalEarned: newLoyaltyPoints.totalEarned,
          totalSpent: newLoyaltyPoints.totalSpent,
          tier: newLoyaltyPoints.tier,
          nextTierPoints: this.calculateNextTierPoints(newLoyaltyPoints.tier, newLoyaltyPoints.totalEarned),
          transactions: [],
        };
      }

      const availablePoints = Math.max(0, user.loyaltyPoints.points);
      const nextTierPoints = this.calculateNextTierPoints(user.loyaltyPoints.tier, user.loyaltyPoints.totalEarned);

      const loyaltyData: LoyaltyPointsData = {
        totalPoints: user.loyaltyPoints.points,
        availablePoints,
        totalEarned: user.loyaltyPoints.totalEarned,
        totalSpent: user.loyaltyPoints.totalSpent,
        tier: user.loyaltyPoints.tier,
        nextTierPoints,
        transactions: user.loyaltyPoints.transactions,
      };

      return loyaltyData;
    } catch (error) {
      this.logger.error({ error, userId }, 'Error getting user loyalty points');
      throw new ApiError('Failed to fetch loyalty points', 500, 'LOYALTY_POINTS_FETCH_FAILED');
    }
  }

  calculateNextTierPoints(_tier: string, totalEarned: number): number {
    const tiers = {
      BRONZE: 2500,
      SILVER: 10000,
      GOLD: 25000,
      PLATINUM: 50000,
      DIAMOND: Infinity,
    };
    const nextTier = Object.keys(tiers).find(key => tiers[key as keyof typeof tiers] > totalEarned);
    return nextTier ? tiers[nextTier as keyof typeof tiers] : 0;
  }

  calculateLoyaltyTier(totalEarned: number): string {
    if (totalEarned >= 50000) return 'DIAMOND';
    if (totalEarned >= 25000) return 'PLATINUM';
    if (totalEarned >= 10000) return 'GOLD';
    if (totalEarned >= 2500) return 'SILVER';
    return 'BRONZE';
  }

  getTierUpgradeBonus(tier: string): number {
    const bonuses = {
      SILVER: 500,
      GOLD: 1000,
      PLATINUM: 2500,
      DIAMOND: 5000,
    };
    return bonuses[tier as keyof typeof bonuses] || 0;
  }

  async sendTierUpgradeNotification(userId: string, newTier: string, bonus: number): Promise<void> {
    try {
      // Integration with notification service would go here
      this.logger.info(
        {
          userId,
          newTier,
          bonus,
        },
        'Tier upgrade notification sent'
      );
    } catch (error) {
      this.logger.error({ error, userId, newTier }, 'Error sending tier upgrade notification');
    }
  }
}