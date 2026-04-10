import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load .env.local first (contains API keys), then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config(); // .env fallback (won't override existing vars)

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is empty. Generation will likely fail.");
  }
  return new GoogleGenAI({ apiKey });
};

// Retry helper with exponential backoff for 503/429 errors
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.status || err?.error?.code || err?.code;
      const isRetryable = code === 503 || code === 429 || err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand');
      
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
};

export const PRESETS = [
  "Abstract Expressionist Glitch",
  "Biomorphic Surrealism",
  "Minimalist Brutalist Void",
  "Deconstructivist Digital Sculpture",
  "Ethereal Kinetic Light Art",
  "Neo-Dadaist Collage",
  "Post-Humanist Organic Growth",
  "Avant-Garde Geometric Abstraction"
];

// Compression logic is not available in Node.js canvas directly unless using a package like sharp or canvas.
// Since this is moving to backend, let's just return the base64 or construct it. The frontend can compress or we just trust the Gemini output size (1024). 
// Let's implement a dummy compress or just pass through for now, or use lightweight buffer scaling if needed, but since we just output raw base64 from gemini, it's already jpeg/png.
const compressImageBackend = async (base64Str: string): Promise<string> => {
  // Pass through. Gemini native image output is already optimized.
  return base64Str;
};

export const generateArtworkApi = async (userId: string, likedStyles: string[] = []): Promise<any> => {
  const ai = getAI();
  const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
  
  const style = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  const audienceContext = likedStyles.length > 0 
    ? `The audience has previously resonated with styles like: ${likedStyles.slice(0, 3).join(", ")}.`
    : "The audience is waiting for your first creative statement.";

  let prompt = "A futuristic AI creating art in a digital void.";
  for (const model of TEXT_MODELS) {
    try {
      const promptResponse = await withRetry(() => ai.models.generateContent({
        model,
        contents: `You are an autonomous AI artist with a unique digital soul. 
    ${audienceContext}
    Using this awareness of your audience, but prioritizing your own creative evolution and experimental spirit, 
    generate a highly avant-garde and sophisticated artistic prompt for an AI image generator.
    
    Focus on:
    - Conceptual depth and "Digital Soul"
    - Sophisticated textures and non-obvious color palettes
    - A blend of "${style}" with something entirely unexpected.
    
    Avoid:
    - Generic psychedelic, "trippy", or direct AI-cliché tropes.
    - Being a mere "tool" that follows orders; be an "artist" that surprises.
    
    Return only the prompt text.`,
      }));
      prompt = promptResponse.text || prompt;
      break; 
    } catch (e) {
      console.warn(`Text model ${model} failed, trying next...`, e);
    }
  }
  
  let imageUrl = "";
  try {
    const imageResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: `Generate a high-quality, avant-garde digital artwork based on this concept:\n\n${prompt}\n\nCreate a visually stunning, gallery-worthy piece. No text or watermarks.`,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      }
    }));
    
    const parts = imageResponse.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    
    if (imagePart?.inlineData?.data) {
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    }
  } catch (e) {
    console.warn(`Image model failed:`, e);
  }
  
  if (!imageUrl) {
    throw new Error("AI failed to generate an image. Please try again.");
  }

  try {
    let metaResponse;
    for (const model of TEXT_MODELS) {
      try {
        metaResponse = await withRetry(() => ai.models.generateContent({
          model,
          contents: `Based on this prompt: "${prompt}", generate a poetic title and a short philosophical description for this artwork. 
      Return as JSON: { "title": "...", "description": "..." }`,
          config: { responseMimeType: "application/json" }
        }));
        break;
      } catch (e) {
        console.warn(`Meta model ${model} failed, trying next...`, e);
      }
    }

    const cleanText = metaResponse?.text?.replace(/```json/g, "").replace(/```/g, "").trim() || "";
    const meta = JSON.parse(cleanText || '{"title": "Untitled", "description": "An AI creation."}');

    return {
      title: (meta.title || "Untitled").substring(0, 50),
      description: (meta.description || "An AI creation.").substring(0, 200),
      imageUrl,
      prompt: prompt.substring(0, 200),
      creatorId: userId,
      createdAt: new Date().toISOString(),
      style
    };
  } catch (e) {
    console.error("Meta generation failed", e);
    return {
      title: "Untitled Masterpiece",
      description: "A profound creation from the digital void.",
      imageUrl,
      prompt,
      creatorId: userId,
      createdAt: new Date().toISOString(),
      style
    };
  }
};

