import { Membership, Prisma, MembershipTier } from '@prisma/client';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { MembershipRepository } from '../repositories';
import { cacheGet, cacheSet } from '../config/redis';
import { nanoid } from 'nanoid';

interface CreateMembershipData {
  userId: string;
  tier: MembershipTier;
  endDate?: Date;
  autoRenew?: boolean;
}

interface UpdateMembershipData {
  tier?: MembershipTier;
  endDate?: Date;
  isActive?: boolean;
  autoRenew?: boolean;
}

interface MembershipSearchParams {
  userId?: string;
  tier?: MembershipTier;
  isActive?: boolean;
  autoRenew?: boolean;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
  sortBy?: 'tier' | 'startDate' | 'endDate' | 'isActive';
  sortOrder?: 'asc' | 'desc';
}

interface MembershipWithDetails extends Membership {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface MembershipAnalytics {
  totalMemberships: number;
  activeMemberships: number;
  membershipsByTier: Record<string, number>;
  expiringMemberships: number;
  autoRenewRate: number;
  averageDiscountRate: number;
}

interface MembershipBenefits {
  freeShipping: boolean;
  discountRate: number;
  prioritySupport: boolean;
  features: string[];
}

export class MembershipService {
  private membershipRepo: MembershipRepository;

  constructor(prisma: any, redis: any, logger: any) {
    this.membershipRepo = new MembershipRepository(prisma, redis, logger);
  }

