export function calculateCommission(amount: number, rate: number): number {
  return amount * (rate / 100);
}

export function calculateNetAmount(amount: number, commissionRate: number): number {
  const commission = calculateCommission(amount, commissionRate);
  return amount - commission;
}

export function calculatePlatformFee(amount: number, feePercentage: number = 2.5): number {
  return amount * (feePercentage / 100);
}