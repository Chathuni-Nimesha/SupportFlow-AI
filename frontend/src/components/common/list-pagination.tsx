import { Button } from "@/components/ui/button"

type ListPaginationProps = {
  page: number
  pageSize: number
  total: number
  hasNext: boolean
  onPageChange: (page: number) => void
  itemLabel: string
}

export function ListPagination({
  page,
  pageSize,
  total,
  hasNext,
  onPageChange,
  itemLabel,
}: ListPaginationProps) {
  if (total === 0) {
    return null
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const showButtons = page > 1 || hasNext

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total} {itemLabel}
      </p>
      {showButtons ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
