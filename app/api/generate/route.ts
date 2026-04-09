import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const { prompt, imageBase64 } = await req.json();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 });
  try {
    let finalPrompt = prompt || 'Create a masterpiece generative art painting blending surrealism and digital aesthetics.';
    
    // もし親画像（アップロード画像）があればGeminiに解析させてプロンプト化する
    if (imageBase64) {
      const analyzeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Analyze this image conceptually. Generate a vivid, surreal, and highly detailed visual text prompt (under 40 words) that reinterprets or evolves this image into a new masterpiece. If the user provided a prompt (${prompt}), blend it with the image concept.` },
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } }
            ]
          }]
        })
      });
      const analyzeData = await analyzeRes.json();
      const extractedPrompt = analyzeData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (extractedPrompt) finalPrompt = extractedPrompt;
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
