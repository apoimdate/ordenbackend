import { PrismaClient, User, Address, Wishlist, Product } from '@prisma/client';
import { Redis } from 'ioredis';
import bcrypt from 'bcrypt';
// import { logger } from '../utils/logger';
import { 
  UserRepository,
  AddressRepository,
  WishlistRepository,
  OrderRepository,
  ReviewRepository
} from "../repositories";
import { cacheGet, cacheSet } from '../config/redis';
import { ApiError } from '../utils/errors';
import { ServiceResult, PaginatedResult } from '../types';

export interface UserProfile extends User {
  addresses?: Address[];
  defaultAddress?: Address | null;
  stats?: UserStats;
}

export interface UserStats {
  totalOrders: number;
  totalSpent: number;
  totalReviews: number;
  wishlistCount: number;
  joinedDays: number;
  lastOrderDate?: Date;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  preferences?: any;
  defaultAddressId?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface CreateAddressData {
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  isDefault?: boolean;
  type?: 'BILLING' | 'SHIPPING' | 'BOTH';
  phone?: string;
  instructions?: string;
}

type WishlistItem = Wishlist & { product: Product };

export class UserService {
  private userRepo: UserRepository;
  private addressRepo: AddressRepository;
  private wishlistRepo: WishlistRepository;
  private orderRepo: OrderRepository;
  private reviewRepo: ReviewRepository;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: any
  ) {
    this.userRepo = new UserRepository(prisma, redis, logger);
    this.addressRepo = new AddressRepository(prisma, redis, logger);
    this.wishlistRepo = new WishlistRepository(prisma, redis, logger);
    this.orderRepo = new OrderRepository(prisma, redis, logger);
    this.reviewRepo = new ReviewRepository(prisma, redis, logger);
  }

  async getProfile(userId: string, includeStats: boolean = false): Promise<ServiceResult<UserProfile>> {
    try {
      const cacheKey = `user:profile:${userId}${includeStats ? ':stats' : ''}`;
      const cached = await cacheGet<UserProfile>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const user = await this.userRepo.findById(userId, {
        include: {
          addresses: {
            where: { isDeleted: false },
            orderBy: { isDefault: 'desc' }
          }
        }
      });

      if (!user) {
        return { success: false, error: new ApiError('User not found', 404, 'USER_NOT_FOUND') };
      }

      const userWithAddresses = user as User & { addresses: Address[] };
      const profile: UserProfile = {
        ...userWithAddresses,
        addresses: userWithAddresses.addresses || [],
        defaultAddress: userWithAddresses.addresses?.find(a => a.isDefault) || null
      };

      if (includeStats) {
        profile.stats = await this.getUserStats(userId);
      }

      await cacheSet(cacheKey, profile, 300);

      return { success: true, data: profile };
    } catch (error) {
      this.logger.error(error, 'Error getting user profile');
      return { success: false, error: new ApiError('Could not get user profile') };
    }
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<ServiceResult<User>> {
    try {
      if (data.defaultAddressId) {
        const address = await this.addressRepo.findById(data.defaultAddressId);
        if (!address || address.userId !== userId) {
          return { success: false, error: new ApiError('Invalid address', 400, 'INVALID_ADDRESS') };
        }
        await this.setDefaultAddress(userId, data.defaultAddressId);
      }

      const updated = await this.userRepo.update(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phone
      });

      await this.redis.del(`user:profile:${userId}*`);

      return { success: true, data: updated };
    } catch (error) {
      this.logger.error(error, 'Error updating user profile');
      return { success: false, error: new ApiError('Could not update user profile') };
    }
  }

