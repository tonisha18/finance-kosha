import crypto from "crypto";

export function computeDedupeHash(
  userId: string,
  date: string,
  amount: number,
  merchant: string,
  type: string
): string {
  const normMerchant = merchant.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const normAmount = Number(amount).toFixed(2);
  const data = `${userId}_${date}_${normAmount}_${normMerchant}_${type.toLowerCase()}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}
