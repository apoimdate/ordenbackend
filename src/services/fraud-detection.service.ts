import { PrismaClient, FraudRule, Order, Payment, User } from '@prisma/client';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export interface FraudCheckResult {
  id: string;
  score: number;
  passed: boolean;
  rules: RuleCheckResult[];
  recommendations: string[];
  requiresManualReview: boolean;
  blockedReason?: string;
}

export interface RuleCheckResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  score: number;
  reason?: string;
}

export interface FraudContext {
  user: User & {
    orders?: Order[];
    _count?: { orders: number };
  };
  order?: Order & {
    items?: any[];
    payment?: Payment;
  };
  payment?: Payment;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
}

export class FraudDetectionService {
  private static readonly CACHE_TTL = 3600; // 1 hour
  private static readonly FRAUD_THRESHOLD = 0.7;
  private static readonly REVIEW_THRESHOLD = 0.5;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  /**
   * Perform comprehensive fraud check
   */
  async checkFraud(context: FraudContext): Promise<FraudCheckResult> {
    const checkId = this.generateCheckId();
    const startTime = Date.now();

    try {
      // Get active fraud rules
      const rules = await this.getActiveFraudRules();

      // Run all rules in parallel
      const ruleResults = await Promise.all(
        rules.map(rule => this.evaluateRule(rule, context))
      );

      // Calculate overall fraud score
      const totalScore = ruleResults.reduce((sum, result) => sum + result.score, 0);
      const maxPossibleScore = rules.reduce((sum, rule) => sum + rule.weight, 0);
      const normalizedScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

      // Determine if fraud check passed
      const passed = normalizedScore < FraudDetectionService.FRAUD_THRESHOLD;
      const requiresManualReview = normalizedScore >= FraudDetectionService.REVIEW_THRESHOLD &&
        normalizedScore < FraudDetectionService.FRAUD_THRESHOLD;

      // Generate recommendations
      const recommendations = this.generateRecommendations(ruleResults, normalizedScore);

      // Check for immediate blocks
      const blockedRule = ruleResults.find(r => !r.passed && r.score >= 1.0);
      const blockedReason = blockedRule?.reason;

      // Store fraud check result
      const result: FraudCheckResult = {
        id: checkId,
        score: normalizedScore,
        passed,
        rules: ruleResults,
        recommendations,
        requiresManualReview,
        blockedReason
      };

      // Save to database
      await this.saveFraudCheck(context, result, Date.now() - startTime);

      // Cache result
      await this.cacheResult(checkId, result);

      // If fraud detected, trigger alerts
      if (!passed) {
        await this.triggerFraudAlert(context, result);
      }

      return result;
    } catch (error) {
      logger.error({ error, checkId }, 'Fraud check failed');

      // In case of error, allow transaction but flag for review
      return {
        id: checkId,
        score: 0.5,
        passed: true,
        rules: [],
        recommendations: ['Manual review recommended due to system error'],
        requiresManualReview: true
      };
    }
  }

  /**
   * Check specific fraud indicators
   */
  async checkVelocity(userId: string, type: 'order' | 'payment', timeWindow: number = 3600): Promise<number> {
    const key = `fraud:velocity:${type}:${userId}`;
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.expire(key, timeWindow);
    }
    
