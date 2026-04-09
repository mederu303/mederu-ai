"use client";

import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { 
  Node, Edge, Background, Controls, useNodesState, useEdgesState, Handle, Position 
} from 'reactflow';
import 'reactflow/dist/style.css';

// 独自デザインのかっこいいパネルノード
const CustomNode = ({ data }: any) => {
  return (
    <div className="bg-[#0a0a0a] border border-emerald-500/30 rounded-xl w-64 shadow-[0_0_20px_rgba(16,185,129,0.1)] overflow-hidden relative group">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 !border-emerald-900 -mt-1" />
      
      {/* 簡易画像のモック（実際のimageUrlがあればimgタグに） */}
      <div className="w-full h-32 bg-[#050505] flex items-center justify-center relative overflow-hidden">
        {data.imageUrl ? (
          <img src={data.imageUrl} className="w-full h-full object-cover" alt="art" />
        ) : (
          <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center">
            <span className="text-zinc-500 text-xs font-bold">Art #{data.id}</span>
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
          Gen {data.generation}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-lg text-zinc-100 font-black tracking-tighter italic mb-2 truncate">{data.title}</h3>
        <p className="text-xs text-zinc-400 line-clamp-3">{data.interpretation}</p>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 !border-emerald-900 -mb-1" />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

import Link from 'next/link';

export default function LineagePage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    // APIからon-chainの系譜データを取得
    const fetchLineage = async () => {
      try {
        const res = await fetch('/api/lineage');
        const { tokens } = await res.json();
        
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const genCounts: Record<number, number> = {};

        tokens.forEach((t: any) => {
          const gen = t.generation || 1;
          genCounts[gen] = (genCounts[gen] || 0) + 1;
          
          // ツリー状にX,Y座標を配置
          const x = (genCounts[gen] - 1) * 300 - 150; // 中央寄せっぽく調整
          const y = (gen - 1) * 300;

          newNodes.push({
            id: String(t.id),
            type: 'custom',
            position: { x, y },
            data: t,
          });

          if (t.parentId && Number(t.parentId) !== 0) {
            newEdges.push({
              id: `e${t.parentId}-${t.id}`,
              source: String(t.parentId),
              target: String(t.id),
              animated: true,
              style: { stroke: '#34d399', strokeWidth: 2 },
            });
          }
        });

        setNodes(newNodes);
        setEdges(newEdges);
      } catch (err) {
        console.error("Failed to fetch lineage", err);
      }
    };
    
    fetchLineage();
  }, [setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  return (
    <main className="w-full h-screen bg-[#050505] flex text-zinc-100 relative font-sans">
      <div className="absolute top-6 left-6 z-10">
        <Link href="/" className="px-5 py-3 bg-[#0a0a0a]/80 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/40 rounded-xl font-bold backdrop-blur-md transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-2 text-sm text-zinc-300 hover:text-emerald-400">
          ← Back to Studio
        </Link>
      </div>

      {/* 画面全体をReact Flowキャンバスに */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#222" gap={16} />
        <Controls className="bg-[#0a0a0a] border-white/10 fill-emerald-400" />
      </ReactFlow>

      {/* ノードクリック時の詳細パネル */}
      {selectedNode && (
        <div className="absolute right-0 top-0 w-96 h-full bg-[#0a0a0a]/90 backdrop-blur-xl border-l border-white/5 p-8 flex flex-col z-10 shadow-2xl animate-fade-in">
          <button 
            onClick={() => setSelectedNode(null)}
            className="text-zinc-500 hover:text-emerald-400 self-end mb-6 font-bold transition-colors"
          >
            ✕ Close
          </button>
          
          <div className="mb-4">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-widest rounded-full font-bold">
              Generation {selectedNode.generation}
            </span>
          </div>
          
          <h2 className="text-3xl font-black mb-6 text-zinc-100 italic tracking-tighter">
            {selectedNode.title || "Untitled AI Art"}
          </h2>
          
          <div className="w-full h-56 bg-[#050505] rounded-2xl mb-6 relative overflow-hidden border border-white/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
             {selectedNode.imageUrl && <img src={selectedNode.imageUrl} className="w-full h-full object-cover" />}
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 mb-3 uppercase tracking-[0.2em]">Philosophical Transmutation</h3>
              <p className="text-sm text-zinc-300 leading-relaxed bg-white/5 border border-white/5 p-5 rounded-xl italic">
                {selectedNode.interpretation || "No interpretation recorded."}
              </p>
            </div>
          </div>
          
          <div className="pt-6 border-t border-white/5 mt-auto">
            <button className="w-full py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-2xl font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              Reinterpret this artwork (Mint Child)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