  async changePassword(userId: string, data: ChangePasswordData): Promise<ServiceResult<{ message: string }>> {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        return { success: false, error: new ApiError('User not found', 404, 'USER_NOT_FOUND') };
      }

      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        return { success: false, error: new ApiError('Current password is incorrect', 400, 'INVALID_PASSWORD') };
      }

      const hashedPassword = await bcrypt.hash(data.newPassword, 12);
      await this.userRepo.update(userId, { passwordHash: hashedPassword });
      await this.prisma.session.deleteMany({ where: { userId } });
      return { success: true, data: { message: 'Password changed successfully' } };
    } catch (error) {
      this.logger.error(error, 'Error changing password');
      return { success: false, error: new ApiError('Could not change password') };
    }
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const [
      orderStats,
      reviewCount,
      wishlistCount,
      user
    ] = await Promise.all([
      this.orderRepo.aggregate({
        where: { userId },
        _count: { id: true },
        _sum: { totalAmount: true },
        _max: { createdAt: true }
      }),
      this.reviewRepo.count({ where: { userId } }),
      this.wishlistRepo.count({ where: { userId } }),
      this.userRepo.findById(userId, { select: { createdAt: true } })
    ]);

    const joinedDays = user
      ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalOrders: orderStats._count.id || 0,
      totalSpent: orderStats._sum?.totalAmount?.toNumber() || 0,
      totalReviews: reviewCount,
      wishlistCount,
      joinedDays,
      lastOrderDate: orderStats._max?.createdAt
    };
  }

  async createAddress(userId: string, data: CreateAddressData): Promise<ServiceResult<Address>> {
    try {
      if (data.isDefault) {
        await this.addressRepo.updateMany(
          { userId },
          { isDefault: false }
        );
      }

      const address = await this.addressRepo.create({
        user: { connect: { id: userId } },
        ...data,
        isDefault: data.isDefault || false
      });

      await this.redis.del(`user:profile:${userId}*`);

      return { success: true, data: address };
    } catch (error) {
      this.logger.error(error, 'Error creating address');
      return { success: false, error: new ApiError('Could not create address') };
    }
  }

  async updateAddress(
    userId: string,
    addressId: string,
    data: Partial<CreateAddressData>
  ): Promise<ServiceResult<Address>> {
    try {
      const address = await this.addressRepo.findById(addressId);
      if (!address || address.userId !== userId) {
        return { success: false, error: new ApiError('Address not found', 404, 'ADDRESS_NOT_FOUND') };
      }

      if (data.isDefault) {
        await this.addressRepo.updateMany(
          { userId, id: { not: addressId } },
          { isDefault: false }
        );
      }

      const updated = await this.addressRepo.update(addressId, data);
      await this.redis.del(`user:profile:${userId}*`);
      return { success: true, data: updated };
    } catch (error) {
      this.logger.error(error, 'Error updating address');
      return { success: false, error: new ApiError('Could not update address') };
    }
  }

  async deleteAddress(userId: string, addressId: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const address = await this.addressRepo.findById(addressId);
      if (!address || address.userId !== userId) {
        return { success: false, error: new ApiError('Address not found', 404, 'ADDRESS_NOT_FOUND') };
      }

      await this.addressRepo.delete(addressId);

      if (address.isDefault) {
        const otherAddress = await this.addressRepo.findFirst({
          where: {
            userId,
            id: { not: addressId },
            isDeleted: false
          }
        });

        if (otherAddress) {
          await this.addressRepo.update(otherAddress.id, { isDefault: true });
        }
      }

      await this.redis.del(`user:profile:${userId}*`);
      return { success: true, data: { success: true } };
    } catch (error) {
      this.logger.error(error, 'Error deleting address');
      return { success: false, error: new ApiError('Could not delete address') };
    }
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const address = await this.addressRepo.findById(addressId);
      if (!address || address.userId !== userId) {
        return { success: false, error: new ApiError('Address not found', 404, 'ADDRESS_NOT_FOUND') };
      }

      await this.addressRepo.updateMany(
        { userId, id: { not: addressId } },
        { isDefault: false }
      );

      await this.addressRepo.update(addressId, { isDefault: true });
      await this.redis.del(`user:profile:${userId}*`);
      return { success: true, data: { success: true } };
    } catch (error) {
      this.logger.error(error, 'Error setting default address');
      return { success: false, error: new ApiError('Could not set default address') };
    }
  }

  async getAddresses(userId: string): Promise<ServiceResult<Address[]>> {
    try {
      const addresses = await this.addressRepo.findMany({
        where: { userId, isDeleted: false },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      return { success: true, data: addresses };
    } catch (error) {
      this.logger.error(error, 'Error getting addresses');
      return { success: false, error: new ApiError('Could not get addresses') };
    }
  }

  async getWishlist(userId: string, page: number, limit: number): Promise<ServiceResult<PaginatedResult<WishlistItem>>> {
    try {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.wishlistRepo.findMany({ 
                where: { userId }, 
                include: { product: true },
                skip,
                take: limit
            }),
            this.wishlistRepo.count({ where: { userId } })
        ]);
        
        const result = {
            data: items as WishlistItem[],
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
        return { success: true, data: result };
    } catch (error) {
        this.logger.error(error, 'Error getting wishlist');
        return { success: false, error: new ApiError('Could not get wishlist') };
    }
  }

  async addToWishlist(userId: string, productId: string): Promise<ServiceResult<{ message: string }>> {
    try {
        const existing = await this.wishlistRepo.findFirst({ where: { userId, productId } });
        if (existing) {
            return { success: false, error: new ApiError('Product already in wishlist', 409, 'ALREADY_IN_WISHLIST') };
        }
        await this.wishlistRepo.create({ 
            user: { connect: { id: userId } },
            product: { connect: { id: productId } }
        });
        return { success: true, data: { message: 'Product added to wishlist' } };
    } catch (error) {
        this.logger.error(error, 'Error adding to wishlist');
        return { success: false, error: new ApiError('Could not add to wishlist') };
    }
  }

  async removeFromWishlist(userId: string, productId: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
        const existing = await this.wishlistRepo.findFirst({ where: { userId, productId } });
        if (!existing) {
            return { success: false, error: new ApiError('Product not in wishlist', 404, 'NOT_IN_WISHLIST') };
        }
        await this.wishlistRepo.delete(existing.id);
        return { success: true, data: { success: true } };
    } catch (error) {
        this.logger.error(error, 'Error removing from wishlist');
        return { success: false, error: new ApiError('Could not remove from wishlist') };
    }
  }

  async deleteAccount(userId: string, password: string): Promise<ServiceResult<{ message: string }>> {
    try {
        const user = await this.userRepo.findById(userId);
        if (!user) {
            return { success: false, error: new ApiError('User not found', 404, 'USER_NOT_FOUND') };
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return { success: false, error: new ApiError('Invalid password', 401, 'INVALID_PASSWORD') };
        }
        // In a real app, this would be a soft delete or a scheduled job
        await this.userRepo.delete(userId);
        return { success: true, data: { message: 'Account deletion scheduled.' } };
    } catch (error) {
        this.logger.error(error, 'Error deleting account');
        return { success: false, error: new ApiError('Could not delete account') };
    }
  }

  async exportUserData(userId: string): Promise<ServiceResult<{ exportId: string }>> {
    try {
        // In a real app, this would trigger a background job
        const exportId = `export-${userId}-${Date.now()}`;
        this.logger.info(`User data export requested for user ${userId}, export ID: ${exportId}`);
        return { success: true, data: { exportId } };
    } catch (error) {
        this.logger.error(error, 'Error exporting user data');
        return { success: false, error: new ApiError('Could not export user data') };
    }
  }
}