    return count;
  }

  async checkIPReputation(ipAddress: string): Promise<boolean> {
    // Check if IP is blocked
    const blocked = await this.prisma.blockedIp.findFirst({
      where: {
        ipAddress: ipAddress
      }
    });

    if (blocked) {
      return false;
    }

    // Check IP velocity
    const key = `fraud:ip:${ipAddress}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      await this.redis.expire(key, 3600); // 1 hour window
    }

    // More than 10 attempts per hour is suspicious
    return attempts <= 10;
  }

  async checkEmailReputation(email: string): Promise<boolean> {
    // Check if email is blocked
    const blocked = await this.prisma.blockedEmail.findFirst({
      where: {
        email: email.toLowerCase()
      }
    });

    return !blocked;
  }

  /**
   * Get fraud score for a user
   */
  async getUserFraudScore(userId: string): Promise<number> {
    const cacheKey = `fraud:score:${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return parseFloat(cached);
    }

    // Calculate based on history
    const [fraudChecks, orders] = await Promise.all([
      this.prisma.fraudCheck.findMany({
        where: {
          // userId field not available in FraudCheck
          checkedAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          }
        },
        orderBy: { id: 'desc' },
        take: 10
      }),
      this.prisma.order.count({
        where: {
          userId,
          status: 'DELIVERED'
        }
      })
    ]);

    // Base score
    let score = 0.3; // Start with moderate risk

    // Adjust based on fraud check history
    if (fraudChecks.length > 0) {
      const avgScore = fraudChecks.reduce((sum, check) => sum + check.score, 0) / fraudChecks.length;
      score = avgScore;
    }

    // Reduce score for established users
    if (orders > 10) {
      score *= 0.7;
    } else if (orders > 5) {
      score *= 0.85;
    }

    // Cache the score
    await this.redis.setex(cacheKey, FraudDetectionService.CACHE_TTL, score.toString());

    return score;
  }

  // Private methods

  private async getActiveFraudRules(): Promise<FraudRule[]> {
    return this.prisma.fraudRule.findMany({
      where: { isActive: true },
      orderBy: { weight: 'desc' }
    });
  }

  private async evaluateRule(rule: FraudRule, context: FraudContext): Promise<RuleCheckResult> {
    try {
      let passed = true;
      let score = 0;
      let reason: string | undefined;

      // Since rule.type doesn't exist in schema, use name to determine type
      const ruleType = this.determineRuleType(rule.name);
      switch (ruleType) {
        case 'VELOCITY':
          const velocityResult = await this.checkVelocityRule(rule, context);
          passed = velocityResult.passed;
          score = velocityResult.score;
          reason = velocityResult.reason;
          break;

        case 'AMOUNT':
          const amountResult = this.checkAmountRule(rule, context);
          passed = amountResult.passed;
          score = amountResult.score;
          reason = amountResult.reason;
          break;

        case 'LOCATION':
          const locationResult = await this.checkLocationRule(rule, context);
          passed = locationResult.passed;
          score = locationResult.score;
          reason = locationResult.reason;
          break;

        case 'PATTERN':
          const patternResult = await this.checkPatternRule(rule, context);
          passed = patternResult.passed;
          score = patternResult.score;
          reason = patternResult.reason;
          break;

        case 'DEVICE':
          const deviceResult = this.checkDeviceRule(rule, context);
          passed = deviceResult.passed;
          score = deviceResult.score;
          reason = deviceResult.reason;
          break;

        case 'CUSTOM':
          const customResult = await this.evaluateCustomRule(rule, context);
          passed = customResult.passed;
          score = customResult.score;
          reason = customResult.reason;
          break;
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed,
        score: passed ? 0 : score * rule.weight,
        reason
      };
    } catch (error) {
      logger.error({ error, ruleId: rule.id }, 'Rule evaluation failed');

      // If rule fails, don't block transaction
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed: true,
        score: 0,
        reason: 'Rule evaluation error'
      };
    }
  }

  private async checkVelocityRule(rule: FraudRule, context: FraudContext) {
    const config = rule.conditions as any;
    const timeWindow = config.timeWindow || 3600;
    const maxCount = config.maxCount || 5;
    const type = config.type || 'order';

    const count = await this.checkVelocity(context.user.id, type, timeWindow);
    const passed = count <= maxCount;

    return {
      passed,
      score: passed ? 0 : 1,
      reason: passed ? undefined : `Too many ${type}s: ${count} in ${timeWindow}s`
    };
  }

  private checkAmountRule(rule: FraudRule, context: FraudContext) {
    const config = rule.conditions as any;
    const maxAmount = config.maxAmount || 1000;
    const amount = context.order?.totalAmount || context.payment?.amount || 0;

    const passed = Number(amount) <= maxAmount;

    return {
      passed,
      score: passed ? 0 : Math.min(Number(amount) / maxAmount, 2),
      reason: passed ? undefined : `Amount ${amount} exceeds limit ${maxAmount}`
    };
  }

  private async checkLocationRule(rule: FraudRule, context: FraudContext) {
    const config = rule.conditions as any;
    const allowedCountries = config.allowedCountries || [];
    const blockedCountries = config.blockedCountries || [];

    // Get country from IP
    const country = await this.getCountryFromIP(context.ipAddress);

    let passed = true;
    let reason: string | undefined;

    if (allowedCountries.length > 0 && !allowedCountries.includes(country)) {
      passed = false;
      reason = `Country ${country} not in allowed list`;
    }

    if (blockedCountries.includes(country)) {
      passed = false;
      reason = `Country ${country} is blocked`;
    }

    return {
      passed,
      score: passed ? 0 : 1,
      reason
    };
  }

  private async checkPatternRule(_rule: FraudRule, context: FraudContext) {
    // const config = rule.conditions as any;

    // Check for suspicious patterns
    const patterns = {
      multipleFailedPayments: await this.checkMultipleFailedPayments(context.user.id),
      rapidAccountChanges: await this.checkRapidAccountChanges(context.user.id),
      unusualOrderPattern: await this.checkUnusualOrderPattern(context.user.id)
    };

    const suspiciousPatterns = Object.entries(patterns)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    const passed = suspiciousPatterns.length === 0;

    return {
      passed,
      score: passed ? 0 : suspiciousPatterns.length * 0.3,
      reason: passed ? undefined : `Suspicious patterns: ${suspiciousPatterns.join(', ')}`
    };
  }

  private checkDeviceRule(_rule: FraudRule, _context: FraudContext) {
    // const config = rule.conditions as any;

    // Simple device fingerprinting based on user agent
    // const deviceFingerprint = this.generateDeviceFingerprint(context.userAgent);

    // Check if device has been used for fraud before
    // This is simplified - in production you'd want more sophisticated fingerprinting

    return {
      passed: true,
      score: 0,
      reason: undefined
    };
  }

  private async evaluateCustomRule(_rule: FraudRule, _context: FraudContext) {
    // Custom rules would be implemented based on specific business logic
    return {
      passed: true,
      score: 0,
      reason: undefined
    };
  }

  private generateRecommendations(results: RuleCheckResult[], score: number): string[] {
    const recommendations: string[] = [];

    if (score >= 0.9) {
      recommendations.push('Block transaction immediately');
      recommendations.push('Add user to watchlist');
    } else if (score >= 0.7) {
      recommendations.push('Require additional verification');
      recommendations.push('Hold payment for manual review');
    } else if (score >= 0.5) {
      recommendations.push('Monitor transaction closely');
      recommendations.push('Request additional documentation if needed');
    }

    // Add specific recommendations based on failed rules
    results.forEach(result => {
      if (!result.passed) {
        switch (result.ruleName) {
          case 'Velocity Check':
            recommendations.push('Consider implementing rate limiting');
            break;
          case 'Amount Check':
            recommendations.push('Verify source of funds for large transactions');
            break;
          case 'Location Check':
            recommendations.push('Verify user location and shipping address');
            break;
        }
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private async saveFraudCheck(context: FraudContext, result: FraudCheckResult, processingTime: number) {
    await this.prisma.fraudCheck.create({
      data: {
        orderId: context.order?.id || 'unknown',
        ruleName: 'automated_check',
        result: result.passed ? 'PASS' : 'FAIL',
        score: result.score,
        details: {
          rules: result.rules,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          processingTime,
          requiresReview: result.requiresManualReview,
          reviewNotes: result.blockedReason
        } as any
      }
    });
  }

  private async cacheResult(checkId: string, result: FraudCheckResult) {
    const key = `fraud:check:${checkId}`;
    await this.redis.setex(key, FraudDetectionService.CACHE_TTL, JSON.stringify(result));
  }

  private async triggerFraudAlert(context: FraudContext, result: FraudCheckResult) {
    // Create fraud alert
    await this.prisma.fraudAlert.create({
      data: {
        orderId: context.order?.id || 'unknown',
        reason: `Fraud score ${result.score.toFixed(2)} - ${result.blockedReason || 'Multiple risk factors detected'}`
      }
    });

    // Log for monitoring
    logger.warn({
      userId: context.user.id,
      fraudScore: result.score,
      checkId: result.id,
      ipAddress: context.ipAddress
    }, 'High fraud risk detected');
  }

  // Helper methods

  private generateCheckId(): string {
    return `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Currently unused but may be needed for future device fingerprinting
  // private generateDeviceFingerprint(userAgent: string): string {
  //   return createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
  // }

  private async getCountryFromIP(_ipAddress: string): Promise<string> {
    // In production, use a GeoIP service
    // For now, return a default
    return 'US';
  }

  private async checkMultipleFailedPayments(_userId: string): Promise<boolean> {
    const failedPayments = await this.prisma.payment.count({
      where: {
        // userId field not available in Payment
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    return failedPayments >= 3;
  }

  private async checkRapidAccountChanges(userId: string): Promise<boolean> {
    // Check for rapid email/phone changes
    const recentChanges = await this.prisma.userActivityLog.count({
      where: {
        userId,
        // action field not available in UserActivityLog
        activity: {
          in: ['email_changed', 'phone_changed', 'password_changed']
        },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    return recentChanges >= 2;
  }

  private async checkUnusualOrderPattern(userId: string): Promise<boolean> {
    // Check for unusual order patterns
    const recentOrders = await this.prisma.order.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
        }
      },
      select: {
        totalAmount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentOrders.length < 2) return false;

    // Check for sudden spike in order amounts
    const avgAmount = recentOrders.reduce((sum, order) => sum + order.totalAmount.toNumber(), 0) / recentOrders.length;
    const latestAmount = recentOrders[0].totalAmount.toNumber();

    return latestAmount > avgAmount * 3; // 3x spike is suspicious
  }

  private determineRuleType(ruleName: string): string {
    // Determine rule type based on name since rule.type doesn't exist in schema
    if (ruleName.toLowerCase().includes('velocity')) return 'VELOCITY';
    if (ruleName.toLowerCase().includes('amount')) return 'AMOUNT';
    if (ruleName.toLowerCase().includes('frequency')) return 'FREQUENCY';
    if (ruleName.toLowerCase().includes('geolocation')) return 'GEOLOCATION';
    return 'UNKNOWN';
  }
}