import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Plus } from "lucide-react"

import { KnowledgeDocumentDetail } from "@/components/knowledge-base/knowledge-document-detail"
import { KnowledgeDocumentForm } from "@/components/knowledge-base/knowledge-document-form"
import { KnowledgeDocumentList } from "@/components/knowledge-base/knowledge-document-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  emptyKnowledgeFormValues,
  formValuesFromDocument,
  matchesKnowledgeSearch,
  toCreatePayload,
  toUpdatePayload,
} from "@/lib/knowledge-mappers"
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  ingestKnowledgeDocument,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
} from "@/services/knowledge"
import type {
  KnowledgeDocument,
  KnowledgeDocumentFormValues,
} from "@/types/knowledge"
import { getApiErrorMessage } from "@/utils/api-error"

type PanelMode = "closed" | "create" | "edit" | "view" | "delete"

export function KnowledgeBaseBoard() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [search, setSearch] = useState("")
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [panelMode, setPanelMode] = useState<PanelMode>("closed")
  const [activeDocument, setActiveDocument] = useState<KnowledgeDocument | null>(
    null,
  )
  const [formValues, setFormValues] = useState<KnowledgeDocumentFormValues>(
    emptyKnowledgeFormValues(),
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const data = await listKnowledgeDocuments()
      setDocuments(data)
    } catch (error) {
      setListError(
        getApiErrorMessage(error, "Unable to load knowledge documents."),
      )
      setDocuments([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const filteredDocuments = useMemo(
    () => documents.filter((document) => matchesKnowledgeSearch(document, search)),
    [documents, search],
  )

  const closePanel = () => {
    setPanelMode("closed")
    setActiveDocument(null)
    setFormError(null)
    setDetailError(null)
    setIngestError(null)
    setFormValues(emptyKnowledgeFormValues())
  }

  const openCreate = () => {
    setActiveDocument(null)
    setFormValues(emptyKnowledgeFormValues())
    setFormError(null)
    setPanelMode("create")
  }

  const openEdit = (document: KnowledgeDocument) => {
    setActiveDocument(document)
    setFormValues(formValuesFromDocument(document))
    setFormError(null)
    setPanelMode("edit")
  }

  const openView = async (document: KnowledgeDocument) => {
    setActiveDocument(document)
    setDetailError(null)
    setIngestError(null)
    setPanelMode("view")
    setDetailLoading(true)
    try {
      const fresh = await getKnowledgeDocument(document.id)
      setActiveDocument(fresh)
      setDocuments((current) =>
        current.map((item) => (item.id === fresh.id ? fresh : item)),
      )
    } catch (error) {
      setDetailError(
        getApiErrorMessage(error, "Unable to load this document."),
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const openDelete = (document: KnowledgeDocument) => {
    setActiveDocument(document)
    setFormError(null)
    setPanelMode("delete")
  }

  const handleCreate = async () => {
    setIsSaving(true)
    setFormError(null)
    try {
      const created = await createKnowledgeDocument(toCreatePayload(formValues))
      setDocuments((current) => [created, ...current])
      closePanel()
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Unable to create document."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!activeDocument) return
    setIsSaving(true)
    setFormError(null)
    try {
      const updated = await updateKnowledgeDocument(
        activeDocument.id,
        toUpdatePayload(formValues),
      )
      setDocuments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      closePanel()
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Unable to update document."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeDocument) return
    setDeletingId(activeDocument.id)
    setFormError(null)
    try {
      await deleteKnowledgeDocument(activeDocument.id)
      setDocuments((current) =>
        current.filter((item) => item.id !== activeDocument.id),
      )
      closePanel()
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Unable to delete document."))
    } finally {
      setDeletingId(null)
    }
  }

  const handleIngest = async (document: KnowledgeDocument) => {
    setIngestingId(document.id)
    setIngestError(null)
    try {
      const result = await ingestKnowledgeDocument(document.id)
      setActiveDocument(result.document)
      setDocuments((current) =>
        current.map((item) =>
          item.id === result.document.id ? result.document : item,
        ),
      )
    } catch (error) {
      setIngestError(
        getApiErrorMessage(error, "Unable to re-ingest this document."),
      )
    } finally {
      setIngestingId(null)
    }
  }

  const panelOpen = panelMode !== "closed"
  const panelTitle =
    panelMode === "create"
      ? "New document"
      : panelMode === "edit"
        ? "Edit document"
        : panelMode === "delete"
          ? "Delete document"
          : "Document"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BookOpen className="size-3.5" />
            Knowledge
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Knowledge Base
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage support articles and policies that will power AI answers
            later.
          </p>
        </div>
        <Button type="button" className="rounded-2xl" onClick={openCreate}>
          <Plus className="size-4" />
          New document
        </Button>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, content, or tags…"
          aria-label="Search knowledge documents"
          className="h-11 rounded-2xl bg-background"
        />
      </div>

      <KnowledgeDocumentList
        documents={filteredDocuments}
        isLoading={listLoading}
        error={listError}
        onRetry={() => void loadDocuments()}
        onView={(document) => void openView(document)}
        onEdit={openEdit}
        onDelete={openDelete}
        deletingId={deletingId}
      />

      <Sheet
        open={panelOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving && !deletingId && !ingestingId) {
            closePanel()
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border/70 px-4 py-4 text-left">
            <SheetTitle>{panelTitle}</SheetTitle>
          </SheetHeader>

          {panelMode === "create" ? (
            <KnowledgeDocumentForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={() => void handleCreate()}
              onCancel={closePanel}
              submitLabel="Create document"
              isSaving={isSaving}
              error={formError}
            />
          ) : null}

          {panelMode === "edit" ? (
            <KnowledgeDocumentForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={() => void handleUpdate()}
              onCancel={closePanel}
              submitLabel="Save changes"
              isSaving={isSaving}
              error={formError}
            />
          ) : null}

          {panelMode === "view" && activeDocument ? (
            detailLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading document…
              </div>
            ) : detailError ? (
              <div className="space-y-3 px-4 py-6">
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {detailError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={closePanel}
                >
                  Close
                </Button>
              </div>
            ) : (
              <KnowledgeDocumentDetail
                document={activeDocument}
                onEdit={() => openEdit(activeDocument)}
                onClose={closePanel}
                onIngest={() => void handleIngest(activeDocument)}
                isIngesting={ingestingId === activeDocument.id}
                ingestError={ingestError}
              />
            )
          ) : null}

          {panelMode === "delete" && activeDocument ? (
            <div className="flex flex-1 flex-col">
              <div className="flex-1 space-y-3 px-4 py-5">
                <p className="text-sm text-foreground">
                  Delete{" "}
                  <span className="font-semibold">{activeDocument.title}</span>?
                  This cannot be undone.
                </p>
                {formError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {formError}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={closePanel}
                  disabled={Boolean(deletingId)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl bg-rose-600 text-white hover:bg-rose-700"
                  onClick={() => void handleDelete()}
                  disabled={Boolean(deletingId)}
                >
                  {deletingId ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
