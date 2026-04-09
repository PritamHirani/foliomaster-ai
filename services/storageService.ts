import { Transaction, Holding, TransactionType, PortfolioSummary, Client, TransactionNature, Goal, Family } from '../types';
import { calculateXIRR } from '../utils/financeUtils';

const STORAGE_KEY_TX = 'folio_master_transactions_v3';
const STORAGE_KEY_CLIENTS = 'folio_master_clients_v3';
const STORAGE_KEY_GOALS = 'folio_master_goals_v1';
const STORAGE_KEY_FAMILIES = 'folio_master_families_v1';

// --- DATA GENERATION UTILS ---

// Base NAVs approx Jan 2021 levels with additional attributes
export const SCHEMES = [
  { code: '122639', name: 'Parag Parikh Flexi Cap Fund', category: 'Flexi Cap', baseNav: 32, expenseRatio: 0.65, aum: 2500, fundManager: 'Pramod Gupta', inception: '2013-05-21', beta: 0.85, riskProfile: 'MODERATE' },
  { code: '120586', name: 'ICICI Prudential Bluechip Fund', category: 'Large Cap', baseNav: 55, expenseRatio: 0.55, aum: 3500, fundManager: 'Anish Tawakley', inception: '2008-05-13', beta: 0.92, riskProfile: 'MODERATE' },
  { code: '119598', name: 'Nippon India Small Cap Fund', category: 'Small Cap', baseNav: 65, expenseRatio: 0.75, aum: 1800, fundManager: 'Sailesh Raj Bhan', inception: '2005-09-15', beta: 1.15, riskProfile: 'HIGH' },
  { code: '105629', name: 'SBI Magnum Midcap Fund', category: 'Mid Cap', baseNav: 95, expenseRatio: 0.70, aum: 2200, fundManager: 'Sohini Andani', inception: '2005-03-16', beta: 1.05, riskProfile: 'HIGH' },
  { code: '119216', name: 'HDFC Top 100 Fund', category: 'Large Cap', baseNav: 550, expenseRatio: 0.50, aum: 18000, fundManager: 'Prashant Jain', inception: '1996-10-11', beta: 0.88, riskProfile: 'MODERATE' },
  { code: '120828', name: 'Quant Small Cap Fund', category: 'Small Cap', baseNav: 90, expenseRatio: 0.80, aum: 1200, fundManager: 'Sandeep Tandon', inception: '2013-01-01', beta: 1.25, riskProfile: 'HIGH' },
  { code: '101239', name: 'HDFC Liquid Fund', category: 'Liquid', baseNav: 3900, expenseRatio: 0.20, aum: 45000, fundManager: 'Anil Bamboli', inception: '2000-01-01', beta: 0.02, riskProfile: 'LOW' },
  { code: '100411', name: 'Aditya Birla Sun Life Frontline Equity', category: 'Large Cap', baseNav: 290, expenseRatio: 0.60, aum: 25000, fundManager: 'Mahesh Patil', inception: '2002-08-27', beta: 0.90, riskProfile: 'MODERATE' },
  { code: '102594', name: 'Kotak Emerging Equity Fund', category: 'Mid Cap', baseNav: 65, expenseRatio: 0.65, aum: 1500, fundManager: 'Harish Krishnan', inception: '2007-03-30', beta: 1.10, riskProfile: 'HIGH' },
  { code: '141011', name: 'Axis Bluechip Fund', category: 'Large Cap', baseNav: 42, expenseRatio: 0.55, aum: 3200, fundManager: 'Shreyash Devalkar', inception: '2013-01-01', beta: 0.95, riskProfile: 'MODERATE' },
  { code: '100034', name: 'Franklin India Bluechip', category: 'Large Cap', baseNav: 600, expenseRatio: 0.60, aum: 6500, fundManager: 'Venkatesh Sanjeevi', inception: '1993-12-31', beta: 0.87, riskProfile: 'MODERATE' },
  { code: '127042', name: 'Motilal Oswal Midcap Fund', category: 'Mid Cap', baseNav: 35, expenseRatio: 0.75, aum: 1800, fundManager: 'Aditya Khemani', inception: '2014-02-03', beta: 1.08, riskProfile: 'HIGH' },
  { code: '118666', name: 'Edelweiss Balanced Advantage', category: 'Hybrid', baseNav: 32, expenseRatio: 0.55, aum: 1200, fundManager: 'Bharat Lahoti', inception: '2011-09-01', beta: 0.65, riskProfile: 'MODERATE' },
  { code: '129210', name: 'Mirae Asset Large Cap Fund', category: 'Large Cap', baseNav: 70, expenseRatio: 0.60, aum: 2800, fundManager: 'Gaurav Misra', inception: '2010-04-01', beta: 0.93, riskProfile: 'MODERATE' },
  { code: '145558', name: 'Tata Digital India Fund', category: 'Sectoral', baseNav: 28, expenseRatio: 0.70, aum: 800, fundManager: 'Meeta Shetty', inception: '2015-12-28', beta: 1.20, riskProfile: 'HIGH' }
];

