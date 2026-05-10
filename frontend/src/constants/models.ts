import type { Agent } from '../components/ui/Agent'

/*
 * Development-only allow-list of OpenRouter model IDs.
 * Backend validation of these IDs is a follow-up to prevent misuse.
 */
export const ALLOWED_MODELS = [
  { id: 'openrouter/free', label: 'OpenRouter Free' },
  { id: 'google/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek v4 Flash' },
  { id: 'minimax/minimax-m2.7', label: 'MiniMax M2.7' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'qwen/qwen3.6-plus', label: 'Qwen 3.6 Plus' },
  { id: 'openai/gpt-5.4-nano', label: 'GPT-5.4 Nano' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B' },
] as const

export const MODEL_STORAGE_KEY = 'synapse:agent-models:v1'

export const DEFAULT_AGENT_MODELS: Record<Agent, string> = {
  scout: 'openrouter/free',
  scribe: 'openrouter/free',
  critic: 'openrouter/free',
}