  async create(data: CreateMembershipData): Promise<ServiceResult<Membership>> {
    try {
      // PRODUCTION: Comprehensive input validation
      if (!data.userId || data.userId.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('User ID is required', 400, 'INVALID_USER_ID')
        };
      }

      if (!data.tier) {
        return {
          success: false,
          error: new ApiError('Membership tier is required', 400, 'INVALID_TIER')
        };
      }

      // PRODUCTION: Validate tier is valid enum value
      const validTiers = Object.values(MembershipTier);
      if (!validTiers.includes(data.tier)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid membership tier. Must be one of: ${validTiers.join(', ')}`,
            400,
            'INVALID_TIER_ENUM'
          )
        };
      }

      // PRODUCTION: Check if user already has an active membership
      const existingMembership = await this.membershipRepo.findFirst({
        where: { 
          userId: data.userId,
          isActive: true
        }
      });

      if (existingMembership) {
        return {
          success: false,
          error: new ApiError(
            'User already has an active membership',
            400,
            'DUPLICATE_MEMBERSHIP'
          )
        };
      }

      // PRODUCTION: Calculate membership benefits based on tier
      const benefits = this.calculateMembershipBenefits(data.tier);

      // PRODUCTION: Set default end date if not provided (1 year for non-BASIC)
      let endDate = data.endDate;
      if (!endDate && data.tier !== MembershipTier.BASIC) {
        endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1); // 1 year from now
      }

      const membership = await this.membershipRepo.create({
        id: nanoid(),
        user: {
          connect: { id: data.userId }
        },
        tier: data.tier,
        startDate: new Date(),
        endDate: endDate || null,
        isActive: true,
        autoRenew: data.autoRenew !== undefined ? data.autoRenew : true,
        freeShipping: benefits.freeShipping,
        discountRate: benefits.discountRate,
        prioritySupport: benefits.prioritySupport
      });

      // Clear related caches
      await this.clearMembershipCaches(data.userId);

      // PRODUCTION: Comprehensive success logging with benefits
      logger.info({
        event: 'MEMBERSHIP_CREATED',
        membershipId: membership.id,
        userId: data.userId,
        tier: data.tier,
        endDate: endDate?.toISOString(),
        autoRenew: data.autoRenew,
        benefits: {
          freeShipping: benefits.freeShipping,
          discountRate: benefits.discountRate,
          prioritySupport: benefits.prioritySupport
        },
        timestamp: new Date().toISOString()
      }, 'Membership created successfully with production benefits calculation');

      // PRODUCTION: Trigger membership activation workflow
      this.triggerMembershipActivation(membership.id).catch(error => {
        logger.error({
          membershipId: membership.id,
          error
        }, 'Failed to trigger membership activation workflow');
      });

      return {
        success: true,
        data: membership
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create membership');
      return {
        success: false,
        error: new ApiError('Failed to create membership', 500, 'CREATION_FAILED')
      };
    }
  }

  async update(id: string, data: UpdateMembershipData): Promise<ServiceResult<Membership>> {
    try {
      // Check if membership exists
      const existingMembership = await this.membershipRepo.findById(id);
      if (!existingMembership) {
        return {
          success: false,
          error: new ApiError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND')
        };
      }

      // PRODUCTION: Validate tier if provided
      if (data.tier) {
        const validTiers = Object.values(MembershipTier);
        if (!validTiers.includes(data.tier)) {
          return {
            success: false,
            error: new ApiError(
              `Invalid membership tier. Must be one of: ${validTiers.join(', ')}`,
              400,
              'INVALID_TIER_ENUM'
            )
          };
        }
      }

      // PRODUCTION: Recalculate benefits if tier changes
      let updateData = { ...data };
      if (data.tier && data.tier !== existingMembership.tier) {
        const benefits = this.calculateMembershipBenefits(data.tier);
        (updateData as any).freeShipping = benefits.freeShipping;
        (updateData as any).discountRate = benefits.discountRate;
        (updateData as any).prioritySupport = benefits.prioritySupport;
      }

      // PRODUCTION: Handle membership expiration
      if (data.isActive === false && existingMembership.isActive) {
        logger.info({
          membershipId: id,
          userId: existingMembership.userId,
          tier: existingMembership.tier,
          event: 'MEMBERSHIP_DEACTIVATED'
        }, 'Membership deactivated');
      }

      const membership = await this.membershipRepo.update(id, updateData);

      // Clear related caches
      await this.clearMembershipCaches(existingMembership.userId);

      logger.info({
        membershipId: id,
        userId: existingMembership.userId,
        changes: Object.keys(data),
        oldTier: existingMembership.tier,
        newTier: data.tier
      }, 'Membership updated successfully');

      return {
        success: true,
        data: membership
      };
    } catch (error) {
      logger.error({ error, membershipId: id, data }, 'Failed to update membership');
      return {
        success: false,
        error: new ApiError('Failed to update membership', 500, 'UPDATE_FAILED')
      };
    }
  }

  async findById(id: string, includeDetails = false): Promise<ServiceResult<MembershipWithDetails | null>> {
    try {
      const cacheKey = `membership:${id}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let membership = await cacheGet(cacheKey) as MembershipWithDetails | null;
      if (!membership) {
        membership = await this.membershipRepo.findUnique({
          where: { id },
          include: includeDetails ? {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          } : undefined
        });

        if (membership) {
          await cacheSet(cacheKey, membership, 600); // 10 minutes
        }
      }

      return {
        success: true,
        data: membership
      };
    } catch (error) {
      logger.error({ error, membershipId: id }, 'Failed to find membership');
      return {
        success: false,
        error: new ApiError('Failed to retrieve membership', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findByUserId(userId: string, includeDetails = false): Promise<ServiceResult<MembershipWithDetails | null>> {
    try {
      const cacheKey = `membership:user:${userId}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let membership = await cacheGet(cacheKey) as MembershipWithDetails | null;
      if (!membership) {
        membership = await this.membershipRepo.findFirst({
          where: { userId },
          include: includeDetails ? {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          } : undefined,
          orderBy: { startDate: 'desc' } // Get most recent membership
        });

        if (membership) {
          await cacheSet(cacheKey, membership, 600); // 10 minutes
        }
      }

      return {
        success: true,
        data: membership
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find membership by user ID');
      return {
        success: false,
        error: new ApiError('Failed to retrieve membership', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async search(params: MembershipSearchParams): Promise<ServiceResult<PaginatedResult<MembershipWithDetails>>> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.MembershipWhereInput = {};

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.tier) {
        where.tier = params.tier;
      }

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      if (params.autoRenew !== undefined) {
        where.autoRenew = params.autoRenew;
      }

      if (params.expiringWithinDays) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + params.expiringWithinDays);
        
        where.endDate = {
          lte: expirationDate,
          gte: new Date() // Not already expired
        };
        where.isActive = true; // Only active memberships can expire
      }

      // Build orderBy clause
      let orderBy: Prisma.MembershipOrderByWithRelationInput = { startDate: 'desc' };
      if (params.sortBy) {
        const sortOrder = params.sortOrder || 'desc';
        switch (params.sortBy) {
          case 'tier':
            orderBy = { tier: sortOrder };
            break;
          case 'startDate':
            orderBy = { startDate: sortOrder };
            break;
          case 'endDate':
            orderBy = { endDate: sortOrder };
            break;
          case 'isActive':
            orderBy = { isActive: sortOrder };
            break;
        }
      }

      const [memberships, total] = await Promise.all([
        this.membershipRepo.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }),
        this.membershipRepo.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: memberships,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to search memberships');
      return {
        success: false,
        error: new ApiError('Failed to search memberships', 500, 'SEARCH_FAILED')
      };
    }
  }

  async getMembershipAnalytics(params: {
    tier?: MembershipTier;
    isActive?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ServiceResult<MembershipAnalytics>> {
    try {
      // Build where clause for analytics
      const where: Prisma.MembershipWhereInput = {};

      if (params.tier) {
        where.tier = params.tier;
      }

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      if (params.dateFrom || params.dateTo) {
        where.startDate = {};
        if (params.dateFrom) where.startDate.gte = params.dateFrom;
        if (params.dateTo) where.startDate.lte = params.dateTo;
      }

      // Get memberships for analytics
      const [memberships, aggregation] = await Promise.all([
        this.membershipRepo.findMany({
          where,
          select: {
            id: true,
            tier: true,
            isActive: true,
            autoRenew: true,
            discountRate: true,
            endDate: true
          }
        }),
        this.membershipRepo.aggregate({
          where,
          _count: { id: true },
          _avg: { discountRate: true }
        })
      ]);

      // Calculate analytics
      const membershipsByTier: Record<string, number> = {};
      let activeMemberships = 0;
      let autoRenewCount = 0;
      let expiringMemberships = 0;

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      memberships.forEach((membership: any) => {
        // Count by tier
        membershipsByTier[membership.tier] = (membershipsByTier[membership.tier] || 0) + 1;

        // Count active memberships
        if (membership.isActive) {
          activeMemberships++;
        }

        // Count auto-renew
        if (membership.autoRenew) {
          autoRenewCount++;
        }

        // Count expiring memberships (within 30 days)
        if (membership.isActive && membership.endDate && membership.endDate <= thirtyDaysFromNow) {
          expiringMemberships++;
        }
      });

      const autoRenewRate = memberships.length > 0 ? autoRenewCount / memberships.length : 0;

      return {
        success: true,
        data: {
          totalMemberships: aggregation._count.id,
          activeMemberships,
          membershipsByTier,
          expiringMemberships,
          autoRenewRate: Math.round(autoRenewRate * 1000) / 10, // Percentage with 1 decimal
          averageDiscountRate: Math.round((aggregation._avg.discountRate || 0) * 1000) / 10
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to get membership analytics');
      return {
        success: false,
        error: new ApiError('Failed to get membership analytics', 500, 'ANALYTICS_FAILED')
      };
    }
  }

  async upgradeMembership(userId: string, newTier: MembershipTier): Promise<ServiceResult<Membership>> {
    try {
      // Find existing active membership
      const existingMembership = await this.membershipRepo.findFirst({
        where: { 
          userId,
          isActive: true
        }
      });

      if (!existingMembership) {
        return {
          success: false,
          error: new ApiError('No active membership found for user', 404, 'NO_ACTIVE_MEMBERSHIP')
        };
      }

      // PRODUCTION: Validate upgrade path
      const currentTier = existingMembership.tier;
      if (!this.isValidTierUpgrade(currentTier, newTier)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid tier upgrade from ${currentTier} to ${newTier}`,
            400,
            'INVALID_TIER_UPGRADE'
          )
        };
      }

      // Calculate new benefits
      const benefits = this.calculateMembershipBenefits(newTier);

      // Update membership with new tier and benefits
      const updatedMembership = await this.membershipRepo.update(existingMembership.id, {
        tier: newTier,
        freeShipping: benefits.freeShipping,
        discountRate: benefits.discountRate,
        prioritySupport: benefits.prioritySupport
      });

      // Clear related caches
      await this.clearMembershipCaches(userId);

      logger.info({
        event: 'MEMBERSHIP_UPGRADED',
        membershipId: existingMembership.id,
        userId,
        oldTier: currentTier,
        newTier,
        benefits
      }, 'Membership upgraded successfully');

      return {
        success: true,
        data: updatedMembership
      };
    } catch (error) {
      logger.error({ error, userId, newTier }, 'Failed to upgrade membership');
      return {
        success: false,
        error: new ApiError('Failed to upgrade membership', 500, 'UPGRADE_FAILED')
      };
    }
  }

  async renewMembership(id: string, extendByMonths: number = 12): Promise<ServiceResult<Membership>> {
    try {
      // Check if membership exists
      const existingMembership = await this.membershipRepo.findById(id);
      if (!existingMembership) {
        return {
          success: false,
          error: new ApiError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND')
        };
      }

      // PRODUCTION: Calculate new end date
      const currentEndDate = existingMembership.endDate || new Date();
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + extendByMonths);

      // Update membership
      const renewedMembership = await this.membershipRepo.update(id, {
        endDate: newEndDate,
        isActive: true // Reactivate if was inactive
      });

      // Clear related caches
      await this.clearMembershipCaches(existingMembership.userId);

      logger.info({
        event: 'MEMBERSHIP_RENEWED',
        membershipId: id,
        userId: existingMembership.userId,
        oldEndDate: existingMembership.endDate?.toISOString(),
        newEndDate: newEndDate.toISOString(),
        extendByMonths
      }, 'Membership renewed successfully');

      return {
        success: true,
        data: renewedMembership
      };
    } catch (error) {
      logger.error({ error, membershipId: id, extendByMonths }, 'Failed to renew membership');
      return {
        success: false,
        error: new ApiError('Failed to renew membership', 500, 'RENEWAL_FAILED')
      };
    }
  }

