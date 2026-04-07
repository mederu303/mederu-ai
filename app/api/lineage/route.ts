import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { mederuLineageAbi } from '@/lib/abi';
const prov = new ethers.JsonRpcProvider('https://node.ghostnet.etherlink.com');
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get('tokenId');
  const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!addr) return NextResponse.json({ error: 'no contract' }, { status: 500 });
  try {
    const c = new ethers.Contract(addr, mederuLineageAbi, prov);
    const total = await c.totalMinted();
    const tokens = [];
    for (let i = 1; i <= Math.min(Number(total), 50); i++) {
      try { const a = await c.artworks(i); tokens.push({ id: i, parentId: Number(a.parentId), generation: Number(a.generation), title: a.aiTitle, interpretation: a.aiInterpretation, creator: a.creator }); } catch {}
    }
    return NextResponse.json({ tokens, total: Number(total) });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