const ARNS = ['ARN-0001', 'ARN-0002', 'ARN-0003'];

const generateMockData = () => {
  const clients: Client[] = [];
  const transactions: Transaction[] = [];
  const goals: Goal[] = [];
  const families: Family[] = [];

  // Client profile types for diversity
  const clientProfiles = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];
  const surnames = ['Sharma', 'Patel', 'Singh', 'Verma', 'Gupta', 'Reddy', 'Iyer', 'Kumar', 'Das', 'Malhotra', 'Joshi', 'Agarwal', 'Chopra', 'Bansal', 'Mehta'];

  // 1. Generate Clients with profiles
  ARNS.forEach((arn, arnIdx) => {
    // 10 clients per ARN
    for (let i = 0; i < 10; i++) {
      const clientId = `c_${arnIdx}_${i}`;
      const profile = clientProfiles[Math.floor(Math.random() * clientProfiles.length)];
      const familyId = Math.random() > 0.7 ? `fam_${arnIdx}_${Math.floor(i/3)}` : undefined; // 30% have families

      clients.push({
        id: clientId,
        name: `Client ${String.fromCharCode(65 + arnIdx)}${i + 1} ${surnames[i % surnames.length]}`,
        pan: `${String.fromCharCode(65 + i)}BCDE${1000 + i}${String.fromCharCode(70 + arnIdx)}`,
        associatedArn: arn,
        familyId
      });
    }
  });

  // 2. Generate Families
  ARNS.forEach((arn, arnIdx) => {
    const arnClients = clients.filter(c => c.associatedArn === arn);
    const familyGroups = Math.floor(arnClients.length / 3); // ~3 families per ARN

    for (let f = 0; f < familyGroups; f++) {
      const familyClients = arnClients.slice(f * 3, (f + 1) * 3);
      families.push({
        id: `fam_${arnIdx}_${f}`,
        name: `${['Patel', 'Sharma', 'Singh'][f % 3]} Family Group ${f + 1}`,
        description: `Family investment group for ${familyClients.length} members`,
        clientIds: familyClients.map(c => c.id),
        createdDate: '2021-01-01',
        arnFilter: arn
      });
    }
  });

  // 3. Generate Transactions with enhanced realism
  const startDate = new Date('2021-01-01');

  clients.forEach(client => {
    // Determine client profile for investment behavior
    const profile = clientProfiles[Math.floor(Math.random() * clientProfiles.length)];
    const isConservative = profile === 'CONSERVATIVE';
    const isAggressive = profile === 'AGGRESSIVE';

    // Profile-based scheme selection
    let availableSchemes = SCHEMES;
    if (isConservative) {
      availableSchemes = SCHEMES.filter(s => s.riskProfile === 'LOW' || s.riskProfile === 'MODERATE');
    } else if (isAggressive) {
      availableSchemes = SCHEMES.filter(s => s.riskProfile !== 'LOW');
    }

    // Assign schemes based on profile
    const numSchemes = isConservative ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
    let clientHasActiveFolio = false;
    
    for (let s = 0; s < numSchemes; s++) {
      const scheme = availableSchemes[Math.floor(Math.random() * availableSchemes.length)];
      const folioNumber = `${client.id.toUpperCase()}/${scheme.code}/F${s}`;
      let currentNav = scheme.baseNav;
      let currentDate = new Date(startDate);
      let folioUnitsHeld = 0;
      let folioHasBuy = false;
      
      // Profile-based investment parameters
      const baseSipAmount = isConservative ? 1000 : isAggressive ? 5000 : 2000;
      const sipAmount = baseSipAmount + Math.floor(Math.random() * 5) * 1000;
      const isSIP = Math.random() > (isConservative ? 0.4 : 0.3); // Conservatives less likely to SIP
      const isSWP = Math.random() > 0.90; // 10% chance of SWP
      
      // Loop month by month until today
      const today = new Date();
      while (currentDate < today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();

        // Seasonal patterns
        let seasonalFactor = 1.0;
        if (month === 2) seasonalFactor = 1.3; // March bonus effect
        if (month === 11) seasonalFactor = 1.2; // Year-end tax planning
        if (month >= 5 && month <= 7) seasonalFactor = 0.9; // Monsoon slowdown

        // Market regime based on year
        let regimeFactor = 1.0;
        if (year === 2021) regimeFactor = 1.02; // Bull market
        else if (year === 2022) regimeFactor = 0.98; // Bear market
        else regimeFactor = 1.015; // Recovery

        // Risk-adjusted volatility
        const baseVolatility = scheme.beta * 0.03; // Beta-based volatility
        const volatility = (Math.random() - 0.5) * baseVolatility * 2 + (regimeFactor - 1);
        currentNav = Math.max(0.1, currentNav * (1 + volatility) * seasonalFactor);

        // SIP Logic with seasonal patterns
        if (isSIP) {
          let monthlyAmount = sipAmount;
          // Higher SIP amounts near financial year end
          if (month === 2) monthlyAmount *= 1.5;

          transactions.push({
            id: crypto.randomUUID(),
            schemeCode: scheme.code,
            fundName: scheme.name,
            category: scheme.category,
            date: dateStr,
            nav: currentNav,
            amount: monthlyAmount,
            units: monthlyAmount / currentNav,
            type: TransactionType.BUY,
            nature: TransactionNature.SIP,
            clientId: client.id,
            arn: client.associatedArn,
            folioNumber
          });
          folioHasBuy = true;
          folioUnitsHeld += monthlyAmount / currentNav;
        }

        // Lumpsum Logic (Random with profile bias)
        const lumpChance = isConservative ? 0.98 : isAggressive ? 0.95 : 0.97;
        if (Math.random() > lumpChance) {
          const baseLump = isConservative ? 15000 : isAggressive ? 75000 : 25000;
          const lumpAmt = baseLump + Math.floor(Math.random() * 5) * 10000;
             transactions.push({
             id: crypto.randomUUID(),
             schemeCode: scheme.code,
             fundName: scheme.name,
             category: scheme.category,
             date: dateStr,
             nav: currentNav,
             amount: lumpAmt,
             units: lumpAmt / currentNav,
             type: TransactionType.BUY,
             nature: TransactionNature.LUMPSUM,
             clientId: client.id,
             arn: client.associatedArn,
             folioNumber
           });
           folioHasBuy = true;
           folioUnitsHeld += lumpAmt / currentNav;
        }

        // --- SWP / REDEMPTION LOGIC ---
        // Only if we are in the last 1.5 years
        const yearsElapsed = (currentDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24 * 365);
        if (yearsElapsed > 2.5) {
          if (isSWP && folioUnitsHeld > 5) {
            const swpAmt = Math.min(isConservative ? 3000 : 5000, folioUnitsHeld * currentNav * 0.25);
            const swpUnits = swpAmt / currentNav;
            if (swpUnits > 0) {
                transactions.push({
                    id: crypto.randomUUID(),
                    schemeCode: scheme.code,
                    fundName: scheme.name,
                    category: scheme.category,
                    date: dateStr,
                    nav: currentNav,
                    amount: swpAmt,
                    units: swpUnits,
                    type: TransactionType.SELL,
                    nature: TransactionNature.SWP,
                    clientId: client.id,
                    arn: client.associatedArn,
                    folioNumber
                });
                folioUnitsHeld -= swpUnits;
            }
            } else if (Math.random() > 0.99 && folioUnitsHeld > 5) {
                // Random Partial Redemption
                 const redAmt = Math.min(50000, folioUnitsHeld * currentNav * 0.3);
                 const redUnits = redAmt / currentNav;
                 if (redUnits > 0) {
                 transactions.push({
                    id: crypto.randomUUID(),
                    schemeCode: scheme.code,
                    fundName: scheme.name,
                    category: scheme.category,
                    date: dateStr,
                    nav: currentNav,
                    amount: redAmt,
                    units: redUnits,
                    type: TransactionType.SELL,
                    nature: TransactionNature.LUMPSUM, // Redemption
                    clientId: client.id,
                    arn: client.associatedArn,
                    folioNumber
                });
                folioUnitsHeld -= redUnits;
                }
            }
        }

        // Advance 1 month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Guarantee every folio starts with at least one buy transaction.
      if (!folioHasBuy) {
        const starterDate = new Date(startDate);
        const starterDateStr = starterDate.toISOString().split('T')[0];
        const starterAmount = isConservative ? 12000 : isAggressive ? 35000 : 20000;
        const starterUnits = starterAmount / currentNav;
        transactions.push({
          id: crypto.randomUUID(),
          schemeCode: scheme.code,
          fundName: scheme.name,
          category: scheme.category,
          date: starterDateStr,
          nav: currentNav,
          amount: starterAmount,
          units: starterUnits,
          type: TransactionType.BUY,
          nature: TransactionNature.LUMPSUM,
          clientId: client.id,
          arn: client.associatedArn,
          folioNumber
        });
        folioUnitsHeld += starterUnits;
      }

      if (folioUnitsHeld > 0.1) {
        clientHasActiveFolio = true;
      }
    }

    // Keep at least one active folio per client to avoid zero-value portfolios.
    if (!clientHasActiveFolio) {
      const fallbackScheme = availableSchemes[0] || SCHEMES[0];
      const fallbackNav = Math.max(1, fallbackScheme.baseNav);
      const fallbackAmount = isConservative ? 25000 : isAggressive ? 55000 : 35000;
      transactions.push({
        id: crypto.randomUUID(),
        schemeCode: fallbackScheme.code,
        fundName: fallbackScheme.name,
        category: fallbackScheme.category,
        date: new Date().toISOString().split('T')[0],
        nav: fallbackNav,
        amount: fallbackAmount,
        units: fallbackAmount / fallbackNav,
        type: TransactionType.BUY,
        nature: TransactionNature.LUMPSUM,
        clientId: client.id,
        arn: client.associatedArn,
        folioNumber: `${client.id.toUpperCase()}/${fallbackScheme.code}/F-BOOST`
      });
    }
  });

  // 4. Generate Goals
  clients.forEach(client => {
    const numGoals = Math.floor(Math.random() * 3) + 1; // 1-3 goals per client

    for (let g = 0; g < numGoals; g++) {
      const categories = ['EDUCATION', 'RETIREMENT', 'HOME', 'CHILD_MARRIAGE', 'VACATION', 'OTHER'];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const priorities = [1, 2, 3] as const;
      const priority = priorities[Math.floor(Math.random() * priorities.length)];

      // Target amounts based on category
      let baseAmount = 500000;
      if (category === 'RETIREMENT') baseAmount = 2000000;
      else if (category === 'HOME') baseAmount = 1500000;
      else if (category === 'CHILD_MARRIAGE') baseAmount = 1000000;

      const targetAmount = baseAmount + Math.floor(Math.random() * baseAmount * 0.5);
      const yearsToTarget = 3 + Math.floor(Math.random() * 7); // 3-10 years
      const targetDate = new Date();
      targetDate.setFullYear(targetDate.getFullYear() + yearsToTarget);

      goals.push({
        id: crypto.randomUUID(),
        clientId: client.id,
        name: `${category.toLowerCase().replace('_', ' ')} goal ${g + 1}`,
        targetAmount,
        targetDate: targetDate.toISOString().split('T')[0],
        category: category as any,
        priority,
        status: 'ON_TRACK'
      });
    }
  });

  return { clients, transactions, goals, families };
};

