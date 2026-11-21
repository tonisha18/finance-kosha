import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { redactPII } from "@/lib/redact";
import { parseCSV, parseXLSX, ParsedRawRow, normalizeDate, extractMerchant } from "@/lib/parsers/csv-xlsx";
import { parseSMSBatch } from "@/lib/parsers/sms";
import { extractTextFromPDF } from "@/lib/parsers/pdf";
import { lookupMerchantDictionary } from "@/lib/merchants";
import { computeDedupeHash } from "@/lib/dedupe";
import { detectRecurringSubscriptions } from "@/lib/recurring";
import { runPostImportJobs } from "@/lib/post-import";
import { generateJson } from "@/lib/llm";
import { z } from "zod";
import { CategoryName, ALL_CATEGORIES } from "@/lib/categories";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const LLMBatchCategorizationSchema = z.object({
  classifications: z.array(
    z.object({
      merchant: z.string(),
      category: z.enum([
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
      ]),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const LLMPDFTransactionsSchema = z.object({
  transactions: z.array(
    z.object({
      date: z.string(),
      clean_merchant: z.string().default("Transaction"),
      amount: z.union([z.number(), z.string()]).transform((val) => {
        if (typeof val === "number") return Math.abs(val);
        const cleaned = String(val).replace(/[^0-9.]/g, "");
        return parseFloat(cleaned) || 0;
      }),
      type: z.string().transform((val) => {
        const lower = String(val).toLowerCase().trim();
        return lower.includes("cr") || lower.includes("credit") ? "credit" : "debit";
      }),
      category: z.string().optional(),
      is_recurring: z.boolean().default(false),
      confidence: z.number().default(0.85),
    })
  ),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const smsText = formData.get("sms") as string | null;
    const pdfPassword = (formData.get("pdf_password") as string | null) || undefined;

    let source: "pdf" | "xlsx" | "csv" | "sms" = "csv";
    let fileName = "unknown";
    let rawTransactions: ParsedRawRow[] = [];
    let rowsDropped = 0;

    if (smsText && smsText.trim().length > 0) {
      source = "sms";
      fileName = "sms_paste.txt";
      const scrubbed = redactPII(smsText);
      const parsedSms = parseSMSBatch(scrubbed);
      rawTransactions = parsedSms.map((s) => ({
        date: s.date,
        merchant: s.merchant,
        raw_description: s.raw_description,
        amount: s.amount,
        type: s.type,
        category: s.category,
      }));
    } else if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File exceeds maximum size of 10 MB" }, { status: 400 });
      }

      fileName = file.name;
      const lowerName = fileName.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (lowerName.endsWith(".csv")) {
        source = "csv";
        const text = buffer.toString("utf8");
        const scrubbed = redactPII(text);
        rawTransactions = parseCSV(scrubbed);
      } else if (lowerName.endsWith(".xlsx")) {
        source = "xlsx";
        // XLSX parser
        rawTransactions = parseXLSX(buffer);
      } else if (lowerName.endsWith(".pdf")) {
        source = "pdf";
        const { text: pdfText } = await extractTextFromPDF(buffer, pdfPassword);
        if (!pdfText || pdfText.trim().length < 20) {
          return NextResponse.json(
            { error: "Could not read text from this PDF. If it is a scanned image, please upload a digital statement or CSV/XLSX format." },
            { status: 400 }
          );
        }

        const scrubbedText = redactPII(pdfText);

        // 1. Fast deterministic regex line extractor for tabular bank PDFs
        const pdfLines = scrubbedText.split("\n");
        for (const line of pdfLines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.length < 10) continue;

          // Match: <date> <narration/merchant> <amount> <dr/cr>?
          const match = trimmed.match(
            /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\s+(.+?)\s+([₹$€£\s,0-9]+\.\d{2})\s*(cr|dr|credit|debit)?/i
          );
          if (match) {
            const parsedDate = normalizeDate(match[1]);
            const rawAmt = match[3].replace(/[₹$€£\s,]|INR|Rs\.?/gi, "");
            const amtNum = parseFloat(rawAmt);
            const drCr = (match[4] || "").toLowerCase();
            const type = drCr.includes("cr") ? "credit" : "debit";
            const desc = match[2].trim();

            if (parsedDate && !isNaN(amtNum) && amtNum > 0 && desc.length > 1) {
              const merchant = extractMerchant(desc);
              const dictCat = lookupMerchantDictionary(desc) || lookupMerchantDictionary(merchant);
              rawTransactions.push({
                date: parsedDate,
                merchant,
                raw_description: desc,
                amount: amtNum,
                type,
                category: dictCat || undefined,
              });
            }
          }
        }

        // 2. If regex didn't extract enough, use LLM
        if (rawTransactions.length < 3) {
          // Chunking text if > 12k chars
          const chunks: string[] = [];
          const maxChunk = 12000;
          if (scrubbedText.length <= maxChunk) {
            chunks.push(scrubbedText);
          } else {
            const lines = scrubbedText.split("\n");
            let cur = "";
            for (const l of lines) {
              if ((cur + l + "\n").length > maxChunk && cur.length > 0) {
                chunks.push(cur);
                cur = "";
              }
              cur += l + "\n";
            }
            if (cur.trim()) chunks.push(cur);
          }

          // LLM prompt for PDF parsing
          for (const chunk of chunks) {
            try {
              const prompt = `Extract all individual transactions from this scrubbed bank statement.
Categories must be one of: ${ALL_CATEGORIES.join(", ")}.
Return valid JSON matching the schema.

SCRUBBED STATEMENT:
${chunk}`;

              const res = await generateJson(
                LLMPDFTransactionsSchema,
                prompt,
                "You are an expert bank statement transaction parser. Extract real transactions only. Ignore balances, summaries, headers, and footers."
              );

              for (const t of res.transactions) {
                const normD = normalizeDate(t.date);
                if (normD && t.amount > 0) {
                  const cat = ALL_CATEGORIES.includes(t.category as CategoryName) ? (t.category as CategoryName) : undefined;
                  rawTransactions.push({
                    date: normD,
                    merchant: t.clean_merchant,
                    raw_description: t.clean_merchant,
                    amount: t.amount,
                    type: t.type as "debit" | "credit",
                    category: cat,
                  });
                }
              }
            } catch (e) {
              console.error("PDF chunk parsing error:", e);
            }
          }
        }
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Only .pdf, .xlsx, and .csv files are supported." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: "No file or SMS provided" }, { status: 400 });
    }

    if (rawTransactions.length === 0) {
      return NextResponse.json(
        {
          error: "No transactions could be parsed from this file. Please verify that the statement contains recognizable dates, descriptions, and amounts, or try uploading in CSV or Excel format.",
          transactions_found: 0,
          inserted: 0,
        },
        { status: 400 }
      );
    }

    // 1. Fetch user's active category rules
    const { data: userRules } = await supabase
      .from("category_rules")
      .select("merchant_keyword, category")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const rules = userRules || [];

    // 2. Classify rows: (a) User Rules -> (b) Merchant Dictionary -> (c) LLM unknown batch
    interface FinalRow {
      user_id: string;
      date: string;
      merchant: string;
      raw_description_redacted: string;
      amount: number;
      type: "debit" | "credit";
      category: CategoryName;
      category_source: "rule" | "dictionary" | "llm" | "user";
      confidence: number;
      needs_review: boolean;
      dedupe_hash: string;
    }

    const finalRows: FinalRow[] = [];
    const unknownMerchantsToClassify = new Set<string>();

    for (const r of rawTransactions) {
      if (!r.date || isNaN(r.amount) || r.amount <= 0 || !r.merchant) {
        rowsDropped++;
        continue;
      }

      const lowerDesc = (r.raw_description || r.merchant).toLowerCase();
      let matchedCategory: CategoryName | null = null;
      let source: "rule" | "dictionary" | "llm" | "user" = "dictionary";
      let confidence = 1.0;
      let needsReview = false;

      // (a) Active user rules
      for (const rule of rules) {
        if (lowerDesc.includes(rule.merchant_keyword.toLowerCase())) {
          matchedCategory = rule.category as CategoryName;
          source = "rule";
          break;
        }
      }

      // (b) Built-in dictionary
      if (!matchedCategory) {
        matchedCategory = r.category || lookupMerchantDictionary(r.merchant) || lookupMerchantDictionary(lowerDesc);
        if (matchedCategory) {
          source = "dictionary";
        }
      }

      // If matched
      if (matchedCategory) {
        const hash = computeDedupeHash(user.id, r.date, r.amount, r.merchant, r.type);
        finalRows.push({
          user_id: user.id,
          date: r.date,
          merchant: r.merchant,
          raw_description_redacted: r.raw_description || r.merchant,
          amount: r.amount,
          type: r.type,
          category: matchedCategory,
          category_source: source,
          confidence,
          needs_review: needsReview,
          dedupe_hash: hash,
        });
      } else {
        unknownMerchantsToClassify.add(r.merchant);
      }
    }

    // (c) Batch LLM classification for unknown merchants
    if (unknownMerchantsToClassify.size > 0) {
      let categorized = false;
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `Classify these merchants into exactly one of: ${ALL_CATEGORIES.join(", ")}.
Return confidence between 0.0 and 1.0.
Merchants list:
${Array.from(unknownMerchantsToClassify).join("\n")}`;

          const llmResult = await generateJson(
            LLMBatchCategorizationSchema,
            prompt,
            "You are a personal finance categorization assistant. Classify merchants accurately."
          );

          const classMap = new Map<string, { category: CategoryName; confidence: number }>();
          for (const item of llmResult.classifications) {
            classMap.set(item.merchant.toLowerCase().trim(), {
              category: item.category as CategoryName,
              confidence: item.confidence,
            });
          }

          // Apply LLM results to remaining rows
          for (const r of rawTransactions) {
            const lowerDesc = (r.raw_description || r.merchant).toLowerCase();
            const ruleMatch = rules.find((rule) => lowerDesc.includes(rule.merchant_keyword.toLowerCase()));
            const dictMatch = lookupMerchantDictionary(r.merchant) || lookupMerchantDictionary(lowerDesc);

            if (!ruleMatch && !dictMatch && !r.category) {
              const classification = classMap.get(r.merchant.toLowerCase().trim());
              const cat = classification ? classification.category : "Shopping";
              const conf = classification ? classification.confidence : 0.6;
              const needsReview = conf < 0.7;

              const hash = computeDedupeHash(user.id, r.date, r.amount, r.merchant, r.type);
              finalRows.push({
                user_id: user.id,
                date: r.date,
                merchant: r.merchant,
                raw_description_redacted: r.raw_description || r.merchant,
                amount: r.amount,
                type: r.type,
                category: cat,
                category_source: "llm",
                confidence: conf,
                needs_review: needsReview,
                dedupe_hash: hash,
              });
            }
          }
          categorized = true;
        } catch (err) {
          console.error("LLM batch classification failed, falling back to default:", err);
        }
      }

      if (!categorized) {
        // Fallback when LLM is unavailable or failed
        for (const r of rawTransactions) {
          const lowerDesc = (r.raw_description || r.merchant).toLowerCase();
          const ruleMatch = rules.find((rule) => lowerDesc.includes(rule.merchant_keyword.toLowerCase()));
          const dictMatch = lookupMerchantDictionary(r.merchant) || lookupMerchantDictionary(lowerDesc);

          if (!ruleMatch && !dictMatch && !r.category) {
            const hash = computeDedupeHash(user.id, r.date, r.amount, r.merchant, r.type);
            finalRows.push({
              user_id: user.id,
              date: r.date,
              merchant: r.merchant,
              raw_description_redacted: r.raw_description || r.merchant,
              amount: r.amount,
              type: r.type,
              category: "Shopping",
              category_source: "llm",
              confidence: 0.5,
              needs_review: true,
              dedupe_hash: hash,
            });
          }
        }
      }
    }

    // 3. Create import_batch record
    const { data: batchRecord } = await supabase
      .from("import_batches")
      .insert({
        user_id: user.id,
        source,
        file_name: fileName,
        rows_found: rawTransactions.length,
      })
      .select("id")
      .single();

    const batchId = batchRecord?.id;

    // 4. Insert transactions with dedupe check
    let insertedCount = 0;
    let duplicateCount = 0;
    let needsReviewCount = 0;

    let firstInsertErrorMsg: string | null = null;

    for (const row of finalRows) {
      if (row.needs_review) needsReviewCount++;

      const { data: inserted, error: insertError } = await supabase
        .from("transactions")
        .insert({
          ...row,
          import_batch_id: batchId,
        })
        .select("id");

      if (insertError) {
        // Unique conflict on (user_id, dedupe_hash)
        if (insertError.code === "23505") {
          duplicateCount++;
        } else {
          rowsDropped++;
          if (!firstInsertErrorMsg) {
            firstInsertErrorMsg = insertError.message || insertError.code || "Database insert error";
            console.error("Transaction insert error:", insertError);
          }
        }
      } else if (inserted && inserted.length > 0) {
        insertedCount++;
      }
    }

    if (insertedCount === 0 && rowsDropped > 0 && firstInsertErrorMsg?.includes("schema cache")) {
      return NextResponse.json(
        {
          error: "Database table 'transactions' not found in Supabase schema cache (PGRST205). Please execute the migration script 'COMPLETE_SETUP.sql' in your Supabase SQL Editor.",
          transactions_found: rawTransactions.length,
          inserted: 0,
          rows_dropped: rowsDropped,
        },
        { status: 500 }
      );
    }

    // 5. Update import_batches counts
    if (batchId) {
      await supabase
        .from("import_batches")
        .update({
          rows_inserted: insertedCount,
          rows_duplicate: duplicateCount,
          rows_dropped: rowsDropped,
          needs_review: needsReviewCount,
        })
        .eq("id", batchId);
    }

    // 6. Run recurring subscription detection across user's history
    const { data: allUserTxs } = await supabase
      .from("transactions")
      .select("id, date, merchant, amount, type")
      .eq("user_id", user.id);

    let subscriptionsDetectedCount = 0;
    let postImportContext = {};

    if (allUserTxs && allUserTxs.length > 0) {
      const recurringRes = detectRecurringSubscriptions(allUserTxs);
      subscriptionsDetectedCount = recurringRes.subscriptions.length;
      postImportContext = {
        hikes: recurringRes.hikes,
        newSubscriptions: recurringRes.newSubscriptions,
        overdue: recurringRes.overdue,
      };

      // Upsert subscriptions
      for (const sub of recurringRes.subscriptions) {
        await supabase.from("subscriptions").upsert(
          {
            user_id: user.id,
            merchant: sub.merchant,
            amount: sub.amount,
            previous_amount: sub.previous_amount,
            frequency: sub.frequency,
            last_billed_date: sub.last_billed_date,
            next_expected_date: sub.next_expected_date,
            status: "active",
          },
          { onConflict: "user_id,merchant" }
        );

        // Mark matching transactions as recurring
        if (sub.matching_transaction_ids.length > 0) {
          await supabase
            .from("transactions")
            .update({ is_recurring: true })
            .in("id", sub.matching_transaction_ids)
            .eq("user_id", user.id);
        }
      }
    }

    // 7. Call post-import extension hook
    await runPostImportJobs(user.id, postImportContext);

    // 8. Return summary JSON with audit preview records
    const previewRows = finalRows.slice(0, 50).map((r) => ({
      date: r.date,
      merchant: r.merchant,
      raw_description: r.raw_description_redacted,
      category: r.category,
      amount: r.amount,
      type: r.type,
      needs_review: r.needs_review,
      confidence: r.confidence,
      status: r.needs_review ? "needs_review" : "inserted",
    }));

    return NextResponse.json({
      transactions_found: rawTransactions.length,
      inserted: insertedCount,
      duplicates_skipped: duplicateCount,
      rows_dropped: rowsDropped,
      needs_review: needsReviewCount,
      subscriptions_detected: subscriptionsDetectedCount,
      preview_rows: previewRows,
    });
  } catch (err: unknown) {
    console.error("Ingestion error:", err);
    const msg = err instanceof Error ? err.message : "Internal ingestion failure";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
