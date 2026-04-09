'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useState, useRef } from 'react';
import Link from 'next/link';

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
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">mederu lineage</h1>
          <p className="text-xs text-white/40 tracking-widest">Autonomous AI Art Genealogy on Etherlink</p>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/lineage" className="text-sm font-bold text-white/60 hover:text-purple-400 transition">
            View Family Tree (Lineage)
          </Link>
          <ConnectButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6 tracking-tight">
            An Autonomous AI Artist <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              that interprets its own creations.
            </span>
          </h2>
          <p className="text-white/60 text-lg max-w-3xl mx-auto leading-relaxed">
            Upload an image, or leave it entirely to the AI. <br />
            The AI generates the artwork, autonomously assigns a title, description, and interpretation, and mints it on Etherlink as a Genesis NFT.<br />
            Others can later request a "Reinterpretation" to spawn descendants, weaving an on-chain family tree of art.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 shadow-2xl shadow-purple-900/10">
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
                  <span className="relative z-10 text-white/80 text-xs mt-2 bg-black/50 px-2 py-1 rounded">Image Uploaded - Click to re-upload</span>
                </>
              ) : (
                <span className="text-white/50 text-sm">📤 Upload Inspiration Image (Optional)</span>
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
                  className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 border border-white/20 rounded-xl font-bold transition flex items-center justify-center gap-2"
              >
                {isGenerating ? 'AI is creating...' : '✨ Leave it entirely to AI'}
              </button>
            </div>
          </div>

          {generated && (
            <div className="flex flex-col md:flex-row gap-8 mt-12 pt-8 border-t border-white/10 animate-fade-in">
              <div className="w-full md:w-1/2">
                <img
                  src={generated.imageUrl}
                  alt={generated.title}
                  className="w-full aspect-square rounded-2xl object-cover shadow-2xl shadow-purple-500/20"
                />
              </div>
              <div className="w-full md:w-1/2 flex flex-col justify-center">
                <div className="mb-6">
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full font-bold mb-3 inline-block">
                    Autonomous AI Output
                  </span>
                  <h4 className="text-3xl font-bold mb-3 text-white">{generated.title}</h4>
                  <div className="bg-black/50 p-5 rounded-xl border border-white/10">
                    <h5 className="text-xs font-bold text-white/50 mb-2 uppercase tracking-widest">AI Interpretation</h5>
                    <p className="text-white/80 text-sm leading-relaxed italic">"{generated.interpretation}"</p>
                  </div>
                </div>

                {mintResult ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                    <h5 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                       Successfully Minted on Etherlink!
                    </h5>
                    <p className="text-sm text-green-400/80 mb-3">
                      This creation is now permanently etched on-chain as a Genesis node.
                    </p>
                    <a href={`https://testnet.explorer.etherlink.com/tx/${mintResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-bold transition"
                    >
                      View on Explorer ↗
                    </a>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <p className="text-xs text-white/40 mb-3">
                      * Low gas and 500ms finality on Etherlink make continuous reinterpretation possible.
                    </p>
                    <button
                      onClick={handleMint}
                      disabled={isMinting || !isConnected}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 rounded-xl font-bold text-lg shadow-lg shadow-purple-500/20 transition"
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
