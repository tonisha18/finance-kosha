import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/**
 * Universal JSON generation with Zod validation and single-retry error repair.
 */
export async function generateJson<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  systemInstruction?: string
): Promise<T> {
  const ai = getClient();
  const model = DEFAULT_MODEL;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const rawText = response.text || "{}";

  try {
    const parsed = JSON.parse(rawText);
    return schema.parse(parsed);
  } catch (err: unknown) {
    // Retry once with repair prompt
    const repairPrompt = `The previous output did not match the expected JSON schema.
Error: ${err instanceof Error ? err.message : String(err)}
Original prompt: ${prompt}
Previous output: ${rawText}

Please correct the JSON and return only valid JSON matching the schema.`;

    const retryResponse = await ai.models.generateContent({
      model,
      contents: repairPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const retryText = retryResponse.text || "{}";
    const retryParsed = JSON.parse(retryText);
    return schema.parse(retryParsed);
  }
}

/**
 * Universal text generation for narratives and summaries.
 */
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.2,
    },
  });

  return response.text || "";
}
