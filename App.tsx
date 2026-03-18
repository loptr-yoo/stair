
import React, { useRef, useEffect, useState } from 'react';
// Added BrainCircuit import
import { BrainCircuit } from 'lucide-react';
import MapRenderer, { MapRendererHandle } from './components/MapRenderer';
import LayoutControl from './components/LayoutControl';
import { generateParkingLayout, refineFloorPlan } from './services/geminiService';
import { useStore } from './store';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const { 
    layout, violations, isGenerating, error, logs, selectedModel,
    setLayout, setViolations, setIsGenerating, setError, addLog, setGenerationTime, clearLogs, setSelectedModel
  } = useStore();

  const mapRef = useRef<MapRendererHandle>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const lastPromptRef = useRef<string>("");

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setError(null);
      addLog("API Key selection triggered.");
    }
  };

  const handleGenerate = async (prompt: string) => {
    lastPromptRef.current = prompt;
    setIsGenerating(true);
    setError(null);
    clearLogs();
    setGenerationTime(null);
    const startTime = Date.now();
    
    try {
      const newLayout = await generateParkingLayout(prompt, selectedModel, addLog);
      setLayout(newLayout);
      setViolations([]); 
      addLog("Generation complete.");
    } catch (e: any) {
      console.error("App Error:", e);
      const msg = e.message || "";
      
      if (msg === "404_NOT_FOUND") {
        setHasKey(false);
        setError(`Error 404: 模型 ${selectedModel} 当前不可用。请点击“设置 Key”关联付费项目。`);
      } else if (msg === "429_QUOTA_EXCEEDED") {
        setError(`Error 429: 配额不足。模型 ${selectedModel} (免费版) 呼叫太频繁。`);
      } else {
        setError(msg.includes("API_RETRY_FAILED") ? "API 请求多次重试失败，请稍后再试或更换模型。" : (msg || "生成失败，请重试。"));
      }
    } finally {
      setIsGenerating(false);
      setGenerationTime((Date.now() - startTime) / 1000);
    }
  };

  const handleRefine = async () => {
    if (!layout) return;
    setIsGenerating(true);
    addLog("--- Refinement ---");
    const startTime = Date.now();
    
    try {
      const augmented = await refineFloorPlan(layout, selectedModel, addLog);
      if (augmented && augmented.elements.length > 0) {
        setLayout(augmented);
        setViolations([]);
        addLog("Refinement complete.");
      }
    } catch (e: any) {
      const msg = e.message || "";
      if (msg === "429_QUOTA_EXCEEDED") {
        setError(`细化操作因配额限制失败。建议等待 60 秒后重试。`);
      } else {
        setError("细化布局失败。");
      }
    } finally {
      setIsGenerating(false);
      setGenerationTime((Date.now() - startTime) / 1000);
    }
  };

  const handleDownload = () => {
      if (mapRef.current) {
          mapRef.current.downloadJpg();
      }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <header className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-white">
                <span className="text-blue-500">P</span>arking<span className="text-purple-500">V</span>iz
                <span className="ml-2 text-xs font-normal text-slate-500">AI-Powered Spatial Designer</span>
            </h1>
            <div className="flex items-center gap-4 text-xs">
               {!hasKey && (
                 <button 
                  onClick={handleSelectKey}
                  className="flex items-center gap-1 text-amber-500 hover:text-amber-400 font-bold transition-colors"
                 >
                   ⚠️ 切换付费项目以解除 {selectedModel} 限制
                 </button>
               )}
            </div>
        </header>

        {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded mb-4 text-sm flex flex-col gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-start">
                  <span className="font-medium leading-relaxed">{error}</span>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded">✕</button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {error.includes("429") && (
                       <button 
                        onClick={() => handleGenerate(lastPromptRef.current)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm"
                      >
                        立即重试 (Retrying)
                      </button>
                    )}
                    <button 
                      onClick={() => { setSelectedModel('gemini-3-flash-preview'); setError(null); }}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm"
                    >
                      切换到 Flash 3 (无配额限制)
                    </button>
                    <button 
                      onClick={handleSelectKey}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs transition-colors border border-slate-700"
                    >
                      更换付费 API Key
                    </button>
                </div>
            </div>
        )}

        <main className="flex-1 min-h-0 relative">
            {layout ? <MapRenderer ref={mapRef} /> : (
                <div className="w-full h-full flex flex-col items-center justify-center border border-slate-800 rounded-lg bg-slate-900/50 gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center shadow-inner">
                      <BrainCircuit className="w-8 h-8 text-slate-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-slate-200 font-bold">准备开始设计</p>
                        <p className="text-slate-500 text-sm mt-1">在右侧面板输入描述，使用 {selectedModel} 引擎生成。</p>
                    </div>
                </div>
            )}
        </main>
      </div>

      <LayoutControl 
        onGenerate={handleGenerate} 
        onRefine={handleRefine}
        onDownload={handleDownload}
        onSelectKey={handleSelectKey}
      />
    </div>
  );
};

export default App;
