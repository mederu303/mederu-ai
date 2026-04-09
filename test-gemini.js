import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    console.log("Testing text generation with gemini-2.5-flash...");
    const textRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello",
    });
    console.log("Text Success:", textRes.text?.substring(0, 50));

    console.log("\nTesting text generation with gemini-3-flash-preview...");
    try {
      const textRes3 = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Hello",
      });
      console.log("Gemini 3 Success:", textRes3.text?.substring(0, 50));
    } catch (e) {
      console.error("Gemini 3 Failed:", e.message);
    }

    console.log("\nTesting image generation with imagen-3.0-generate-002...");
    try {
      const imgRes = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: "A beautiful cat",
      });
      console.log("Image Success, parts:", imgRes.generatedImages?.[0]?.image?.imageBytes ? "Yes bytes" : "No bytes");
    } catch (e) {
      console.error("Imagen generateImages Failed:", e.message);
    }

    console.log("\nTesting image generation with generateContent and imagen-3.0-generate-002...");
    try {
      const imgRes2 = await ai.models.generateContent({
        model: "imagen-3.0-generate-002",
        contents: { parts: [{ text: "A beautiful cat" }] },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });
      console.log("Image generateContent Success!");
    } catch (e) {
      console.error("Imagen generateContent Failed:", e.message);
    }
  } catch (err) {
    console.error("Global Error:", err);
  }
}
run();
