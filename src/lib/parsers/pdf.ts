import { PDFParse } from "pdf-parse";

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
}

export async function extractTextFromPDF(buffer: Buffer, password?: string): Promise<PDFExtractionResult> {
  try {
    const parser = new PDFParse({ data: buffer, password });
    const textResult = await parser.getText();
    await parser.destroy();

    return {
      text: textResult.text || "",
      pageCount: textResult.total || 1,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("password") || msg.includes("Password") || msg.includes("PasswordException")) {
      throw new Error("PDF_PASSWORD_REQUIRED: This PDF is password protected. Please provide a password.");
    }
    throw new Error(`PDF_PARSE_FAILED: Failed to parse PDF: ${msg}`);
  }
}
