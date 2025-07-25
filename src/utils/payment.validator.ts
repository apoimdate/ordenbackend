export function validateCreditCard(cardNumber: string): boolean {
  // Remove spaces and hyphens
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  
  // Check if it's a valid number
  if (!/^\d+$/.test(cleanNumber)) {
    return false;
  }
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

export function validatePaymentAmount(amount: number): boolean {
  return amount > 0 && amount <= 1000000; // Max 1M
}

export function validateCurrency(currency: string): boolean {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'MXN', 'CAD'];
  return validCurrencies.includes(currency);
}