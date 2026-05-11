// app/lib/ollama.ts
// Ollama integration for autonomous resolution in the dashboard

const OLLAMA_BASE = process.env.OLLAMA_HOST || 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

export interface OllamaResponse {
  response: string;
  done: boolean;
}

export async function generateWithOllama(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const fullPrompt = systemPrompt
    ? `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${prompt}`
    : prompt;

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const data: OllamaResponse = await res.json();
  return data.response;
}

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
