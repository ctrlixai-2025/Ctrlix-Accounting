import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptExtraction } from "../types";

const initGemini = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const analyzeReceipt = async (base64Image: string): Promise<ReceiptExtraction> => {
  const ai = initGemini();
  if (!ai) {
    console.warn("No API Key found for Gemini");
    return {};
  }

  // Remove data URL prefix if present for processing
  const base64Data = base64Image.split(',')[1] || base64Image;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data
            }
          },
          {
            text: "Extract the following details from this receipt image: Transaction Date (YYYY-MM-DD), Total Amount (number), Summary (brief description), and determine if a Tax ID/VAT number is visible on the receipt (return boolean true/false). Return as JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
            amount: { type: Type.NUMBER, description: "Total amount" },
            summary: { type: Type.STRING, description: "Brief summary of items" },
            hasTaxId: { type: Type.BOOLEAN, description: "True if a Tax ID/VAT number is found on the receipt" }
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as ReceiptExtraction;
    }
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
  }
  return {};
};