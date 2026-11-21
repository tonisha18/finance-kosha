import { CategoryName } from "./categories";
import { SimulationAdjustment, GoalSimulationOverride } from "./simulate";

export interface ParsedScenario {
  success: boolean;
  adjustment: SimulationAdjustment;
  explanation: string;
  matchedCategory?: CategoryName;
}

const CATEGORY_SYNONYMS: Record<string, CategoryName> = {
  "dining out": "Food & Dining",
  dining: "Food & Dining",
  "eating out": "Food & Dining",
  food: "Food & Dining",
  restaurants: "Food & Dining",
  swiggy: "Food & Dining",
  zomato: "Food & Dining",

  groceries: "Groceries",
  grocery: "Groceries",
  blinkit: "Groceries",
  zepto: "Groceries",
  instamart: "Groceries",

  rent: "Rent & Housing",
  housing: "Rent & Housing",
  maintenance: "Rent & Housing",

  utilities: "Utilities",
  electricity: "Utilities",
  wifi: "Utilities",
  internet: "Utilities",
  "water bill": "Utilities",

  transport: "Transport",
  travel: "Transport",
  commute: "Transport",
  cabs: "Transport",
  uber: "Transport",
  fuel: "Transport",
  petrol: "Transport",

  shopping: "Shopping",
  clothes: "Shopping",
  amazon: "Shopping",

  subscriptions: "Entertainment & Subscriptions",
  entertainment: "Entertainment & Subscriptions",
  netflix: "Entertainment & Subscriptions",
  ott: "Entertainment & Subscriptions",

  healthcare: "Healthcare",
  medical: "Healthcare",
  medicine: "Healthcare",
  doctor: "Healthcare",
};

/**
 * Robust financial amount parser supporting Indian units (lakhs, cr, k) and commas.
 */
export function parseAmount(str: string): number | null {
  if (!str) return null;
  const clean = str.replace(/₹|rs\.?/gi, "").trim().toLowerCase();

  // Crore: "1.5 crore", "2 cr", "1.5cr"
  const crMatch = clean.match(/^([\d,]+(?:\.\d+)?)\s*(?:crores?|cr)\b/i);
  if (crMatch) {
    const val = parseFloat(crMatch[1].replace(/,/g, ""));
    return isNaN(val) ? null : Math.round(val * 10000000);
  }

  // Lakh: "15 lakhs", "15 lac", "15l", "1.5 lakh", "10lakhs"
  const lakhMatch = clean.match(/^([\d,]+(?:\.\d+)?)\s*(?:lakhs?|lacs?|lac|l)\b/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1].replace(/,/g, ""));
    return isNaN(val) ? null : Math.round(val * 100000);
  }

  // Thousand / K: "25k", "25 thousand"
  const kMatch = clean.match(/^([\d,]+(?:\.\d+)?)\s*(?:k|thousand)\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1].replace(/,/g, ""));
    return isNaN(val) ? null : Math.round(val * 1000);
  }

  // Standard integer or float: "15,00,000", "20000"
  const numMatch = clean.match(/^([\d,]+(?:\.\d+)?)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1].replace(/,/g, ""));
    return isNaN(val) ? null : Math.round(val);
  }

  return null;
}

/**
 * Deterministic natural language parser for what-if scenarios and lifetime goals.
 */
