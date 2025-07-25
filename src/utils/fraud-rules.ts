/**
 * Default fraud detection rules
 * These are the 6 rules mentioned in the requirements
 */

export const DEFAULT_FRAUD_RULES = [
  {
    name: 'High Velocity Check',
    type: 'VELOCITY',
    weight: 0.8,
    configuration: {
      timeWindow: 3600, // 1 hour
      maxCount: 5,
      type: 'order'
    },
    description: 'Detects rapid order creation indicating potential fraud',
    isActive: true
  },
  {
    name: 'Large Transaction Amount',
    type: 'AMOUNT',
    weight: 0.7,
    configuration: {
      maxAmount: 5000,
      firstTimeUserMaxAmount: 500
    },
    description: 'Flags unusually large transactions, especially for new users',
    isActive: true
  },
  {
    name: 'Suspicious Location',
    type: 'LOCATION',
    weight: 0.9,
    configuration: {
      blockedCountries: ['KP', 'IR'], // Example high-risk countries
      allowedCountries: [], // Empty means all countries allowed except blocked
      checkVPN: true
    },
    description: 'Blocks transactions from high-risk locations',
    isActive: true
  },
  {
    name: 'Unusual Pattern Detection',
    type: 'PATTERN',
    weight: 0.6,
    configuration: {
      checkFailedPayments: true,
      checkAccountChanges: true,
      checkOrderPatterns: true
    },
    description: 'Identifies suspicious behavioral patterns',
    isActive: true
  },
  {
    name: 'Device Fingerprinting',
    type: 'DEVICE',
    weight: 0.5,
    configuration: {
      blockKnownFraudDevices: true,
      maxDevicesPerUser: 5,
      checkDeviceChanges: true
    },
    description: 'Tracks and validates device fingerprints',
    isActive: true
  },
  {
    name: 'Payment Method Risk',
    type: 'CUSTOM',
    weight: 0.7,
    configuration: {
      highRiskPaymentMethods: ['PREPAID_CARD'],
      requireVerificationFor: ['BANK_TRANSFER'],
      blockAfterFailures: 3
    },
    description: 'Evaluates risk based on payment method',
    isActive: true
  }
];

/**
 * Fraud risk scoring factors
 */
export const FRAUD_RISK_FACTORS = {
  // User account factors
  newAccount: 0.2, // Account < 7 days old
  unverifiedEmail: 0.15,
  unverifiedPhone: 0.1,
  noProfilePicture: 0.05,
  
  // Transaction factors
  firstTransaction: 0.15,
  rushShipping: 0.1,
  giftCardPurchase: 0.2,
  digitalGoods: 0.1,
  
  // Behavioral factors
  differentBillingShipping: 0.15,
  multipleCards: 0.1,
  recentPasswordChange: 0.15,
  recentEmailChange: 0.2,
  
  // Technical factors
  vpnUsage: 0.25,
  tor: 0.5,
  datacenterIP: 0.3,
  mismatchedTimezone: 0.15
};

/**
 * Fraud detection thresholds
 */
export const FRAUD_THRESHOLDS = {
  BLOCK: 0.8,
  MANUAL_REVIEW: 0.5,
  ADDITIONAL_VERIFICATION: 0.3,
  MONITOR: 0.2
};

/**
 * Time windows for velocity checks (in seconds)
 */
export const VELOCITY_WINDOWS = {
  REGISTRATION: 300, // 5 minutes
  LOGIN_ATTEMPTS: 900, // 15 minutes
  PASSWORD_RESET: 3600, // 1 hour
  ORDER_CREATION: 3600, // 1 hour
  PAYMENT_ATTEMPTS: 1800, // 30 minutes
  ACCOUNT_CHANGES: 3600 // 1 hour
};

/**
 * Maximum allowed velocities
 */
export const VELOCITY_LIMITS = {
  REGISTRATION_PER_IP: 3,
  LOGIN_ATTEMPTS_PER_ACCOUNT: 5,
  PASSWORD_RESET_PER_ACCOUNT: 3,
  ORDERS_PER_HOUR: 5,
  ORDERS_PER_DAY: 20,
  PAYMENT_ATTEMPTS: 5,
  ACCOUNT_CHANGES: 3
};

/**
 * Get risk score for a specific factor
 */
export function getRiskScore(factor: keyof typeof FRAUD_RISK_FACTORS): number {
  return FRAUD_RISK_FACTORS[factor] || 0;
}

/**
 * Calculate combined risk score
 */
export function calculateCombinedRisk(factors: Array<keyof typeof FRAUD_RISK_FACTORS>): number {
  const totalScore = factors.reduce((sum, factor) => sum + getRiskScore(factor), 0);
  return Math.min(totalScore, 1); // Cap at 1
}

/**
 * Determine action based on risk score
 */
export function determineAction(riskScore: number): {
  action: 'ALLOW' | 'MONITOR' | 'VERIFY' | 'REVIEW' | 'BLOCK';
  reason: string;
} {
  if (riskScore >= FRAUD_THRESHOLDS.BLOCK) {
    return { action: 'BLOCK', reason: 'High fraud risk detected' };
  }
  
  if (riskScore >= FRAUD_THRESHOLDS.MANUAL_REVIEW) {
    return { action: 'REVIEW', reason: 'Manual review required' };
  }
  
  if (riskScore >= FRAUD_THRESHOLDS.ADDITIONAL_VERIFICATION) {
    return { action: 'VERIFY', reason: 'Additional verification needed' };
  }
  
  if (riskScore >= FRAUD_THRESHOLDS.MONITOR) {
    return { action: 'MONITOR', reason: 'Transaction will be monitored' };
  }
  
  return { action: 'ALLOW', reason: 'Low risk transaction' };
}