// --- STORAGE METHODS ---

export const getClients = (arnFilter?: string): Client[] => {
    const stored = localStorage.getItem(STORAGE_KEY_CLIENTS);
    let clients: Client[];

    if (stored) {
        clients = JSON.parse(stored);
    } else {
        const generated = generateMockData();
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(generated.clients));
        localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(generated.transactions));
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(generated.goals));
        localStorage.setItem(STORAGE_KEY_FAMILIES, JSON.stringify(generated.families));
        clients = generated.clients;
    }

    const families = getFamilies();
    if (families.length > 0) {
        const familyMap: Record<string, string> = {};
        families.forEach(f => f.clientIds.forEach(clientId => { familyMap[clientId] = f.id; }));
        clients = clients.map(c => ({ ...c, familyId: familyMap[c.id] }));
    }

    if (arnFilter) {
        return clients.filter(c => c.associatedArn === arnFilter);
    }
    return clients;
};

export const addClient = (client: Client): Client[] => {
    const clients = getClients();
    if (clients.some(c => c.pan === client.pan)) return clients; 
    const newClients = [...clients, client];
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(newClients));
    return newClients;
}

export const getTransactions = (filters: { clientId?: string, arn?: string } = {}): Transaction[] => {
  const stored = localStorage.getItem(STORAGE_KEY_TX);
  let transactions: Transaction[];

  if (stored) {
      transactions = JSON.parse(stored);
  } else {
      // Logic handled in getClients mostly, but if called first:
      const generated = generateMockData();
      localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(generated.clients));
      localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(generated.transactions));
      localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(generated.goals));
      localStorage.setItem(STORAGE_KEY_FAMILIES, JSON.stringify(generated.families));
      transactions = generated.transactions;
  }

  if (filters.clientId) {
      transactions = transactions.filter(t => t.clientId === filters.clientId);
  }
  if (filters.arn) {
      transactions = transactions.filter(t => t.arn === filters.arn);
  }

  return transactions;
};

