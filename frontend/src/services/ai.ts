import { api } from "@/services/api"
import type {
  AiAnswer,
  AiAnswerApi,
  AiAnswerRequest,
  AiAnswerSource,
} from "@/types/ai"

const DEFAULT_TOP_K = 5

function mapSource(source: AiAnswerApi["sources"][number]): AiAnswerSource {
  return {
    documentId: source.document_id,
    title: source.title,
    source: source.source,
    chunkId: source.chunk_id,
    score: source.score,
    distance: source.distance,
  }
}

export function mapAiAnswer(payload: AiAnswerApi): AiAnswer {
  return {
    answer: payload.answer,
    sources: (payload.sources ?? []).map(mapSource),
    retrievedCount: payload.retrieved_count,
    usedGeneration: payload.used_generation,
  }
}

export async function generateAiAnswer(
  question: string,
  topK = DEFAULT_TOP_K,
): Promise<AiAnswer> {
  const body: AiAnswerRequest = {
    question: question.trim(),
    top_k: topK,
  }
  const { data } = await api.post<AiAnswerApi>("/ai/answer", body)
  return mapAiAnswer(data)
}
