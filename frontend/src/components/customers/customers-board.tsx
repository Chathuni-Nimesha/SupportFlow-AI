import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Users } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { CustomerDetailPanel } from "@/components/customers/customer-detail"
import { CustomerForm } from "@/components/customers/customer-form"
import { CustomerList } from "@/components/customers/customer-list"
import { ListPagination } from "@/components/common/list-pagination"
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
import { DEFAULT_PAGE_SIZE } from "@/types/pagination"
import { getApiErrorMessage } from "@/utils/api-error"

type PanelMode = "closed" | "create" | "edit" | "view" | "delete"

const CUSTOMERS_QUERY_KEY = ["customers"] as const

function replaceSearchParam(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  key: string,
  value: string | null,
) {
  const current = searchParams.get(key)
  if (value) {
    if (current === value) return
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next, { replace: true })
    return
  }
  if (!searchParams.has(key)) return
  const next = new URLSearchParams(searchParams)
  next.delete(key)
  setSearchParams(next, { replace: true })
}

export function CustomersBoard() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCustomerId = searchParams.get("customer")?.trim() || null
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [panelMode, setPanelMode] = useState<PanelMode>("closed")
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null)
  const [formValues, setFormValues] = useState<CustomerFormValues>(
    emptyCustomerFormValues(),
  )
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  const listQuery = useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, "list", debouncedSearch, page],
    queryFn: () =>
      listCustomers({
        query: debouncedSearch || undefined,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const suppressCustomerQuery =
    panelMode === "create" || panelMode === "edit" || panelMode === "delete"
  const isQueryView = Boolean(requestedCustomerId) && !suppressCustomerQuery
  const viewCustomerId = isQueryView
    ? requestedCustomerId
    : panelMode === "view"
      ? activeCustomer?.id ?? null
      : null

  const detailQuery = useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, "detail", viewCustomerId],
    queryFn: () => getCustomer(viewCustomerId!),
    enabled: Boolean(viewCustomerId),
    retry: false,
  })

  const customers = listQuery.data?.items ?? []
  const listError = listQuery.isError
    ? getApiErrorMessage(listQuery.error, "Unable to load customers.")
    : null

  const resetPanel = () => {
    setPanelMode("closed")
    setActiveCustomer(null)
    setFormError(null)
    setFormValues(emptyCustomerFormValues())
    replaceSearchParam(searchParams, setSearchParams, "customer", null)
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
  const panelOpen = panelMode !== "closed" || isQueryView

  const panelTitle = useMemo(() => {
    if (panelMode === "create") return "New customer"
    if (panelMode === "edit") return "Edit customer"
    if (panelMode === "delete") return "Delete customer"
    if (isQueryView && detailQuery.isError) return "Customer not found"
    return "Customer details"
  }, [detailQuery.isError, isQueryView, panelMode])

  const closePanel = () => {
    if (isSaving || deleteMutation.isPending) return
    resetPanel()
  }

  const openCreate = () => {
    replaceSearchParam(searchParams, setSearchParams, "customer", null)
    setActiveCustomer(null)
    setFormValues(emptyCustomerFormValues())
    setFormError(null)
    setPanelMode("create")
  }

  const openView = (customer: Customer) => {
    setActiveCustomer(customer)
    setFormError(null)
    setPanelMode("view")
    replaceSearchParam(searchParams, setSearchParams, "customer", customer.id)
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
      <ListPagination
        page={listQuery.data?.page ?? page}
        pageSize={listQuery.data?.pageSize ?? DEFAULT_PAGE_SIZE}
        total={listQuery.data?.total ?? 0}
        hasNext={listQuery.data?.hasNext ?? false}
        onPageChange={setPage}
        itemLabel="customers"
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

          {panelMode === "view" || isQueryView ? (
            detailQuery.isLoading || (!detailQuery.data && !detailQuery.isError) ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading customer…
              </div>
            ) : detailQuery.isError ? (
              <div className="space-y-3 px-4 py-6">
                <p className="text-sm font-semibold text-foreground">
                  Customer not found
                </p>
                <p className="text-sm text-muted-foreground">
                  This customer is not in your workspace, or it no longer
                  exists.
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
                  ? This cannot be undone. Conversations stay in the workspace
                  and keep their name and email, but the customer link is
                  removed. Customers with tickets cannot be deleted until those
                  tickets are reassigned or removed.
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
