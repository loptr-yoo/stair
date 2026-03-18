
import { create } from 'zustand';
import { ParkingLayout, ConstraintViolation } from './types';

export type GeminiModelId = 
  | 'gemini-3-pro-preview' 
  | 'gemini-2.5-pro' 
  | 'gemini-2.5-flash'
  | 'gemini-3-flash-preview' 
  | 'gemini-flash-lite-latest';

interface AppState {
  layout: ParkingLayout | null;
  violations: ConstraintViolation[];
  isGenerating: boolean;
  error: string | null;
  logs: string[];
  generationTime: number | null;
  showLabels: boolean;
  selectedModel: GeminiModelId;

  // Actions
  setLayout: (layout: ParkingLayout | null) => void;
  setViolations: (violations: ConstraintViolation[]) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  addLog: (msg: string) => void;
  clearLogs: () => void;
  setGenerationTime: (time: number | null) => void;
  toggleLabels: () => void;
  setSelectedModel: (model: GeminiModelId) => void;
}

export const useStore = create<AppState>((set) => ({
  layout: null,
  violations: [],
  isGenerating: false,
  error: null,
  logs: [],
  generationTime: null,
  showLabels: true,
  selectedModel: 'gemini-2.5-flash', // Default to 2.5 Flash for speed and reliability

  setLayout: (layout) => set({ layout }),
  setViolations: (violations) => set({ violations }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  addLog: (msg) => set((state) => ({ logs: [...state.logs, msg] })),
  clearLogs: () => set({ logs: [] }),
  setGenerationTime: (time) => set({ generationTime: time }),
  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
  setSelectedModel: (model) => set({ selectedModel: model }),
}));
