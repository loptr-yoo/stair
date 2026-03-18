
import { jsonrepair } from "jsonrepair";
import { ParkingLayout, ElementType, ConstraintViolation, LayoutElement } from "../types";
import { validateLayout } from "../utils/geometry";
import { PROMPTS } from "../utils/prompts";
import { GeminiModelId } from "../store";
import { createLLMClient, LLMClient, ChatMessage } from "./llmProvider";

const API_KEY = 'sk-ZmhOmhr1tInDd8BBzFmYk5S3J8ix3G6hahacoc27w1JYEyeP';
const llmClient = createLLMClient('gemini');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mergeLayoutElements = (original: LayoutElement[], updates: LayoutElement[]): LayoutElement[] => {
  const elementMap = new Map(original.map(el => [el.id, el]));
  updates.forEach(update => {
    const id = update.id || `el_${Math.random().toString(36).substr(2, 9)}`;
    elementMap.set(id, { ...update, id });
  });
  return Array.from(elementMap.values());
};

const postProcessLayout = (layout: ParkingLayout): ParkingLayout => {
    return {
        ...layout,
        elements: layout.elements.map(el => ({
            ...el,
            x: Math.round(el.x),
            y: Math.round(el.y),
            width: Math.round(el.width),
            height: Math.round(el.height)
        }))
    };
};

const normalizeType = (t: string | undefined): string => {
  if (!t) return ElementType.WALL_INTERNAL;
  const lower = t.toLowerCase().trim().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    'exterior_wall': ElementType.WALL_EXTERNAL, 
    'partition_wall': ElementType.WALL_INTERNAL,
    'slab': ElementType.SLAB, 
    'pillar': ElementType.PILLAR,
    'elevator_shaft': ElementType.ELEVATOR_SHAFT, 
    'staircase': ElementType.STAIRCASE,
    'corridor': ElementType.CORRIDOR, 
    'living_room': ElementType.LIVING_ZONE,
    'bedroom': ElementType.BEDROOM_ZONE, 
    'kitchen': ElementType.KITCHEN_ZONE,
    'bathroom': ElementType.BATHROOM_ZONE, 
    'door': ElementType.DOOR, 
    'window': ElementType.WINDOW,
    'fire_door': ElementType.FIRE_DOOR
  };
  return map[lower] || lower;
};

const cleanAndParseJSON = (text: string): any => {
  if (!text || text.trim() === "") return { elements: [] };
  
  try {
    console.log("AI Raw Response:", text);
    let cleanText = text.replace(/```json\s*|```/g, "").trim();
    
    // Find the first '{' or '[' and the last '}' or ']'
    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');
    const firstOpen = (firstBrace !== -1 && firstBracket !== -1) 
      ? Math.min(firstBrace, firstBracket) 
      : (firstBrace !== -1 ? firstBrace : firstBracket);
      
    const lastBrace = cleanText.lastIndexOf('}');
    const lastBracket = cleanText.lastIndexOf(']');
    const lastClose = Math.max(lastBrace, lastBracket);
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      cleanText = cleanText.substring(firstOpen, lastClose + 1);
    }
    
    // Attempt to repair truncated or malformed JSON
    let repaired = "";
    try {
      repaired = jsonrepair(cleanText);
    } catch (repairErr) {
      console.warn("jsonrepair failed, attempting manual fix for truncation:", repairErr);
      // If it's truncated, try to close it manually as a last resort
      repaired = cleanText;
      if (!repaired.endsWith('}')) repaired += '"}'; // Close string and object
      try {
        repaired = jsonrepair(repaired);
      } catch (e) {
        throw repairErr; // Re-throw original repair error if manual fix fails
      }
    }

    try {
      return JSON.parse(repaired);
    } catch (parseErr) {
      console.error("JSON.parse failed on repaired text:", repaired);
      throw parseErr;
    }
  } catch (e) {
    console.error("AI Parse Error. Raw text:", text);
    // Return a minimal valid structure instead of crashing the whole flow
    return { reasoning_plan: "AI response was too malformed to parse.", elements: [] };
  }
};

const mapToInternalLayout = (rawData: any): ParkingLayout => {
    // If AI returns an array directly, wrap it in an object
    const data = Array.isArray(rawData) ? { elements: rawData } : rawData;
    
    return {
        width: Number(data.width || 800),
        height: Number(data.height || 600),
        elements: (data.elements || []).map((e: any) => ({
            id: String(e.id || `el_${Math.random().toString(36).substr(2, 9)}`),
            type: normalizeType(e.t || e.type),
            x: Number(e.x || 0),
            y: Number(e.y || 0),
            width: Number(e.w ?? e.width ?? 10),
            height: Number(e.h ?? e.height ?? 10),
            rotation: Number(e.r || 0),
            label: e.l
        }))
    };
};

