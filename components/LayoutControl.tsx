
import React, { useState } from 'react';
import { Layers, Map as MapIcon, Sparkles, Download, Key, Eye, EyeOff, Info, Cpu, Zap, Activity, BrainCircuit, Code, FileJson } from 'lucide-react';
import { useStore, GeminiModelId } from '../store';
import { ElementType } from '../types';
import { ELEMENT_STYLES } from './MapRenderer';
import { generatePythonScript, downloadTextFile, downloadJson } from '../utils/exporters';

interface Props {
  onGenerate: (p: string) => void;
  onRefine: () => void;
  onDownload: () => void;
  onSelectKey: () => void;
}

const LayoutControl: React.FC<Props> = ({ onGenerate, onRefine, onDownload, onSelectKey }) => {
  const { isGenerating, violations, layout, logs, showLabels, toggleLabels, selectedModel, setSelectedModel } = useStore();
  const [prompt, setPrompt] = useState("L-shaped residential unit, primary bedroom in corner, large living area, kitchen near entrance, wide external walls.");
  const hasLayout = !!layout;

  const models: { id: GeminiModelId; name: string; icon: any; desc: string; color: string }[] = [
    { id: 'gemini-flash-lite-latest', name: 'Lite', icon: Activity, desc: 'Fastest & Lightest', color: 'text-emerald-400' },
    { id: 'gemini-3-flash-preview', name: 'Flash 3', icon: Zap, desc: 'Balanced / Reliable', color: 'text-amber-400' },
    { id: 'gemini-2.5-pro', name: '2.5 Pro', icon: BrainCircuit, desc: 'High-Level Reasoning (Free)', color: 'text-blue-400' },
    { id: 'gemini-3-pro-preview', name: '3 Pro', icon: Cpu, desc: 'Maximum Precision (Paid/Key)', color: 'text-purple-400' },
  ];

  const handleExportPython = () => {
    if (!layout) return;
    const script = generatePythonScript(layout);
    downloadTextFile(script, `visualize_layout_${Date.now()}.py`);
  };

  const handleExportJson = () => {
    if (!layout) return;
    downloadJson(layout);
  };

  const structureLegend = [
    { label: 'Exterior Wall', type: ElementType.WALL_EXTERNAL },
    { label: 'Internal Wall', type: ElementType.WALL_INTERNAL },
    { label: 'Stairs (Amber)', type: ElementType.STAIRCASE },
    { label: 'Elevator (Red)', type: ElementType.ELEVATOR_SHAFT },
  ];

  return (
    <div className="w-full md:w-80 flex-shrink-0 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto flex flex-col gap-5 custom-scrollbar">
      
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" /> Floor Plan Panel
        </h2>
        <button 
          onClick={onSelectKey}
          title="Select API Key"
          className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-blue-400 transition-colors"
        >
          <Key size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2">
           <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Intelligence Model</label>
           <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
             {models.map((m) => {
               const Icon = m.icon;
               const isSelected = selectedModel === m.id;
               return (
                 <button
                   key={m.id}
                   onClick={() => setSelectedModel(m.id)}
                   className={`flex items-center gap-2 py-2 px-2 rounded-md transition-all ${isSelected ? 'bg-slate-800 shadow-sm border border-slate-700' : 'hover:bg-slate-900 opacity-60'}`}
                 >
                   <Icon size={12} className={m.color} />
                   <span className="text-[10px] font-bold text-slate-200">{m.name}</span>
                 </button>
               );
             })}
           </div>
           <p className="text-[9px] text-slate-500 italic px-1">
             {models.find(m => m.id === selectedModel)?.desc}
           </p>
        </div>

        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mt-2">Project Brief</label>
        <textarea 
          className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-sm text-slate-200 h-20 resize-none focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Describe room distribution..."
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
        />
        
        <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-2">
                {showLabels ? <Eye size={14} /> : <EyeOff size={14} />} Semantic Labels
            </span>
            <button 
              onClick={toggleLabels}
              className={`w-10 h-5 rounded-full relative transition-colors ${showLabels ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showLabels ? 'left-6' : 'left-1'}`} />
            </button>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
            <button onClick={() => onGenerate(prompt)} disabled={isGenerating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
                {isGenerating && !hasLayout ? <span className="animate-pulse">Reasoning...</span> : <><MapIcon size={16}/> Build Floor Plan</>}
            </button>
            <button onClick={onRefine} disabled={isGenerating || !hasLayout}
                className="w-full border-2 border-purple-500/50 text-purple-300 hover:bg-purple-900/20 disabled:opacity-30 text-sm font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all">
                 <Sparkles size={16}/> Detail Furnishing
            </button>
            
            <div className="grid grid-cols-3 gap-2">
                <button onClick={onDownload} disabled={!hasLayout}
                    className="border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 text-[9px] font-medium py-2 rounded-lg flex items-center justify-center gap-1 transition-all">
                    <Download size={12}/> IMG
                </button>
                <button onClick={handleExportJson} disabled={!hasLayout}
                    className="border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 text-[9px] font-medium py-2 rounded-lg flex items-center justify-center gap-1 transition-all">
                    <FileJson size={12}/> JSON
                </button>
                <button onClick={handleExportPython} disabled={!hasLayout}
                    className="border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 text-[9px] font-medium py-2 rounded-lg flex items-center justify-center gap-1 transition-all">
                    <Code size={12}/> PY
                </button>
            </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Info size={12}/> Color Legend
        </h3>
        
        <div className="space-y-2 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
            <div className="text-[9px] text-slate-500 font-bold mb-1">STRUCTURE</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {structureLegend.map((item) => (
                    <div key={item.type} className="flex items-center gap-2">
                        <div 
                            className="w-3 h-3 rounded-none border-none shadow-sm" 
                            style={{ backgroundColor: ELEMENT_STYLES[item.type]?.fill, opacity: ELEMENT_STYLES[item.type]?.opacity }}
                        />
                        <span className="text-[9px] text-slate-300 truncate">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col pt-2">
        <div className="flex justify-between mb-2 text-sm text-slate-300">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Compliance</h3>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${violations.length ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                {violations.length ? `${violations.length} Issues` : 'Safe'}
            </span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-[9px]">
            {logs.length > 0 && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-slate-500 leading-relaxed max-h-32 overflow-y-auto">
                    {logs.map((l, i) => <div key={i} className="mb-0.5 border-b border-slate-900 pb-0.5 last:border-0">&gt; {l}</div>)}
                </div>
            )}
            
            {violations.map((v, i) => (
                <div key={i} className="bg-red-950/20 border-l-2 border-red-500 p-2 text-red-300 rounded-r shadow-sm">
                    <span className="font-bold opacity-75 mr-1">{v.type.toUpperCase()}:</span> {v.message}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default LayoutControl;
