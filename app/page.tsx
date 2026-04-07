'use client';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const { isConnected } = useAccount();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true); setGenerated(null); setMintResult(null);
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      setGenerated(await res.json());
    } finally { setIsGenerating(false); }
  };

  const handleMint = async () => {
    if (!generated) return;
    setIsMinting(true);
    try {
      const res = await fetch('/api/mint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: generated.imageUrl, title: generated.title, interpretation: generated.interpretation }) });
      setMintResult(await res.json());
    } finally { setIsMinting(false); }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-purple-400">MEDDRU SIGNATURE </h1><p className="text-xs text-white/40">AI AGT GENEALMGY on Etherlink</p></div>
        <div className="flex items-center gap-4">
          <Link href="/lineage" className="text-sm text-white/60 hover:text-white">Family Tree</Link>
          <ConnectButton />
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Where art interprets art</h2>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex gap-3 mb-6">
            <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your vision..." className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none" />
            <button onClick={handleGenerate} disabled={isGenerating} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-medium">{isGenerating ? 'Generating...' : 'Generate'}</button>
          </div>
          {generated && <div className="flex gap-6"><div className="w-64 h-64 rounded-xl overflow-hidden flex-shrink-0"><img src={generated.imageUrl} alt={generated.title} className="w-full h-full object-cover" /></div><div className="flex-1"><h4 className="text-xl font-bold mb-2 text-purple-300">{generated.title}</h4><p className="text-white/60 text-sm mb-6">{generated.interpretation}</p>{mintResult ? <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4"><p className="text-green-400 font-medium">✓ Minted on Etherlink!</p><a href={`https://testnet.explorer.etherlink.com/tx/${mintResult.txHash}`} target="_blank" className="text-purple-400 text-sm hover:underline">View tx →</a></div> : <button onClick={handleMint} disabled={isMinting || !isConnected} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 rounded-xl font-medium">{isMinting ? 'Minting...' : !.isConnected ? 'Connect wallet' : 'Mint Genesis NFT →'}</button>}</div></div>}
        </div>
      </div>
    </main>
  );
}
