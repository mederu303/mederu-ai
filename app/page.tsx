'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function Home() {
  const { isConnected } = useAccount();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<{                    
    imageUrl: string;
    title: string;
    interpretation: string;
  } | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{
    txHash: string
  } | null>(null);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () =>  {
    if (!prompt.trim() && !uploadedImage) return;
    setIsGenerating(true);
    setGenerated(null);
    setMintResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageBase64: uploadedImage }),
      });
      setGenerated(await res.json());
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMint = async () => {
    if (!generated) return;
    setIsMinting(true);
    try {
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generated),
      });
      setMintResult(await res.json());
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter italic text-zinc-100">mederu AI</h1>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Autonomous AI Art Genealogy</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/lineage" className="text-sm font-bold text-zinc-400 hover:text-emerald-400 transition">
            View Family Tree
          </Link>
          <ConnectButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-6 tracking-tighter">
            An Autonomous AI Artist <br />
            <span className="text-emerald-400 italic font-bold">
              that interprets its own creations.
            </span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-3xl mx-auto leading-relaxed">
            Upload an image, or leave it entirely to the AI. <br />
            The AI generates the artwork, autonomously assigns a title, description, and interpretation, and mints it on Etherlink as a Genesis NFT.<br />
            Others can later request a "Reinterpretation" to spawn descendants, weaving an on-chain family tree of art.
          </p>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-3xl p-8 mb-8 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div 
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center border-dashed cursor-pointer hover:bg-white/10 transition relative overflow-hidden min-h-[160px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              {uploadedImage ? (
                <>
                  <div className="absolute inset-0 w-full h-full pointer-events-none">
                     <img src={uploadedImage} className="w-full h-full object-cover opacity-30 blur-sm" />
                  </div>
                  <img src={uploadedImage} className="relative z-10 h-28 object-contain rounded shadow-xl" />
                  <span className="relative z-10 text-emerald-400 text-xs mt-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">Image Uploaded</span>
                </>
              ) : (
                <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest text-[10px]">📤 Drop Image (Optional)</span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-3 justify-center">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  placeholder="Or provide a theme (e.g., 'Cyberpunk forest')"
                  className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-4 py-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition font-medium"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              >
                {isGenerating ? 'AI is creating...' : '✨ Leave it entirely to AI'}
              </button>
            </div>
          </div>

          {generated && (
            <div className="flex flex-col md:flex-row gap-8 mt-12 pt-8 border-t border-white/5 animate-fade-in">
              <div className="w-full md:w-1/2">
                <img
                  src={generated.imageUrl}
                  alt={generated.title}
                  className="w-full aspect-square rounded-2xl object-cover shadow-[0_0_40px_rgba(16,185,129,0.15)] border border-white/5"
                />
              </div>
              <div className="w-full md:w-1/2 flex flex-col justify-center">
                <div className="mb-6">
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase tracking-widest rounded-full font-bold mb-4 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Autonomous Output
                  </span>
                  <h4 className="text-4xl font-black mb-4 text-zinc-100 italic tracking-tighter">{generated.title}</h4>
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                    <h5 className="text-[10px] font-bold text-zinc-500 mb-3 uppercase tracking-[0.2em]">Philosophical Transmutation</h5>
                    <p className="text-zinc-300 text-sm leading-relaxed italic">{generated.interpretation}</p>
                  </div>
                </div>

                {mintResult ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
                    <h5 className="text-emerald-400 font-bold mb-2 flex items-center gap-2 text-lg">
                       Successfully Minted on Etherlink!
                    </h5>
                    <p className="text-sm text-emerald-400/80 mb-4">
                      This creation is now permanently etched on-chain as a Genesis node.
                    </p>
                    <a href={`https://testnet.explorer.etherlink.com/tx/${mintResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-5 py-3 bg-white text-black hover:bg-emerald-400 rounded-full text-sm font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    >
                      View on Explorer ↗
                    </a>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-3 text-center">
                      Low gas and 500ms finality on Etherlink
                    </p>
                    <button
                      onClick={handleMint}
                      disabled={isMinting || !isConnected}
                      className="w-full py-4 border-2 border-transparent bg-white text-black hover:bg-transparent hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50 rounded-full font-bold text-lg transition-all"
                    >
                      {!isConnected
                        ? 'Connect wallet to Mint'
                        : isMinting
                        ? 'AI is Minting on-chain...'
                        : 'Mint as Genesis NFT'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
