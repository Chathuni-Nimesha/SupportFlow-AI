import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function TicketTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {[
              "Ticket ID",
              "Customer",
              "Subject",
              "Priority",
              "Status",
              "Assigned Agent",
              "Created Date",
              "Actions",
            ].map((heading) => (
              <TableHead key={heading} className="px-4">
                {heading}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, index) => (
            <TableRow key={index}>
              {Array.from({ length: 8 }).map((__, cell) => (
                <TableCell key={cell} className="px-4 py-4">
                  <Skeleton className="h-4 w-full max-w-[7rem] rounded-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
