import { PrismaClient, User, Role } from '@prisma/client';
import { Redis } from 'ioredis';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { UserActivityLogRepository } from '../repositories/user-activity-log.repository';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptedTerms: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  twoFactorCode?: string;
  deviceInfo?: {
    userAgent: string;
    ip: string;
    fingerprint?: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  sessionId: string;
  userType: string;
  permissions?: string[];
  sellerId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;
  private activityLogRepo: UserActivityLogRepository;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    logger: any
  ) {
    this.userRepo = new UserRepository(prisma, redis, logger);
    this.sessionRepo = new SessionRepository(prisma, redis, logger);
    this.activityLogRepo = new UserActivityLogRepository(prisma, redis, logger);
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    // Validate terms acceptance
    if (!data.acceptedTerms) {
      throw new Error('You must accept the terms and conditions');
    }

    // Check if email or username already exists
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await this.userRepo.create({
      email: data.email.toLowerCase(),
      passwordHash: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phone,
      role: 'USER',
      emailVerified: false,
    });

    // Generate email verification token
    const verificationToken = nanoid(32);
    await this.redis.setex(
      `email:verify:${verificationToken}`,
      86400, // 24 hours
      user.id
    );

    // TODO: Send verification email

    // Create session and generate tokens
    const tokens = await this.createSession(user);

    // Log registration
    await this.logActivity(user.id, 'USER_REGISTERED');

    return { user, tokens };
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<{ user: User; tokens: AuthTokens }> {
    // Find user by email or username
    const user = await this.userRepo.findByEmail(data.email.toLowerCase());
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, ((user as any).password || user.passwordHash));
    if (!isValidPassword) {
      // Log failed attempt
      await this.logFailedLogin(user.id, data.deviceInfo);
      throw new Error('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!data.twoFactorCode) {
        // Return partial success indicating 2FA is required
        return {
          user: {
            ...user,
            passwordHash: '', // Don't send password
            twoFactorSecret: '' // Don't send secret
          } as User,
          tokens: {
            accessToken: '',
            refreshToken: '',
            expiresIn: 0,
            tokenType: 'Bearer'
          }
        };
      }

      // Verify 2FA code
      const isValid2FA = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: data.twoFactorCode,
        window: 2
      });

      if (!isValid2FA) {
        throw new Error('Invalid 2FA code');
      }
    }

    // Update last login
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    // Create session and generate tokens
    const tokens = await this.createSession(user, data.deviceInfo);

    // Log successful login
    await this.logActivity(user.id, 'USER_LOGIN', data.deviceInfo);

    return {
      user: {
        ...user,
        passwordHash: '', // Don't send password
        twoFactorSecret: '' // Don't send secret
      } as User,
      tokens
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret
      ) as JWTPayload;

      // Check if session exists and is valid
      const session = await this.sessionRepo.findById(payload.sessionId);
      if (!session || session.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Check if session has expired
      if (session.expiresAt < new Date()) {
        await this.sessionRepo.delete(session.id);
        throw new Error('Session expired');
      }

      // Get user
      const user = await this.userRepo.findById(payload.userId);
      if (!user) {
        throw new Error('User not found or inactive');
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user, session.id);

      return {
        accessToken: newAccessToken,
        refreshToken, // Keep same refresh token
        expiresIn: this.getTokenExpiry(config.jwt.expiresIn),
        tokenType: 'Bearer'
      };
    } catch (error) { 
      logger.error({ error }, 'Refresh token failed');
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      // Logout specific session
      await this.sessionRepo.delete(sessionId);
    } else {
      // Logout all sessions
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    }

    // Clear any cached tokens
    if (sessionId) {
      await this.redis.del(`session:${sessionId}`);
    }

    // Log logout
    await this.logActivity(userId, 'USER_LOGOUT');
  }

  /**
   * Setup 2FA for user
   */
  async setup2FA(userId: string): Promise<TwoFactorSetup> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${config.jwt.refreshSecret} (${user.email})`,
      length: 32
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => nanoid(16));
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    // Store temporarily (user must verify to enable)
    await this.redis.setex(
      `2fa:setup:${userId}`,
      600, // 10 minutes
      JSON.stringify({
        secret: secret.base32,
        backupCodes: hashedBackupCodes
      })
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes
    };
  }

  /**
   * Verify and enable 2FA
   */
  async verify2FA(userId: string, token: string): Promise<void> {
    // Get setup data
    const setupData = await this.redis.get(`2fa:setup:${userId}`);
    if (!setupData) {
      throw new Error('2FA setup expired or not found');
    }

    const { secret } = JSON.parse(setupData);

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    // Enable 2FA for user
    await this.userRepo.update(userId, {
      twoFactorEnabled: true,
      twoFactorSecret: secret
    });

    // Clear setup data
    await this.redis.del(`2fa:setup:${userId}`);

    // Log 2FA enablement
    await this.activityLogRepo.create({
      userId,
      activity: '2FA_ENABLED',
      ipAddress: 'system',
      userAgent: 'system'
    });
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, ((user as any).password || user.passwordHash));
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Disable 2FA
    await this.userRepo.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null
    });

    // Log 2FA disablement
    await this.activityLogRepo.create({
      userId,
      activity: '2FA_DISABLED',
      ipAddress: 'system',
      userAgent: 'system'
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = nanoid(32);
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Store token
    await this.redis.setex(
      `password:reset:${user.id}`,
      3600, // 1 hour
      hashedToken
    );

    // TODO: Send reset email with token

    // Log password reset request
    await this.logActivity(user.id, 'PASSWORD_RESET_REQUESTED');
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Find user by token
    const keys = await this.redis.keys('password:reset:*');
    let userId: string | null = null;

    for (const key of keys) {
      const value = await this.redis.get(key);
      if (value && (await bcrypt.compare(token, value))) {
        userId = key.split(':')[2];
        break;
      }
    }

    if (!userId) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.userRepo.update(userId, { passwordHash: hashedPassword });

    // Delete reset token
    await this.redis.del(`password:reset:${userId}`);

    // Invalidate all sessions
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    // Log password reset
    await this.logActivity(userId, 'PASSWORD_RESET_COMPLETED');
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redis.get(`email:verify:${token}`);
    if (!userId) {
      throw new Error('Invalid or expired verification token');
    }

    // Update user
    await this.userRepo.update(userId, { emailVerified: true });

    // Delete token
    await this.redis.del(`email:verify:${token}`);

    // Log email verification
    await this.activityLogRepo.create({
      userId,
      activity: 'EMAIL_VERIFIED',
      ipAddress: 'system',
      userAgent: 'system'
    });
  }

  // Private helper methods

  private async createSession(
    user: User,
    deviceInfo?: any
  ): Promise<AuthTokens> {
    // Create session
    const session = await this.sessionRepo.create({
      user: { connect: { id: user.id } },
      ipAddress: deviceInfo?.ip || 'unknown',
      userAgent: deviceInfo?.userAgent || 'unknown',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      token: '',
      refreshToken: ''
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user, session.id);
    const refreshToken = this.generateRefreshToken(user, session.id);

    // Update session with refresh token
    await this.sessionRepo.update(session.id, { refreshToken });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpiry(config.jwt.expiresIn),
      tokenType: 'Bearer'
    };
  }

  private generateAccessToken(user: User, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      userType: user.role,
      permissions: this.getRolePermissions(user.role),
      sellerId: null
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: this.getTokenExpiry(config.jwt.expiresIn)
    });
  }

  private generateRefreshToken(user: User, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      userType: user.role
    };

    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: this.getTokenExpiry(config.jwt.refreshExpiresIn)
    });
  }

  private getRolePermissions(role: Role): string[] {
    const permissions: Record<Role, string[]> = {
      USER: ['read:own_profile', 'update:own_profile', 'create:order'],
      SELLER: ['read:own_products', 'create:product', 'update:own_products', 'read:own_orders'],
      ADMIN: ['read:all', 'update:all', 'delete:all'],
      SUPER_ADMIN: ['*']
    };

    return permissions[role] || [];
  }

  private getTokenExpiry(duration: string): number {
    const match = duration.match(/(\d+)([smhd])/);
    if (!match) return 900; // Default 15 minutes

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };

    return parseInt(value) * (multipliers[unit] || 60);
  }

  private async logFailedLogin(userId: string, deviceInfo?: any): Promise<void> {
    await this.logActivity(userId, 'LOGIN_FAILED', deviceInfo);

    // Increment failed login counter
    const key = `login:failed:${userId}`;
    const attempts = await this.redis.incr(key);
    
    if (attempts === 1) {
      await this.redis.expire(key, 900); // 15 minutes
    }

    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      await this.userRepo.update(userId, { 
        isActive: false
      } as any);
    }
  }

  private async logActivity(
    userId: string, 
    activity: string, 
    deviceInfo?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.activityLogRepo.create({
      userId,
      activity,
      ipAddress: deviceInfo?.ip || 'unknown',
      userAgent: deviceInfo?.userAgent || 'unknown'
    });
  }
}