export function parseNaturalLanguageScenario(input: string): ParsedScenario {
  const text = input.trim().toLowerCase();

  // 1. LIFETIME GOAL: Car / Vehicle Purchase Simulation
  // e.g. "buy a car for 15 lakhs in 3 years", "can i afford a car of 12L", "buy car", "plan for car 10 lakhs"
  const isCarPhrase = /\b(?:car|vehicle|automobile|bike|suv|sedan)\b/i.test(text);
  if (isCarPhrase && !text.includes("fuel") && !text.includes("petrol") && !text.includes("uber") && !text.includes("cabs")) {
    const amtMatch =
      text.match(/(?:for|of|worth|costing|budget(?:\s+of)?|target(?:\s+of)?)\s+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i) ||
      text.match(/(?:rs\.?|₹)\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i);

    const targetAmount = amtMatch ? parseAmount(amtMatch[1]) || 1500000 : 1500000;

    const yrMatch = text.match(/in\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
    const moMatch = text.match(/in\s+(\d+)\s*(?:months?|mos?)/i);
    let targetMonths = 36;
    if (yrMatch) targetMonths = Math.max(6, Math.round(parseFloat(yrMatch[1]) * 12));
    else if (moMatch) targetMonths = Math.max(6, parseInt(moMatch[1]));

    const monthlyMatch = text.match(/(?:save|put\s*aside|allocate)\s+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:k|thousand|lakhs?|l)?)\s*(?:per\s+month|monthly|\/mo)/i);
    const monthlyAllocation = monthlyMatch ? parseAmount(monthlyMatch[1]) || undefined : undefined;

    const dpMatch = text.match(/(?:down\s*payment|upfront|initial)\s*(?:of)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i);
    const downPayment = dpMatch ? parseAmount(dpMatch[1]) || undefined : undefined;

    const remaining = Math.max(0, targetAmount - (downPayment || 0));
    const reqMonthly = Math.ceil(remaining / targetMonths);

    return {
      success: true,
      adjustment: {
        goalOverride: {
          goalId: "goal_demo_car",
          name: "🚗 Buy a Car / Vehicle",
          targetAmount,
          targetMonths,
          monthlyAllocation,
          downPayment,
        },
      },
      explanation: `Simulating milestone: Buy a Car (₹${targetAmount.toLocaleString("en-IN")}) in ${targetMonths} months. Required run-rate: ₹${reqMonthly.toLocaleString("en-IN")}/mo.`,
    };
  }

  // 2. LIFETIME GOAL: Real Estate / House Purchase Simulation
  // e.g. "buy a house for 50 lakhs in 5 years", "home down payment of 30L"
  const isHousePhrase = /\b(?:house|home|flat|apartment|property|real\s*estate)\b/i.test(text);
  if (isHousePhrase && !text.includes("rent") && !text.includes("maintenance")) {
    const amtMatch =
      text.match(/(?:for|of|worth|costing|budget(?:\s+of)?|target(?:\s+of)?)\s+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i) ||
      text.match(/(?:rs\.?|₹)\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i);

    const targetAmount = amtMatch ? parseAmount(amtMatch[1]) || 3000000 : 3000000;

    const yrMatch = text.match(/in\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
    const moMatch = text.match(/in\s+(\d+)\s*(?:months?|mos?)/i);
    let targetMonths = 60;
    if (yrMatch) targetMonths = Math.max(6, Math.round(parseFloat(yrMatch[1]) * 12));
    else if (moMatch) targetMonths = Math.max(6, parseInt(moMatch[1]));

    const reqMonthly = Math.ceil(targetAmount / targetMonths);

    return {
      success: true,
      adjustment: {
        goalOverride: {
          goalId: "goal_demo_home",
          name: "🏠 Real Estate / Home Down-Payment",
          targetAmount,
          targetMonths,
        },
      },
      explanation: `Simulating milestone: Real Estate Down-Payment (₹${targetAmount.toLocaleString("en-IN")}) in ${targetMonths} months. Required run-rate: ₹${reqMonthly.toLocaleString("en-IN")}/mo.`,
    };
  }

  // 3. Dedicated Monthly Savings Allocation: "save 25000 per month", "invest 20000 monthly"
  const monthlySavingsMatch = text.match(
    /(?:save|invest|put\s+aside)\s+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)\s*(?:per\s+month|monthly|\/mo|every\s+month)/i
  );
  if (monthlySavingsMatch) {
    const amt = parseAmount(monthlySavingsMatch[1]);
    if (amt) {
      return {
        success: true,
        adjustment: { monthlySavingsAllocation: amt },
        explanation: `Simulating dedicating ₹${amt.toLocaleString("en-IN")}/month towards capital milestone goals.`,
      };
    }
  }

  // 4. Category absolute change: "spend 5000 more on travel", "4000 extra on transport"
  const absChangeMatch = text.match(
    /(?:spend\s+)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:k|thousand|lakhs?|l)?)\s+(?:more|extra)\s+on\s+([a-z\s&]+)/i
  );
  if (absChangeMatch) {
    const amount = parseAmount(absChangeMatch[1]);
    const rawCat = absChangeMatch[2].trim();
    const matchedCategory = findCategory(rawCat);

    if (amount !== null && matchedCategory) {
      return {
        success: true,
        adjustment: { categoryAmountChanges: { [matchedCategory]: amount } },
        explanation: `Simulating an additional ₹${amount.toLocaleString("en-IN")} on ${matchedCategory}.`,
        matchedCategory,
      };
    }
  }

  // 5. One-time expense: "one-time expense of 20000", "spend 50000 on laptop", "buy laptop for 1.2 lakhs"
  const oneTimeMatch =
    text.match(/(?:one[\s-]time\s+expense|one[\s-]off)\s+(?:of\s+)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i) ||
    text.match(/spend\s+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)\s+on\s+(?!.*\bmore\b)([a-z\s]+)/i) ||
    text.match(/buy\s+[a-z\s]+\s+for\s+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i);

  if (oneTimeMatch) {
    const amount = parseAmount(oneTimeMatch[1]);
    if (amount !== null) {
      return {
        success: true,
        adjustment: { oneTimeExpense: amount },
        explanation: `Simulating a one-time expense of ₹${amount.toLocaleString("en-IN")}.`,
      };
    }
  }

  // 6. Income increase: "what if income increases by 10000", "salary hike of 25000"
  const incomeIncMatch = text.match(
    /(?:income|salary|earnings?)\s+(?:increases?|goes\s+up|hike|bonus)\s+(?:by|of)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i
  );
  if (incomeIncMatch) {
    const amount = parseAmount(incomeIncMatch[1]);
    if (amount !== null) {
      return {
        success: true,
        adjustment: { incomeChange: amount },
        explanation: `Simulating an income increase of ₹${amount.toLocaleString("en-IN")}/month.`,
      };
    }
  }

  // 7. Income decrease: "income drops by 12000"
  const incomeDecMatch = text.match(
    /(?:income|salary|earnings?)\s+(?:drops?|decreases?|falls?|cut)\s+(?:by\s+)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i
  );
  if (incomeDecMatch) {
    const amount = parseAmount(incomeDecMatch[1]);
    if (amount !== null) {
      return {
        success: true,
        adjustment: { incomeChange: -amount },
        explanation: `Simulating an income drop of ₹${amount.toLocaleString("en-IN")}/month.`,
      };
    }
  }

  // 8. Rent / Fixed costs change: "what if my rent goes up by 5000"
  const rentMatch = text.match(
    /(?:rent|fixed\s*costs?)\s+(?:goes\s+up|increases?)\s+(?:by\s+)?(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?)/i
  );
  if (rentMatch) {
    const amount = parseAmount(rentMatch[1]);
    if (amount !== null) {
      return {
        success: true,
        adjustment: { fixedCostChange: amount },
        explanation: `Simulating a rent/fixed-cost increase of ₹${amount.toLocaleString("en-IN")}/month.`,
      };
    }
  }

  // 9. Category percentage change: "what if i cut dining out by 30%", "reduce shopping 20%"
  const pctCutMatch = text.match(
    /(?:cut|reduce|slash|decrease|trim)\s+([a-z\s&]+?)\s+(?:by\s+)?(\d+)%/i
  );
  if (pctCutMatch) {
    const rawCat = pctCutMatch[1].trim();
    const pct = Number(pctCutMatch[2]);
    const matchedCategory = findCategory(rawCat);

    if (matchedCategory) {
      return {
        success: true,
        adjustment: { categoryPctChanges: { [matchedCategory]: -pct } },
        explanation: `Simulating a ${pct}% reduction in ${matchedCategory}.`,
        matchedCategory,
      };
    }
  }

  // 10. Category percentage increase: "dining out increases by 25%"
  const pctIncMatch = text.match(
    /([a-z\s&]+?)\s+(?:increases?|goes\s+up|grows?)\s+(?:by\s+)?(\d+)%/i
  );
  if (pctIncMatch) {
    const rawCat = pctIncMatch[1].trim();
    const pct = Number(pctIncMatch[2]);
    const matchedCategory = findCategory(rawCat);

    if (matchedCategory) {
      return {
        success: true,
        adjustment: { categoryPctChanges: { [matchedCategory]: pct } },
        explanation: `Simulating a ${pct}% increase in ${matchedCategory}.`,
        matchedCategory,
      };
    }
  }

  return {
    success: false,
    adjustment: {},
    explanation:
      "Could not parse scenario phrasing. Try: 'buy a car for 15 lakhs in 3 years', 'cut dining out by 30%', 'rent goes up by 5000', or 'save 25000 per month'.",
  };
}

function findCategory(term: string): CategoryName | undefined {
  const clean = term.toLowerCase().trim();
  if (CATEGORY_SYNONYMS[clean]) {
    return CATEGORY_SYNONYMS[clean];
  }

  for (const [key, cat] of Object.entries(CATEGORY_SYNONYMS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return cat;
    }
  }

  return undefined;
}