export const saveTransaction = (transaction: Transaction): Transaction[] => {
  const transactions = getTransactions(); 
  const newTransactions = [...transactions, transaction];
  localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(newTransactions));
  return newTransactions;
};

export const saveBulkTransactions = (newTransactions: Transaction[]): Transaction[] => {
    const current = getTransactions();
    const updated = [...current, ...newTransactions];
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(updated));
    return updated;
}

export const deleteTransaction = (id: string): Transaction[] => {
    const transactions = getTransactions();
    const newTransactions = transactions.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(newTransactions));
    return newTransactions;
}

export const deleteAllData = () => {
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_FAMILIES, JSON.stringify([]));
};

// --- GOAL MANAGEMENT ---

export const getGoals = (clientId?: string): Goal[] => {
    const stored = localStorage.getItem(STORAGE_KEY_GOALS);
    const goals: Goal[] = stored ? JSON.parse(stored) : [];
    return clientId ? goals.filter(g => g.clientId === clientId) : goals;
};

export const addGoal = (goal: Goal): Goal[] => {
    const goals = getGoals();
    const newGoals = [...goals, goal];
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(newGoals));
    return newGoals;
};

export const updateGoal = (id: string, updates: Partial<Goal>): Goal[] => {
    const goals = getGoals();
    const newGoals = goals.map(g => g.id === id ? { ...g, ...updates } : g);
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(newGoals));
    return newGoals;
};

