/**
 * services/llmProvider.ts
 * 统一 LLM 提供商接口与实现
 */

// CloseAI 文档配置
const CLOSEAI_OPENAI_BASE = "https://api.openai-proxy.org/v1";
const CLOSEAI_GEMINI_BASE = "https://api.openai-proxy.org/google";
const DEEPSEEK_BASE = "https://api.deepseek.com"; // 或您的 DeepSeek 代理地址

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 统一的 LLM 客户端接口
 */
export interface LLMClient {
  chat(messages: ChatMessage[], config: LLMConfig): Promise<string>;
  providerName: string;
}

/**
 * 通用 Fetch 处理，包含错误处理
 */
const safeFetch = async (url: string, options: RequestInit, providerTag: string) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[${providerTag}] API Error (${res.status}): ${errText}`);
    }
    return await res.json();
  } catch (e: any) {
    throw new Error(`[${providerTag}] Network/Request Error: ${e.message}`);
  }
};

/**
 * 1. OpenAI 兼容适配器 (支持 OpenAI & DeepSeek)
 * 参考: https://doc.closeai-asia.com/tutorial/api/openai.html
 */
export class OpenAICompatibleClient implements LLMClient {
  private baseUrl: string;
  public providerName: string;

  constructor(providerName: string, baseUrl: string) {
    this.providerName = providerName;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 去除末尾斜杠
  }

  async chat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    
    const body = {
      model: config.model,
      messages: messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4000,
      stream: false
    };

    const data = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    }, this.providerName);

    return data.choices?.[0]?.message?.content || "";
  }
}

/**
 * 2. Gemini 适配器 (CloseAI 代理模式)
 * 参考: https://doc.closeai-asia.com/tutorial/api/gemini.html
 * 必须将 OpenAI 风格的 messages 转换为 Google 的 contents
 */
export class GeminiClient implements LLMClient {
  public providerName = 'gemini';
  private baseUrl = CLOSEAI_GEMINI_BASE;

  async chat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const url = `${this.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    // 格式转换: OpenAI Messages -> Gemini Contents
    const contents = messages
      .filter(m => m.role !== 'system') 
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
    
    const systemMsg = messages.find(m => m.role === 'system');

    const body: any = {
      contents: contents,
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxTokens ?? 8192,
        responseMimeType: "application/json" 
      }
    };

    if (systemMsg) {
      body.systemInstruction = {
        parts: [{ text: systemMsg.content }]
      };
    }

    const data = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 'gemini');

    console.log("[GeminiClient] Raw API Data:", JSON.stringify(data));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn("[GeminiClient] No text found in response candidates.");
      return "";
    }
    return text;
  }
}

// 工厂函数：获取对应客户端
export const createLLMClient = (provider: 'gemini' | 'deepseek' | 'openai'): LLMClient => {
  switch (provider) {
    case 'gemini':
      return new GeminiClient();
    case 'openai':
      return new OpenAICompatibleClient('openai', CLOSEAI_OPENAI_BASE);
    case 'deepseek':
      return new OpenAICompatibleClient('deepseek', DEEPSEEK_BASE);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};
