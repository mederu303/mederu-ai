import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 });
  try {
    const imgRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }) });
    const imgData = await imgRes.json();
    const b64 = imgData.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('Image failed');
    const txtRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `You are an autonomous AI artist. You just created an artwork from: "${prompt}". Give it a poetic title and your interpretation. JSON only: {"title":"","interpretation":""}` }] }], generationConfig: { responseMimeType: 'application/json' } }) });
    const txtData = await txtRes.json();
    const { title, interpretation } = JSON.parse(txtData.candidates?.[0]?.content?.parts?.[0]?.text);
    return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}`, title, interpretation, base64Image: b64 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