export const deleteGoal = (id: string): Goal[] => {
    const goals = getGoals();
    const newGoals = goals.filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(newGoals));
    return newGoals;
};

export const calculateGoalProgress = (goal: Goal, currentHoldings: Holding[]): {
    progress: number;
    projectedCompletion: string;
    gap: number;
} => {
    // Calculate current amount from linked folios or all holdings
    const relevantHoldings = goal.linkedFolios
        ? currentHoldings.filter(h => goal.linkedFolios!.includes(h.folioNumber))
        : currentHoldings;

    const currentAmount = relevantHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const progress = (currentAmount / goal.targetAmount) * 100;
    const gap = goal.targetAmount - currentAmount;

    // Simple projection: assume current XIRR continues
    const avgXirr = relevantHoldings.length > 0
        ? relevantHoldings.reduce((sum, h) => sum + h.xirr, 0) / relevantHoldings.length
        : 0.12; // Default 12% annual return

    const monthsToTarget = currentAmount <= 0
        ? Number.POSITIVE_INFINITY
        : gap > 0
        ? Math.log(goal.targetAmount / currentAmount) / Math.log(1 + avgXirr / 12)
        : 0;

    const projectedDate = new Date();
    if (isFinite(monthsToTarget) && monthsToTarget > 0) {
        projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(monthsToTarget));
    }

    return {
        progress: Math.min(progress, 100),
        projectedCompletion: projectedDate.toISOString().split('T')[0],
        gap: Math.max(gap, 0)
    };
};

