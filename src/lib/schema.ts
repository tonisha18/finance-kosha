import { z } from "zod";

export const CategoryEnum = z.enum([
  "Food & Dining",
  "Groceries",
  "Rent & Housing",
  "Utilities",
  "Transport",
  "Shopping",
  "Entertainment & Subscriptions",
  "Healthcare",
  "Income/Salary",
  "Transfers",
]);

export const TransactionTypeEnum = z.enum(["debit", "credit"]);

export const CategorySourceEnum = z.enum(["rule", "dictionary", "llm", "user"]);

export const NormalizedTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  merchant: z.string().min(1, "Merchant cannot be empty"),
  raw_description_redacted: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  type: TransactionTypeEnum,
  category: CategoryEnum,
  category_source: CategorySourceEnum,
  confidence: z.number().min(0).max(1).default(1.0),
  needs_review: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
});

export type NormalizedTransaction = z.infer<typeof NormalizedTransactionSchema>;

export const LLMExtractedTransactionSchema = z.object({
  date: z.string(),
  clean_merchant: z.string(),
  amount: z.number().positive(),
  type: TransactionTypeEnum,
  category: CategoryEnum,
  is_recurring: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.9),
});

export const LLMExtractionResponseSchema = z.object({
  transactions: z.array(LLMExtractedTransactionSchema),
});

export const IngestionSummarySchema = z.object({
  transactions_found: z.number(),
  inserted: z.number(),
  duplicates_skipped: z.number(),
  rows_dropped: z.number(),
  needs_review: z.number(),
  subscriptions_detected: z.number(),
});

export type IngestionSummary = z.infer<typeof IngestionSummarySchema>;