const generateWithRetry = async (client: LLMClient, model: string, messages: ChatMessage[], retries = 3) => {
    for (let i = 0; i <= retries; i++) {
        try {
            const responseText = await client.chat(messages, {
                apiKey: API_KEY,
                model: model,
                temperature: 0.2,
            });
            return responseText;
        } catch (e: any) {
            const errorMsg = e.message || "";
            if ((errorMsg.includes("429") || errorMsg.includes("quota")) && i < retries) {
              await sleep(6000 * Math.pow(2, i));
              continue;
            }
            throw e;
        }
    }
    throw new Error("API_RETRY_FAILED");
};

const runIterativeFix = async (layout: ParkingLayout, client: LLMClient, model: GeminiModelId, onLog?: (m: string) => void, maxPasses = 1): Promise<ParkingLayout> => {
    let currentLayout = layout;
    for (let pass = 1; pass <= maxPasses; pass++) {
        const violations = validateLayout(currentLayout);
        if (violations.length === 0) break;
        
        onLog?.(`🔧 Topological Verification...`);
        const simplified = {
            width: currentLayout.width,
            height: currentLayout.height,
            elements: currentLayout.elements.map(e => ({ id: e.id, t: e.type, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.width), h: Math.round(e.height) }))
        };

        try {
            const messages: ChatMessage[] = [
                { role: 'system', content: "You are a Topological Constraint Solver. You MUST return valid JSON only." },
                { role: 'user', content: PROMPTS.fix(simplified as any, violations) }
            ];
            const responseText = await generateWithRetry(client, model, messages, 0);
            const rawData = cleanAndParseJSON(responseText || "{}");
            const fixedLayout = mapToInternalLayout(rawData);
            currentLayout = { ...currentLayout, elements: mergeLayoutElements(currentLayout.elements, fixedLayout.elements) };
        } catch (e: any) { break; }
    }
    return currentLayout;
};

export const generateParkingLayout = async (description: string, modelId: GeminiModelId, onLog?: (msg: string) => void): Promise<ParkingLayout> => {
  try {
    onLog?.(`🏗️ Phase 1: Spatial Synthesis (${modelId})`);
    const messages: ChatMessage[] = [
        { role: 'system', content: "You are a Structural Architectural Planner. You MUST return valid JSON only." },
        { role: 'user', content: PROMPTS.generation(description) }
    ];
    const responseText = await generateWithRetry(llmClient, modelId, messages);
    const rawData = cleanAndParseJSON(responseText);
    if (rawData.reasoning_plan && onLog) onLog(`🧠 Plan: ${rawData.reasoning_plan}`);
    let layout = mapToInternalLayout(rawData);
    layout = await runIterativeFix(layout, llmClient, modelId, onLog, 2);
    return postProcessLayout(layout);
  } catch (error: any) { throw error; }
};

export const refineFloorPlan = async (currentLayout: ParkingLayout, modelId: GeminiModelId, onLog?: (msg: string) => void): Promise<ParkingLayout> => {
  try {
    onLog?.(`🛋️ Phase 2: Interior Detail (${modelId})`);
    const simplified = currentLayout.elements.map(e => ({ id: e.id, t: e.type, x: e.x, y: e.y, w: e.width, h: e.height }));
    const messages: ChatMessage[] = [
        { role: 'system', content: "You are an Interior Layout Engine. You MUST return valid JSON only." },
        { role: 'user', content: PROMPTS.refinement({ elements: simplified }, currentLayout.width, currentLayout.height) }
    ];
    const responseText = await generateWithRetry(llmClient, modelId, messages);
    
    const rawData = cleanAndParseJSON(responseText);
    const newElements = mapToInternalLayout(rawData).elements;
    
    if (newElements.length > 0) {
        onLog?.(`✨ Distributed ${newElements.length} semantic fixtures.`);
    }

    let layout: ParkingLayout = { ...currentLayout, elements: mergeLayoutElements(currentLayout.elements, newElements) };
    layout = await runIterativeFix(layout, llmClient, modelId, onLog, 2);
    return postProcessLayout(layout);
  } catch (error: any) { throw error; }
};

export const augmentLayoutWithRoads = refineFloorPlan;