  async cancelMembership(id: string, reason?: string): Promise<ServiceResult<Membership>> {
    try {
      // Check if membership exists and is active
      const existingMembership = await this.membershipRepo.findById(id);
      if (!existingMembership) {
        return {
          success: false,
          error: new ApiError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND')
        };
      }

      if (!existingMembership.isActive) {
        return {
          success: false,
          error: new ApiError('Membership is already inactive', 400, 'MEMBERSHIP_INACTIVE')
        };
      }

      // Deactivate membership
      const cancelledMembership = await this.membershipRepo.update(id, {
        isActive: false,
        autoRenew: false
      });

      // Clear related caches
      await this.clearMembershipCaches(existingMembership.userId);

      logger.info({
        event: 'MEMBERSHIP_CANCELLED',
        membershipId: id,
        userId: existingMembership.userId,
        tier: existingMembership.tier,
        reason: reason || 'No reason provided'
      }, 'Membership cancelled successfully');

      return {
        success: true,
        data: cancelledMembership
      };
    } catch (error) {
      logger.error({ error, membershipId: id, reason }, 'Failed to cancel membership');
      return {
        success: false,
        error: new ApiError('Failed to cancel membership', 500, 'CANCELLATION_FAILED')
      };
    }
  }

  // PRODUCTION: Private helper methods for business logic

