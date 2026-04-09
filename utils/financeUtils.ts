// Newton-Raphson method to calculate XIRR

interface CashFlow {
  amount: number; // Negative for outflow (investment), Positive for inflow (redemption/current value)
  date: Date;
}

const calcEquation = (cashFlows: CashFlow[], rate: number): number => {
  return cashFlows.reduce((acc, cf) => {
    const days = (cf.date.getTime() - cashFlows[0].date.getTime()) / (1000 * 60 * 60 * 24);
    // Prevent division by zero or complex numbers if rate <= -1
    // We clamp rate slightly above -1 for calculation stability
    const effectiveRate = Math.max(rate, -0.999999);
    const denominator = Math.pow(1 + effectiveRate, days / 365);
    return acc + cf.amount / denominator;
  }, 0);
};

const calcDerivative = (cashFlows: CashFlow[], rate: number): number => {
  return cashFlows.reduce((acc, cf) => {
    const days = (cf.date.getTime() - cashFlows[0].date.getTime()) / (1000 * 60 * 60 * 24);
    const effectiveRate = Math.max(rate, -0.999999);
    const t = days / 365;
    const denominator = Math.pow(1 + effectiveRate, t + 1);
    return acc - t * cf.amount / denominator;
  }, 0);
};

export const calculateXIRR = (cashFlows: CashFlow[], guess = 0.1): number => {
  if (!cashFlows || cashFlows.length < 2) return 0;
  
  // 1. Basic Validation
  const hasPositive = cashFlows.some(cf => cf.amount > 0);
  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  
  // If we only have outflows (investments) and no current value/inflows, return -100% loss
  if (!hasPositive && hasNegative) return -100;
  // If we only have inflows (free money?) and no investment, return 0 or Infinity (undefined)
  if (!hasNegative && hasPositive) return 0;
  // Empty or invalid
  if (!hasPositive && !hasNegative) return 0;

  // 2. Sort by date
  cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 3. Newton-Raphson
  let rate = guess;
  const maxIterations = 50;
  const tolerance = 1e-5;

  for (let i = 0; i < maxIterations; i++) {
    // Clamp rate to avoid mathematical explosion
    if (rate <= -1) rate = -0.99;

    const fValue = calcEquation(cashFlows, rate);
    const fDerivative = calcDerivative(cashFlows, rate);
    
    // If derivative is too flat, Newton method fails. Try to nudge.
    if (Math.abs(fDerivative) < 1e-9) {
       rate += 0.01;
       continue;
    }
    
    const newRate = rate - fValue / fDerivative;
    
    if (Math.abs(newRate - rate) < tolerance) {
      // Converged
      const percentage = newRate * 100;
      // Sanity Check: If XIRR is absurd (e.g. > 10,000% or < -99.9%), usually bad data.
      if (percentage < -99.9) return -99.9;
      if (percentage > 10000) return 10000;
      return percentage; 
    }
    
    rate = newRate;
  }

  // 4. Fallback: Absolute Return Annualized (Simple CAGR)
  // Used when Newton-Raphson fails to converge (e.g., erratic cashflows)
  try {
      const totalInflow = cashFlows.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
      const totalOutflow = Math.abs(cashFlows.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0));
      
      if (totalOutflow === 0) return 0;

      const firstDate = cashFlows[0].date;
      const lastDate = cashFlows[cashFlows.length - 1].date;
      const days = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      const years = days / 365;
      
      // If very short period (< 30 days), Annualizing is misleading. Return Absolute.
      if (years < 0.08) {
          return ((totalInflow - totalOutflow) / totalOutflow) * 100;
      }

      const cagr = (Math.pow(totalInflow / totalOutflow, 1 / years) - 1) * 100;
      
      // Final sanity clamp
      if (!isFinite(cagr)) return 0;
      if (cagr < -99.9) return -99.9;
      if (cagr > 10000) return 10000;
      
      return cagr;
  } catch (e) {
      return 0;
  }
};

// CSV Export Utilities
export const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const exportToCSV = (data: any[], filename: string, headers?: string[]): void => {
  if (!data || data.length === 0) return;

  // If headers not provided, use object keys from first item
  const csvHeaders = headers || Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    csvHeaders.join(','),
    ...data.map(row => 
      csvHeaders.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    )
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};