/** Raw API payload from POST /ai/answer */
export type AiAnswerSourceApi = {
  document_id: string | null
  title: string | null
  source: string | null
  chunk_id: string | null
  score: number | null
  distance: number | null
  metadata?: Record<string, unknown>
}

export type AiAnswerApi = {
  answer: string
  sources: AiAnswerSourceApi[]
  retrieved_count: number
  used_generation: boolean
}

export type AiAnswerRequest = {
  question: string
  top_k?: number
}

export type AiAnswerSource = {
  documentId: string | null
  title: string | null
  source: string | null
  chunkId: string | null
  score: number | null
  distance: number | null
}

export type AiAnswer = {
  answer: string
  sources: AiAnswerSource[]
  retrievedCount: number
  usedGeneration: boolean
}