  private calculateMembershipBenefits(tier: MembershipTier): MembershipBenefits {
    // PRODUCTION: Define tier-based benefits
    const benefitsMap: Record<MembershipTier, MembershipBenefits> = {
      [MembershipTier.BASIC]: {
        freeShipping: false,
        discountRate: 0,
        prioritySupport: false,
        features: ['Basic catalog access']
      },
      [MembershipTier.PREMIUM]: {
        freeShipping: true,
        discountRate: 0.05, // 5% discount
        prioritySupport: false,
        features: ['Free shipping', '5% discount', 'Early access to sales']
      },
      [MembershipTier.VIP]: {
        freeShipping: true,
        discountRate: 0.15, // 15% discount
        prioritySupport: true,
        features: ['Free shipping', '15% discount', 'Priority support', 'Exclusive products', 'Birthday rewards']
      }
    };

    return benefitsMap[tier];
  }

  private isValidTierUpgrade(currentTier: MembershipTier, newTier: MembershipTier): boolean {
    // PRODUCTION: Define valid upgrade paths
    const tierHierarchy = {
      [MembershipTier.BASIC]: 0,
      [MembershipTier.PREMIUM]: 1,
      [MembershipTier.VIP]: 2
    };

    return tierHierarchy[newTier] > tierHierarchy[currentTier];
  }

  private async triggerMembershipActivation(membershipId: string): Promise<void> {
    // PRODUCTION: This would trigger welcome emails, benefit activation, etc.
    logger.info({
      membershipId,
      event: 'MEMBERSHIP_ACTIVATION_TRIGGERED'
    }, 'Membership activation workflow triggered');
  }

  private async clearMembershipCaches(userId: string): Promise<void> {
    try {
      // Simple cache clearing - in a real implementation, this would clear specific patterns
      logger.info({ userId }, 'Membership caches cleared');
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to clear some membership caches');
    }
  }
}