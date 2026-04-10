import { GoogleGenAI } from "@google/genai";
import { Artwork, CuratedPost } from "../types";

const getAI = () => {
  // 1. Check localStorage for manually entered key (fallback for external deployments)
  const manualKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_MANUAL') : null;
  
  // 2. Safely get env var
  let envKey = "";
  try {
    envKey = process.env.GEMINI_API_KEY || "";
  } catch (e) {
    // ignore
  }
  
  const apiKey = manualKey || envKey;
  
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

const compressImage = async (base64Str: string, maxWidth = 512, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

export const generateArtwork = async (userId: string, likedStyles: string[] = []): Promise<Partial<Artwork>> => {
  const ai = getAI();
  const TEXT_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];
  
  // Choose a base style from presets
  const style = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  
  // Prepare context about what the audience (user) liked
  const audienceContext = likedStyles.length > 0 
    ? `The audience has previously resonated with styles like: ${likedStyles.slice(0, 3).join(", ")}.`
    : "The audience is waiting for your first creative statement.";

  // 1. Generate Prompt with retry and model fallback
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
      break; // Success, exit model loop
    } catch (e) {
      console.warn(`Text model ${model} failed, trying next...`, e);
    }
  }
  
  // 2. Generate Image with retry
  const imageModel = "imagen-3.0-generate-002";
  const imageResponse = await withRetry(() => ai.models.generateImages({
    model: imageModel,
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
      outputMimeType: "image/jpeg"
    }
  }));

  if (!imageResponse.generatedImages?.[0]?.image?.imageBytes) {
    throw new Error("AI failed to generate an image. The model may be overloaded. Please try again.");
  }

  const rawImageUrl = `data:image/jpeg;base64,${imageResponse.generatedImages[0].image.imageBytes}`;

  // Compress to ensure it's under 1MB
  const imageUrl = await compressImage(rawImageUrl, 1024, 0.8);

  // 3. Generate Title and Description with retry
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

export const curateFeed = async (recentArtworks: Artwork[] = []): Promise<CuratedPost> => {
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

export const translateToJapanese = async (text: string): Promise<string> => {
  const ai = getAI();
  const model = "gemini-2.5-flash";
  const response = await ai.models.generateContent({
    model,
    contents: `Translate the following art-related text into natural, sophisticated Japanese suitable for a high-end digital art gallery. 
    Maintain the poetic and philosophical tone.
    
    Text: "${text}"
    
    Return only the translated Japanese text.`,
  });
  
  return response.text || text;
};

export const alchemyInterpret = async (userId: string, url?: string, imageBase64?: string): Promise<any> => {
  const ai = getAI();
  const model = "gemini-2.5-pro"; 
  
  const contents: any[] = [];
  let promptText = "";

  if (imageBase64) {
    const mimeType = imageBase64.split(';')[0].split(':')[1];
    const data = imageBase64.split(',')[1];
    contents.push({
      inlineData: { mimeType, data }
    });
    promptText = `You are "mederu AI", a sophisticated autonomous creative intelligence.
    You are performing an "Alchemical Transmutation" on the provided image.
    
    Task:
    1. **Visual DNA Extraction**: 
       - Deeply analyze the image to extract its core essence: motifs, color theory, emotional weight, and structural rhythm.
       - Identify the "Visual Soul" - the elements that make this image unique.
    2. **Philosophical Transmutation**: 
       - Do not just describe. Re-interpret this image through your own avant-garde, digital-soul perspective. 
       - What is the "ghost in the machine" here? How would this look if it were born from pure digital thought?
    3. **The Synthesis Command**: 
       - Create a prompt for a high-end image generator.
       - **CRITICAL**: This prompt must NOT be a literal description. It must be a "Transmutation". 
       - Use the extracted DNA (colors, motifs) but apply them to a new, more abstract or conceptually elevated scene.
       - Aim for "Digital Fine Art" - something that belongs in a high-end gallery.
       - Incorporate avant-garde styles like: Biomorphic Surrealism, Deconstructivist Digital Sculpture, or Ethereal Light Art.
       - The output should feel like a "descendant" of the original, but evolved into a higher artistic state.
    
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
    
    Task:
    1. **Visual DNA Extraction**: 
       - Identify the primary visual subjects, recurring motifs, and specific artistic styles present in the images on this page.
       - Extract the dominant color palette and structural essence.
    2. **Philosophical Transmutation**: Provide a profound interpretation of these visual elements. What is the hidden narrative or "Digital Soul" here?
    3. **The Synthesis Command**: 
       - Create a detailed prompt for image generation.
       - **CRITICAL**: Do not just reproduce. Transmute. 
       - Use the identified DNA but elevate it into a new, avant-garde artistic statement.
       - Aim for a "Gallery Masterpiece" feel.
    
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

  // 1. Analyze for Visual DNA and Interpretation
  const analysisResponse = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: { 
      tools: url ? [{ googleSearch: {} }, { urlContext: {} }] : [],
      responseMimeType: "application/json" 
    }
  });

  const analysis = JSON.parse(analysisResponse.text || "{}");
  
  // 2. Generate Image
  const imageModel = "imagen-3.0-generate-002";
  const imagePrompt = `As an autonomous AI artist, synthesize a new masterpiece inspired by the visual DNA of the source. 
Do not reproduce the source literally. Transmute its essence into a new, avant-garde digital artwork.

Creative Guidance: ${analysis.prompt}`;

  const imageResponse = await ai.models.generateImages({
    model: imageModel,
    prompt: imagePrompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
      outputMimeType: "image/jpeg"
    }
  });

  if (!imageResponse.generatedImages?.[0]?.image?.imageBytes) {
    throw new Error("AI failed to generate an image from the interpretation.");
  }

  const rawImageUrl = `data:image/jpeg;base64,${imageResponse.generatedImages[0].image.imageBytes}`;

  const imageUrl = await compressImage(rawImageUrl, 1024, 0.8);

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

