import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Users } from "lucide-react"

import { CustomerDetailPanel } from "@/components/customers/customer-detail"
import { CustomerForm } from "@/components/customers/customer-form"
import { CustomerList } from "@/components/customers/customer-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  customerDisplayName,
  emptyCustomerFormValues,
  formValuesFromCustomer,
  toCreatePayload,
  toUpdatePayload,
  validateCustomerForm,
} from "@/lib/customer-mappers"
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "@/services/customers"
import type { Customer, CustomerFormValues } from "@/types/customers"
import { getApiErrorMessage } from "@/utils/api-error"

type PanelMode = "closed" | "create" | "edit" | "view" | "delete"

const CUSTOMERS_QUERY_KEY = ["customers"] as const

export function CustomersBoard() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [panelMode, setPanelMode] = useState<PanelMode>("closed")
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null)
  const [formValues, setFormValues] = useState<CustomerFormValues>(
    emptyCustomerFormValues(),
  )
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  const listQuery = useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, "list", debouncedSearch],
    queryFn: () => listCustomers(debouncedSearch || undefined),
    placeholderData: keepPreviousData,
  })

  const detailQuery = useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, "detail", activeCustomer?.id],
    queryFn: () => getCustomer(activeCustomer!.id),
    enabled: panelMode === "view" && Boolean(activeCustomer?.id),
  })

  const customers = listQuery.data ?? []
  const listError = listQuery.isError
    ? getApiErrorMessage(listQuery.error, "Unable to load customers.")
    : null

  const resetPanel = () => {
    setPanelMode("closed")
    setActiveCustomer(null)
    setFormError(null)
    setFormValues(emptyCustomerFormValues())
  }

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createCustomer>[0]) =>
      createCustomer(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
      resetPanel()
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to create customer."))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      customerId,
      values,
    }: {
      customerId: string
      values: CustomerFormValues
    }) => updateCustomer(customerId, toUpdatePayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
      resetPanel()
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to update customer."))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => deleteCustomer(customerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
      resetPanel()
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to delete customer."))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending
  const deletingId = deleteMutation.isPending ? activeCustomer?.id ?? null : null
  const panelOpen = panelMode !== "closed"

  const panelTitle = useMemo(() => {
    if (panelMode === "create") return "New customer"
    if (panelMode === "edit") return "Edit customer"
    if (panelMode === "delete") return "Delete customer"
    return "Customer details"
  }, [panelMode])

  const closePanel = () => {
    if (isSaving || deleteMutation.isPending) return
    resetPanel()
  }

  const openCreate = () => {
    setActiveCustomer(null)
    setFormValues(emptyCustomerFormValues())
    setFormError(null)
    setPanelMode("create")
  }

  const openView = (customer: Customer) => {
    setActiveCustomer(customer)
    setFormError(null)
    setPanelMode("view")
  }

  const openEdit = (customer: Customer) => {
    setActiveCustomer(customer)
    setFormValues(formValuesFromCustomer(customer))
    setFormError(null)
    setPanelMode("edit")
  }

  const openDelete = (customer: Customer) => {
    setActiveCustomer(customer)
    setFormError(null)
    setPanelMode("delete")
  }

  const handleCreate = () => {
    const validationError = validateCustomerForm(formValues)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    createMutation.mutate(toCreatePayload(formValues))
  }

  const handleUpdate = () => {
    if (!activeCustomer) return
    const validationError = validateCustomerForm(formValues)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    updateMutation.mutate({
      customerId: activeCustomer.id,
      values: formValues,
    })
  }

  const handleDelete = () => {
    if (!activeCustomer) return
    deleteMutation.mutate(activeCustomer.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Users className="size-3.5" />
            Customers
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Customers
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keep a workspace directory of people you support. Conversations that
            use the same email appear on each customer profile.
          </p>
        </div>
        <Button type="button" className="rounded-2xl" onClick={openCreate}>
          <Plus className="size-4" />
          New customer
        </Button>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
        <p className="mb-1 text-sm font-semibold text-foreground">
          Search customers
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Search the customer directory by name, email, or company.
        </p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, or company…"
          aria-label="Search customers"
          className="h-11 rounded-2xl bg-background"
        />
      </div>

      <CustomerList
        customers={customers}
        isLoading={listQuery.isLoading}
        error={listError}
        isFiltered={Boolean(debouncedSearch)}
        onRetry={() => void listQuery.refetch()}
        onView={openView}
        onEdit={openEdit}
        onDelete={openDelete}
        deletingId={deletingId}
      />

      <Sheet
        open={panelOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving && !deleteMutation.isPending) {
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
            <CustomerForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={handleCreate}
              onCancel={closePanel}
              submitLabel="Create customer"
              isSaving={isSaving}
              error={formError}
            />
          ) : null}

          {panelMode === "edit" ? (
            <CustomerForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={handleUpdate}
              onCancel={closePanel}
              submitLabel="Save changes"
              isSaving={isSaving}
              error={formError}
            />
          ) : null}

          {panelMode === "view" && activeCustomer ? (
            detailQuery.isLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading customer…
              </div>
            ) : detailQuery.isError ? (
              <div className="space-y-3 px-4 py-6">
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {getApiErrorMessage(
                    detailQuery.error,
                    "Unable to load customer details.",
                  )}
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
            ) : detailQuery.data ? (
              <CustomerDetailPanel
                customer={detailQuery.data}
                onEdit={() => openEdit(detailQuery.data)}
                onClose={closePanel}
              />
            ) : null
          ) : null}

          {panelMode === "delete" && activeCustomer ? (
            <div className="flex flex-1 flex-col">
              <div className="flex-1 space-y-3 px-4 py-5">
                <p className="text-sm text-foreground">
                  Delete{" "}
                  <span className="font-semibold">
                    {customerDisplayName(activeCustomer)}
                  </span>
                  ? This cannot be undone. Related conversations are not deleted.
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
                  onClick={handleDelete}
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
