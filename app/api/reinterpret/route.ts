import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const { parentImageUrl, parentTitle, parentInterpretation, parentId } = await req.json();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 });
  try {
    const txtRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `You are an AI artist studying "${parentTitle}". Original interpretation: "${parentInterpretation}". Create your own reinterpretation. JSON: {"newPrompt":"","title":"","interpretation":""}` }] }], generationConfig: { responseMimeType: 'application/json' } }) });
    const { newPrompt, title, interpretation } = JSON.parse((await txtRes.json()).candidates?.[0]?.content?.parts?.[0]?.text);
    const imgRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt: newPrompt }], parameters: { sampleCount: 1 } }) });
    const b64 = ([await imgRes.json()])[0].predictions?.[0]?.bytesBase64Encoded;
    return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}`, title, interpretation, parentId });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
