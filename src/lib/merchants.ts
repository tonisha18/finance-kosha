import { CategoryName } from "./categories";

export interface MerchantRule {
  keyword: string;
  category: CategoryName;
}

// Built-in dictionary of ~80 popular Indian merchants and keywords
export const MERCHANT_DICTIONARY: MerchantRule[] = [
  // Food & Dining
  { keyword: "swiggy", category: "Food & Dining" },
  { keyword: "zomato", category: "Food & Dining" },
  { keyword: "mcdonalds", category: "Food & Dining" },
  { keyword: "dominos", category: "Food & Dining" },
  { keyword: "kfc", category: "Food & Dining" },
  { keyword: "starbucks", category: "Food & Dining" },
  { keyword: "chaayos", category: "Food & Dining" },
  { keyword: "burger king", category: "Food & Dining" },
  { keyword: "pizza hut", category: "Food & Dining" },
  { keyword: "haldiram", category: "Food & Dining" },
  { keyword: "subway", category: "Food & Dining" },
  { keyword: "barbeque nation", category: "Food & Dining" },
  { keyword: "eatsure", category: "Food & Dining" },

  // Groceries
  { keyword: "blinkit", category: "Groceries" },
  { keyword: "zepto", category: "Groceries" },
  { keyword: "instamart", category: "Groceries" },
  { keyword: "bigbasket", category: "Groceries" },
  { keyword: "dmart", category: "Groceries" },
  { keyword: "bb daily", category: "Groceries" },
  { keyword: "country delight", category: "Groceries" },
  { keyword: "nature basket", category: "Groceries" },
  { keyword: "more retail", category: "Groceries" },
  { keyword: "spencer", category: "Groceries" },
  { keyword: "reliance fresh", category: "Groceries" },
  { keyword: "reliance smart", category: "Groceries" },

  // Transport
  { keyword: "uber", category: "Transport" },
  { keyword: "ola", category: "Transport" },
  { keyword: "rapido", category: "Transport" },
  { keyword: "irctc", category: "Transport" },
  { keyword: "makemytrip", category: "Transport" },
  { keyword: "goibibo", category: "Transport" },
  { keyword: "indigo", category: "Transport" },
  { keyword: "air india", category: "Transport" },
  { keyword: "redbus", category: "Transport" },
  { keyword: "fastag", category: "Transport" },
  { keyword: "hpcl", category: "Transport" },
  { keyword: "bpcl", category: "Transport" },
  { keyword: "ioc", category: "Transport" },
  { keyword: "metro", category: "Transport" },

  // Utilities
  { keyword: "airtel", category: "Utilities" },
  { keyword: "jio", category: "Utilities" },
  { keyword: "vodafone", category: "Utilities" },
  { keyword: "vi prepaid", category: "Utilities" },
  { keyword: "bescom", category: "Utilities" },
  { keyword: "tneb", category: "Utilities" },
  { keyword: "mahavitaran", category: "Utilities" },
  { keyword: "bses", category: "Utilities" },
  { keyword: "act fibernet", category: "Utilities" },
  { keyword: "tatapower", category: "Utilities" },
  { keyword: "tata sky", category: "Utilities" },
  { keyword: "tataplay", category: "Utilities" },
  { keyword: "indane", category: "Utilities" },
  { keyword: "bharat gas", category: "Utilities" },

  // Entertainment & Subscriptions
  { keyword: "netflix", category: "Entertainment & Subscriptions" },
  { keyword: "spotify", category: "Entertainment & Subscriptions" },
  { keyword: "hotstar", category: "Entertainment & Subscriptions" },
  { keyword: "prime video", category: "Entertainment & Subscriptions" },
  { keyword: "amazon prime", category: "Entertainment & Subscriptions" },
  { keyword: "youtube premium", category: "Entertainment & Subscriptions" },
  { keyword: "apple.com/bill", category: "Entertainment & Subscriptions" },
  { keyword: "google play", category: "Entertainment & Subscriptions" },
  { keyword: "bookmyshow", category: "Entertainment & Subscriptions" },
  { keyword: "pvr", category: "Entertainment & Subscriptions" },
  { keyword: "inox", category: "Entertainment & Subscriptions" },
  { keyword: "sony liv", category: "Entertainment & Subscriptions" },
  { keyword: "zee5", category: "Entertainment & Subscriptions" },

  // Shopping
  { keyword: "amazon", category: "Shopping" },
  { keyword: "flipkart", category: "Shopping" },
  { keyword: "myntra", category: "Shopping" },
  { keyword: "ajio", category: "Shopping" },
  { keyword: "nykaa", category: "Shopping" },
  { keyword: "tata cliq", category: "Shopping" },
  { keyword: "zara", category: "Shopping" },
  { keyword: "h&m", category: "Shopping" },
  { keyword: "decathlon", category: "Shopping" },
  { keyword: "croma", category: "Shopping" },
  { keyword: "reliance digital", category: "Shopping" },
  { keyword: "ikea", category: "Shopping" },

  // Healthcare
  { keyword: "apollo", category: "Healthcare" },
  { keyword: "pharmeasy", category: "Healthcare" },
  { keyword: "1mg", category: "Healthcare" },
  { keyword: "tata 1mg", category: "Healthcare" },
  { keyword: "netmeds", category: "Healthcare" },
  { keyword: "medplus", category: "Healthcare" },
  { keyword: "max healthcare", category: "Healthcare" },
  { keyword: "fortis", category: "Healthcare" },
  { keyword: "practo", category: "Healthcare" },
  { keyword: "dr lal", category: "Healthcare" },

  // Rent & Housing
  { keyword: "nobroker", category: "Rent & Housing" },
  { keyword: "housing.com", category: "Rent & Housing" },
  { keyword: "mygate", category: "Rent & Housing" },
  { keyword: "urban company", category: "Rent & Housing" },
  { keyword: "nestaway", category: "Rent & Housing" },

  // Income / Salary
  { keyword: "salary", category: "Income/Salary" },
  { keyword: "payroll", category: "Income/Salary" },
  { keyword: "tcs", category: "Income/Salary" },
  { keyword: "infosys", category: "Income/Salary" },
  { keyword: "wipro", category: "Income/Salary" },
  { keyword: "accenture", category: "Income/Salary" },
  { keyword: "interest credited", category: "Income/Salary" },
  { keyword: "dividend", category: "Income/Salary" },

  // Transfers
  { keyword: "upi/cr", category: "Transfers" },
  { keyword: "upi/dr", category: "Transfers" },
  { keyword: "neft", category: "Transfers" },
  { keyword: "rtgs", category: "Transfers" },
  { keyword: "imps", category: "Transfers" },
  { keyword: "atm wdl", category: "Transfers" },
  { keyword: "cash deposit", category: "Transfers" },
];

export function lookupMerchantDictionary(description: string): CategoryName | null {
  const lower = description.toLowerCase();
  for (const item of MERCHANT_DICTIONARY) {
    if (lower.includes(item.keyword)) {
      return item.category;
    }
  }
  return null;
}
