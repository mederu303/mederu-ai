import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { mederuLineageAbi } from '@/lib/abi';
export async function POST(req: NextRequest) {
  const { imageUrl, title, interpretation, parentId } = await req.json();
  const pinataJwt = process.env.PINATA_JWT;
  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const aiKey = process.env.AI_WALLET_PRIVATE_KEY;
  if (!pinataJwt || !contractAddress || !aiKey) return NextResponse.json({ error: 'not configured' }, { status: 500 });
  try {
    const b64 = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' }), `mederu-${Date.now()}.png`);
    fd.append('pinataMetadata', JSON.stringify({ name: title }));
    const imgR = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', { method: 'POST', headers: { Authorization: `Bearer ${pinataJwt}` }, body: fd });
    const { IpfsHash: imgCid } = await imgR.json();
    const meta = { name: title, description: interpretation, image: `https://${gatewayUrl}/ipfs/${imgCid}`, attributes: [{ trait_type: 'Generation', value: parentId ? 'Reinterpretation' : 'Genesis' }] };
    const metaR = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pinataJwt}` }, body: JSON.stringify({ pinataContent: meta, pinataMetadata: { name: `${title}-meta` } }) });
    const { IpfsHash: metaCid } = await metaR.json();
    const prov = new ethers.JsonRpcProvider('https://node.ghostnet.etherlink.com');
    const wallet = new ethers.Wallet(aiKey, prov);
    const contract = new ethers.Contract(contractAddress, mederuLineageAbi, wallet);
    const tx = parentId ? await contract.mintReinterpretation(parentId, `ipfs://${metaCid}`, title, interpretation) : await contract.mintGenesis(`ipfs://${metaCid}`, title, interpretation);
    const receipt = await tx.wait();
    return NextResponse.json({ txHash: receipt.hash, imageCid: imgCid, metadataCid: metaCid });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