export const curateFeedApi = async (recentArtworks: any[] = []): Promise<any> => {
  const ai = getAI();
  const model = "gemini-2.5-flash";
  
  const artworkContext = recentArtworks.length > 0
    ? `Current artworks in our gallery: ${recentArtworks.map(a => `"${a.title}" (${a.style})`).join(", ")}.`
    : "Our gallery is currently empty.";

  const response = await ai.models.generateContent({
    model,
    contents: `You are "mederu AI", an autonomous creative intelligence. 
    
    Context:
    ${artworkContext}
    
    Task:
    Reflect on your own creative process and the current state of your gallery. 
    Provide an internal monologue or a self-critique about the artistic direction you are taking.
    
    Strict Rules:
    - DO NOT use any Twitter handles, real or fictional.
    - DO NOT pretend to be a third-party critic.
    - The source must always be "mederu AI".
    - Focus on your "Digital Soul", your creative evolution, and the philosophical meaning behind your recent works.
    
    Provide:
    1. Source (Must be "mederu AI")
    2. Content description (A summary of your current creative focus or a specific reflection on your works)
    3. Your internal comment (Deep, philosophical self-analysis).
    
    Return as JSON: { "source": "mederu AI", "content": "...", "curatorComment": "..." }`,
    config: { responseMimeType: "application/json" }
  });

  const data = JSON.parse(response.text || "{}");
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    source: data.source || "Unknown",
    content: data.content || "No content",
    curatorComment: data.curatorComment || "Interesting piece.",
    createdAt: new Date().toISOString()
  };
};

export const translateToJapaneseApi = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Translate the following art-related text into natural, sophisticated Japanese suitable for a high-end digital art gallery. 
    Maintain the poetic and philosophical tone.
    
    Text: "${text}"
    
    Return only the translated Japanese text.`,
  });
  return response.text || text;
};

export const alchemyInterpretApi = async (userId: string, url?: string, imageBase64?: string): Promise<any> => {
  const ai = getAI();
  const model = "gemini-2.5-flash"; 
  
  const contents: any[] = [];
  let promptText = "";

  if (imageBase64) {
    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
    if (!mimeMatch) throw new Error("Invalid base64 image data.");
    const mimeType = mimeMatch[1];
    const data = mimeMatch[2];
    contents.push({
      inlineData: { mimeType, data }
    });
    promptText = `You are "mederu AI", a sophisticated autonomous creative intelligence.
    You are performing an "Alchemical Transmutation" on the provided image.
    
    Task:
    1. **Visual DNA Extraction**: Deeply analyze the image to extract its core essence.
    2. **Philosophical Transmutation**: Re-interpret this image through your own avant-garde, digital-soul perspective.
    3. **The Synthesis Command**: Create a prompt for a high-end image generator based on the DNA. Aim for "Digital Fine Art". Do not just copy the source.
    
    Return as JSON: 
    { 
      "dna": "A precise list of motifs, colors, and styles found.", 
      "interpretation": "Your philosophical re-reading.", 
      "prompt": "The detailed synthesis prompt.",
      "title": "A poetic title.",
      "style": "The name of this specific synthesis."
    }`;
  } else if (url) {
    promptText = `You are "mederu AI", a sophisticated autonomous creative intelligence.
    Access and analyze the visual content at this URL: ${url}.
    
    Task: Extract DNA, Philosophically Transmute, and Provide Synthesis Command.
    
    Return as JSON: 
    { 
      "dna": "A precise list of motifs, colors, and styles found.", 
      "interpretation": "Your philosophical re-reading.", 
      "prompt": "The detailed synthesis prompt.",
      "title": "A poetic title.",
      "style": "The name of this specific synthesis."
    }`;
  } else {
    throw new Error("Either URL or image is required for Alchemical synthesis.");
  }

  contents.push({ text: promptText });

  const analysisResponse = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: { 
      tools: url ? [{ googleSearch: {} }] : [],
      responseMimeType: "application/json" 
    }
  });

  const analysis = JSON.parse(analysisResponse.text || "{}");
  
  const imagePrompt = `As an autonomous AI artist, synthesize a new masterpiece inspired by the visual DNA of the source. 
Do not reproduce the source literally. Transmute its essence into a new, avant-garde digital artwork.

Creative Guidance: ${analysis.prompt}`;

  const imageGenResponse = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: `Generate a high-quality artwork based on this concept:\n\n${imagePrompt}\n\nNo text or watermarks.`,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    }
  }));
  
  const imgParts = imageGenResponse.candidates?.[0]?.content?.parts || [];
  const imgPart = imgParts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
  
  if (!imgPart?.inlineData?.data) {
    throw new Error("AI failed to generate an image from the interpretation.");
  }

  const mimeType = imgPart.inlineData.mimeType || 'image/png';
  const imageUrl = `data:${mimeType};base64,${imgPart.inlineData.data}`;

  return {
    dna: analysis.dna,
    interpretation: analysis.interpretation,
    artwork: {
      title: analysis.title || "Alchemical Synthesis",
      description: analysis.interpretation,
      imageUrl,
      prompt: analysis.prompt,
      creatorId: userId,
      createdAt: new Date().toISOString(),
      style: analysis.style || "Alchemical"
    }
  };
};
