import { useState } from "react"
import { motion } from "framer-motion"

import { AiQuestionForm } from "@/components/ai-assistant/ai-question-form"
import { AiResultPanel } from "@/components/ai-assistant/ai-result-panel"
import { generateAiAnswer } from "@/services/ai"
import type { AiAnswer } from "@/types/ai"
import { getApiErrorMessage } from "@/utils/api-error"

type ResultStatus = "idle" | "loading" | "success" | "error"

export function AiAssistantBoard() {
  const [question, setQuestion] = useState("")
  const [lastQuestion, setLastQuestion] = useState("")
  const [status, setStatus] = useState<ResultStatus>("idle")
  const [result, setResult] = useState<AiAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ask = async (value: string) => {
    const cleaned = value.trim()
    if (!cleaned || status === "loading") return

    setLastQuestion(cleaned)
    setStatus("loading")
    setError(null)
    setResult(null)

    try {
      const data = await generateAiAnswer(cleaned, 5)
      setResult(data)
      setStatus("success")
    } catch (requestError) {
      setResult(null)
      setError(
        getApiErrorMessage(
          requestError,
          "Unable to generate an answer from your knowledge base.",
        ),
      )
      setStatus("error")
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          AI Assistant
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ask a question and get an answer grounded in your published knowledge
          base. The assistant does not invent facts when nothing relevant is
          retrieved.
        </p>
      </motion.div>

      <AiQuestionForm
        question={question}
        isLoading={status === "loading"}
        onQuestionChange={setQuestion}
        onSubmit={() => void ask(question)}
      />

      <AiResultPanel
        status={status}
        result={result}
        error={error}
        onRetry={() => void ask(lastQuestion || question)}
      />
    </div>
  )
}
