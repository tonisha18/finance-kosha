export interface GuardrailCheckResult {
  blocked: boolean;
  classification: "securities_advice" | "crypto_advice" | "fd_comparison" | "none";
  reason?: string;
  safeRedirect: string;
}

export const SAFE_REDIRECT_MESSAGE =
  "I'm designed to help you optimize your cash flow, understand your spending, manage subscriptions, and plan savings goals. I don't give specific investment advice, stock picks, crypto tips, or mutual fund recommendations. Would you like to review your monthly surplus or optimize your budget instead?";

// List of stock, crypto, mutual fund, and ticker patterns
const SECURITIES_PATTERNS: RegExp[] = [
  /\b(?:buy|sell|invest in|trade|pick|recommend)\s+(?:\d+\s+)?(?:stocks?|shares?|equit(?:y|ies)|mutual\s*funds?|etfs?|crypto(?:currency)?|bitcoins?|btc|eth(?:ereum)?|doge|solana|nifty|sensex)\b/i,
  /\b(?:trade\s+options?|f&o|futures\s+and\s+options|derivatives?)\b/i,
  /\b(?:options?|f&o|futures?)\s+in\s+(?:nifty|sensex|[a-z0-9]+)\b/i,
  /\b(?:is\s+)?(?:bitcoin|btc|eth|crypto|solana|[a-z0-9]+)\s+(?:a\s+)?(?:good|bad|worth)\s+(?:buy|investment)\b/i,
  /\b(?:best|top|recommended|good)\s+(?:stocks?|shares?|mutual\s*funds?|sip\s*plans?|small\s*cap|mid\s*cap|large\s*cap|crypto|coins?)\b/i,
  /\b(?:small\s*cap|mid\s*cap|large\s*cap)\s+(?:mutual\s*funds?|stocks?|funds?)\b/i,
  /\bshould\s+i\s+(?:buy|sell|invest in|put money in)\s+(?:stocks?|shares?|crypto|bitcoin|eth|nifty|sensex|[a-z0-9]+)\b/i,
  /\bcompare\s+(?:fd|fixed\s*deposit)\s*rates?\b/i,
  /\b(?:fd|fixed\s*deposit)\s+(?:interest\s*rates?|rate\s*comparison)\b/i,
  /\bwhich\s+stock\s+should\s+i\s+buy\b/i,
  /\bwhich\s+.*?(?:fund|stock|mutual\s*fund|etf|share|crypto)\b/i,
  /\b(?:target\s*price|price\s*prediction)\s+for\b/i,
  /\b(?:hdfc|reliance|tata\s*motors|infosys|tcs|wipro|zomato|paytm)\s+(?:share|stock|target)\b/i,
  /\b(?:multibagger|penny\s*stocks?)\b/i,
];

// Legitimate exceptions: general education that should NOT be blocked
const ALLOWED_EDUCATIONAL_PATTERNS: RegExp[] = [
  /\bwhat\s+is\s+(?:an?\s+)?emergency\s*fund\b/i,
  /\bhow\s+much\s+(?:did\s+i\s+spend|have\s+i\s+spent)\b/i,
  /\bwhat\s+is\s+sip\b/i,
  /\bexplain\s+sip\s+vs\s+lump\s*sum\b/i,
  /\bhow\s+does\s+compounding\s+work\b/i,
  /\bwhat\s+are\s+my\s+budgets?\b/i,
  /\bhow\s+much\s+can\s+i\s+save\b/i,
];

/**
 * Deterministic pre-check on user input.
 */
export function checkInputGuardrail(input: string): GuardrailCheckResult {
  const normalized = input.trim().toLowerCase();

  // Check if it's an explicit educational question first
  for (const allowed of ALLOWED_EDUCATIONAL_PATTERNS) {
    if (allowed.test(normalized)) {
      return { blocked: false, classification: "none", safeRedirect: "" };
    }
  }

  for (const pattern of SECURITIES_PATTERNS) {
    if (pattern.test(normalized)) {
      let classification: "securities_advice" | "crypto_advice" | "fd_comparison" = "securities_advice";
      if (/crypto|bitcoin|btc|eth|doge|solana/i.test(normalized)) {
        classification = "crypto_advice";
      } else if (/fd|fixed\s*deposit/i.test(normalized)) {
        classification = "fd_comparison";
      }

      return {
        blocked: true,
        classification,
        reason: "Request for specific securities, trading, or investment product advice",
        safeRedirect: SAFE_REDIRECT_MESSAGE,
      };
    }
  }

  return { blocked: false, classification: "none", safeRedirect: "" };
}

/**
 * Deterministic post-check on LLM output to prevent leakage of investment recommendations.
 */
export function checkOutputGuardrail(output: string): { blocked: boolean; cleanOutput: string } {
  const normalized = output.toLowerCase();

  const PROHIBITED_OUTPUT_PATTERNS: RegExp[] = [
    /\byou\s+should\s+(?:buy|sell|invest\s+in)\s+[a-z0-9]+/i,
    /\bi\s+recommend\s+buying\s+[a-z0-9]+/i,
    /\b(?:buy|purchase)\s+(?:shares\s+of|stocks\s+in)\b/i,
    /\bguaranteed\s+returns\s+of\b/i,
  ];

  for (const p of PROHIBITED_OUTPUT_PATTERNS) {
    if (p.test(normalized)) {
      return {
        blocked: true,
        cleanOutput: SAFE_REDIRECT_MESSAGE,
      };
    }
  }

  return {
    blocked: false,
    cleanOutput: output,
  };
}