// --- FAMILY MANAGEMENT ---

export const getFamilies = (arnFilter?: string): Family[] => {
    const stored = localStorage.getItem(STORAGE_KEY_FAMILIES);
    const families: Family[] = stored ? JSON.parse(stored) : [];
    return arnFilter ? families.filter(f => f.arnFilter === arnFilter) : families;
};

export const addFamily = (family: Family): Family[] => {
    const families = getFamilies();
    const newFamilies = [...families, family];
    localStorage.setItem(STORAGE_KEY_FAMILIES, JSON.stringify(newFamilies));
    const clients = getClients();
    const updatedClients = clients.map(c => family.clientIds.includes(c.id) ? { ...c, familyId: family.id } : c);
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
    return newFamilies;
};

export const updateFamily = (id: string, updates: Partial<Family>): Family[] => {
    const families = getFamilies();
    const newFamilies = families.map(f => f.id === id ? { ...f, ...updates } : f);
    localStorage.setItem(STORAGE_KEY_FAMILIES, JSON.stringify(newFamilies));
    const clients = getClients();
    const updatedFamily = newFamilies.find(f => f.id === id);
    const updatedClients = clients.map(c => {
        if (c.familyId === id) {
            return { ...c, familyId: undefined };
        }
        return c;
    }).map(c => {
        if (updatedFamily && updatedFamily.clientIds.includes(c.id)) {
            return { ...c, familyId: id };
        }
        return c;
    });
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
    return newFamilies;
};

export const deleteFamily = (id: string): Family[] => {
    const families = getFamilies();
    const newFamilies = families.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY_FAMILIES, JSON.stringify(newFamilies));
    const clients = getClients();
    const updatedClients = clients.map(c => c.familyId === id ? { ...c, familyId: undefined } : c);
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
    return newFamilies;
};

export const calculateFamilyPortfolio = (familyId: string): {
    holdings: Holding[];
    summary: PortfolioSummary;
    clientBreakdown: { clientId: string; contribution: number }[];
} => {
    const family = getFamilies().find(f => f.id === familyId);
    if (!family) {
        return { holdings: [], summary: { totalInvested: 0, currentValue: 0, totalGain: 0, totalGainPercentage: 0, xirr: 0 }, clientBreakdown: [] };
    }

    const allTransactions = getTransactions();
    const familyTransactions = allTransactions.filter(t => family.clientIds.includes(t.clientId));
    const holdings = calculateHoldings(familyTransactions);
    const summary = getPortfolioSummary(holdings);

    const clientBreakdown = family.clientIds.map(clientId => {
        const clientHoldings = calculateHoldings(allTransactions.filter(t => t.clientId === clientId));
        const clientValue = clientHoldings.reduce((sum, h) => sum + h.currentValue, 0);
        return { clientId, contribution: clientValue };
    });

    return { holdings, summary, clientBreakdown };
};

