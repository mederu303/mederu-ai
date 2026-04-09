"use client";

import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { 
  Node, Edge, Background, Controls, useNodesState, useEdgesState, Handle, Position 
} from 'reactflow';
import 'reactflow/dist/style.css';

// 独自デザインのかっこいいパネルノード
const CustomNode = ({ data }: any) => {
  return (
    <div className="bg-gray-900 border border-purple-500/50 rounded-xl w-64 shadow-xl shadow-purple-500/20 overflow-hidden relative group">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 !border-gray-900 -mt-1" />
      
      {/* 簡易画像のモック（実際のimageUrlがあればimgタグに） */}
      <div className="w-full h-32 bg-gray-800 flex items-center justify-center relative overflow-hidden">
        {data.imageUrl ? (
          <img src={data.imageUrl} className="w-full h-full object-cover" alt="art" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
            <span className="text-white/30 text-xs font-bold">Art #{data.id}</span>
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-purple-300 font-bold">
          Gen {data.generation}
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm text-white font-bold mb-1 truncate">{data.title}</h3>
        <p className="text-xs text-white/60 line-clamp-2">{data.interpretation}</p>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-pink-500 !border-gray-900 -mb-1" />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

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
              style: { stroke: '#c084fc', strokeWidth: 2 },
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
    <main className="w-full h-screen bg-black flex text-white relative">
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
        <Background color="#444" gap={16} />
        <Controls className="bg-gray-800 border-gray-700 fill-white" />
      </ReactFlow>

      {/* ノードクリック時の詳細パネル */}
      {selectedNode && (
        <div className="absolute right-0 top-0 w-96 h-full bg-black/80 backdrop-blur-md border-l border-white/10 p-6 flex flex-col z-10 shadow-2xl animate-fade-in">
          <button 
            onClick={() => setSelectedNode(null)}
            className="text-white/50 hover:text-white self-end mb-4 font-bold"
          >
            ✕ Close
          </button>
          
          <div className="mb-4">
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full font-bold">
              Generation {selectedNode.generation}
            </span>
          </div>
          
          <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            {selectedNode.title || "Untitled AI Art"}
          </h2>
          
          <div className="w-full h-48 bg-gray-800 rounded-xl mb-6 relative overflow-hidden">
             {selectedNode.imageUrl && <img src={selectedNode.imageUrl} className="w-full h-full object-cover" />}
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            <div>
              <h3 className="text-sm font-bold text-white/70 mb-2">AI Interpretation</h3>
              <p className="text-sm text-white/90 leading-relaxed bg-white/5 p-4 rounded-lg">
                {selectedNode.interpretation || "No interpretation recorded."}
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-white/10 mt-4">
            <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold transition shadow-lg shadow-purple-500/20">
              Reinterpret this artwork (Mint Child)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
