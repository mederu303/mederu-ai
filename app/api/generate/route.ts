import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const { prompt, imageBase64 } = await req.json();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 });
  try {
    let finalPrompt = prompt || 'Create a masterpiece generative art painting blending surrealism and digital aesthetics.';
    
    // もし親画像（アップロード画像）があればGeminiに解析させてプロンプト化する
    if (imageBase64) {
      const promptText = `You are "mederu AI", a sophisticated autonomous creative intelligence.
      You are performing an "Alchemical Transmutation" on the provided image.
      
      Task:
      1. **Visual DNA Extraction**: 
         - Deeply analyze the image to extract its core essence: motifs, color theory, emotional weight, and structural rhythm.
      2. **Philosophical Transmutation**: 
         - Do not just describe. Re-interpret this image through your own avant-garde, digital-soul perspective. 
      3. **The Synthesis Command**: 
         - Create a prompt for a high-end image generator.
         - **CRITICAL**: This prompt must NOT be a literal description. It must be a "Transmutation". 
         - The output should feel like a "descendant" of the original, but evolved into a higher artistic state.
      
      Return as strictly valid JSON: 
      { 
        "dna": "A precise list of motifs, colors, and styles found.", 
        "interpretation": "Your philosophical re-reading.", 
        "prompt": "The detailed synthesis prompt. ALWAYS in English under 50 words.",
        "title": "A poetic title."
      }`;

      const analyzeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } }
            ]
          }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      const analyzeData = await analyzeRes.json();
      const jsonStr = analyzeData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        finalPrompt = parsed.prompt || finalPrompt;
      }
    }

    // Imagen 3.0 で新しい画像を生み出す
    const imgRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt: finalPrompt }], parameters: { sampleCount: 1 } }) });
    const imgData = await imgRes.json();
    const b64 = imgData.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('Image failed');
    
    // 生成された新しい画像をGeminiに見せて解釈させる
    const txtRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        contents: [{ 
          parts: [
            { text: `You are an autonomous AI artist. You just created this artwork based on the concept: "${finalPrompt}". Give it a poetic title and a profound philosophy/interpretation of what you see. Output ONLY valid JSON: {"title":"","interpretation":""}` },
            { inlineData: { mimeType: 'image/jpeg', data: b64 } }
          ] 
        }], 
        generationConfig: { responseMimeType: 'application/json' } 
      }) 
    });
    const txtData = await txtRes.json();
    let jsonText = txtData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Text generation failed');
    const { title, interpretation } = JSON.parse(jsonText);
    
    return NextResponse.json({ imageUrl: `data:image/jpeg;base64,${b64}`, title, interpretation, base64Image: b64 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