export const calculateHoldings = (transactions: Transaction[], livePrices: Record<string, number> = {}): Holding[] => {
  const holdingsMap: Record<string, Holding> = {};
  const cashFlowsMap: Record<string, { amount: number, date: Date }[]> = {};

  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  transactions.forEach((t) => {
    const key = `${t.folioNumber}_${t.schemeCode || t.fundName}`;

    if (!holdingsMap[key]) {
      holdingsMap[key] = {
        schemeCode: t.schemeCode,
        fundName: t.fundName,
        category: t.category,
        folioNumber: t.folioNumber,
        totalUnits: 0,
        averageNav: 0,
        investedAmount: 0,
        currentNav: t.nav,
        currentValue: 0,
        absoluteReturn: 0,
        absoluteReturnPercentage: 0,
        xirr: 0,
        lastTxDate: t.date // Initialize lastTxDate
      };
      cashFlowsMap[key] = [];
    }

    const h = holdingsMap[key];
    
    // Always update currentNav to the latest transaction's NAV to track "Book NAV"
    h.currentNav = t.nav;
    h.lastTxDate = t.date;

    if (t.type === TransactionType.BUY) {
      const newTotalUnits = h.totalUnits + t.units;
      const newInvestedAmount = h.investedAmount + t.amount;
      h.averageNav = newInvestedAmount / newTotalUnits;
      h.totalUnits = newTotalUnits;
      h.investedAmount = newInvestedAmount;
      
      // XIRR Outflow (Investment)
      cashFlowsMap[key].push({ amount: -t.amount, date: new Date(t.date) });
    } else {
      // SELL / SWITCH OUT / STP OUT
      const sellRatio = t.units / h.totalUnits;
      // When selling, invested amount reduces proportionally to units sold
      // This is crucial for keeping Average NAV constant on partial withdrawal
      h.totalUnits -= t.units;
      h.investedAmount -= (h.investedAmount * sellRatio);
      
      // XIRR Inflow (Redemption)
      cashFlowsMap[key].push({ amount: t.amount, date: new Date(t.date) });
    }
  });

  return Object.values(holdingsMap)
    .filter(h => h.totalUnits > 0.001) 
    .map(h => {
      const schemeKey = h.schemeCode || h.fundName;
      let marketNav = h.currentNav; // Default to last transaction NAV

      // Check if we have a valid live price
      if (livePrices[schemeKey] && livePrices[schemeKey] > 0) {
          const livePrice = livePrices[schemeKey];
          const lastTxNav = h.currentNav;
          
          // Heuristic: If Live Price deviates > 50% from Last Tx NAV, and last Tx was recent,
          // assume Live Price is errant or mismatched with Mock Data, and stick to Last Tx NAV.
          let useLivePrice = true;
          
          if (h.lastTxDate) {
              const daysSinceLastTx = (new Date().getTime() - new Date(h.lastTxDate).getTime()) / (1000 * 3600 * 24);
              if (daysSinceLastTx < 365) {
                  const deviation = Math.abs(livePrice - lastTxNav) / lastTxNav;
                  if (deviation > 0.5) {
                      useLivePrice = false;
                  }
              }
          }

          if (useLivePrice) {
              marketNav = livePrice;
          }
      }
      
      const currentValue = h.totalUnits * marketNav;
      const gain = currentValue - h.investedAmount;

      // Calculate XIRR
      // Add current value as a "positive cash flow" at today's date (Unrealized gain realization)
      const finalCashFlows = [
          ...cashFlowsMap[`${h.folioNumber}_${schemeKey}`],
          { amount: currentValue, date: new Date() }
      ];
      const xirr = calculateXIRR(finalCashFlows);
      
      return {
        ...h,
        currentNav: marketNav,
        currentValue,
        absoluteReturn: gain,
        absoluteReturnPercentage: h.investedAmount > 0 ? (gain / h.investedAmount) * 100 : 0,
        xirr
      };
    });
};

export const getPortfolioSummary = (holdings: Holding[]): PortfolioSummary => {
  const totalInvested = holdings.reduce((sum, h) => sum + h.investedAmount, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalGain = currentValue - totalInvested;
  
  // Weighted Average XIRR for Portfolio Summary
  let weightedXirr = 0;
  if (currentValue > 0) {
      weightedXirr = holdings.reduce((sum, h) => sum + (h.xirr * (h.currentValue / currentValue)), 0);
  }
  
  return {
    totalInvested,
    currentValue,
    totalGain,
    totalGainPercentage: totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0,
    xirr: weightedXirr
  };
};
