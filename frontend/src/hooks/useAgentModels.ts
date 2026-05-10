import { useCallback, useState } from 'react'
import { z } from 'zod'

import type { Agent } from '../components/ui/Agent'
import { ALLOWED_MODELS, DEFAULT_AGENT_MODELS, MODEL_STORAGE_KEY } from '../constants/models'

const allowedModelIds: string[] = ALLOWED_MODELS.map((m) => m.id)

const storedSchema = z.object({
  scout: z.string().refine((v: string) => allowedModelIds.includes(v)),
  scribe: z.string().refine((v: string) => allowedModelIds.includes(v)),
  critic: z.string().refine((v: string) => allowedModelIds.includes(v)),
})

function readStored(): Record<Agent, string> {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY)
    if (!raw) return DEFAULT_AGENT_MODELS
    const parsed = JSON.parse(raw) as unknown
    const validated = storedSchema.parse(parsed)
    return validated
  } catch {
    return DEFAULT_AGENT_MODELS
  }
}

export function useAgentModels() {
  const [models, setModels] = useState<Record<Agent, string>>(readStored)

  const setModel = useCallback((agent: Agent, modelId: string) => {
    setModels((prev) => ({ ...prev, [agent]: modelId }))
  }, [])

  const persist = useCallback(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models))
    } catch {
      // localStorage throws in private mode; ignore silently.
    }
  }, [models])

  return { models, setModel, persist }
}
