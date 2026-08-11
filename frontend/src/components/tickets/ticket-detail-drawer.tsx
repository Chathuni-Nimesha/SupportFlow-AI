import {
  FileText,
  MessageSquare,
  NotebookPen,
  Paperclip,
  History,
} from "lucide-react"

import type { Ticket, TicketEvent, TicketComment, TicketAttachment } from "@/data/tickets"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type TicketDetailDrawerProps = {
  ticket: Ticket | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TicketDetailDrawer({
  ticket,
  open,
  onOpenChange,
}: TicketDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {ticket ? (
          <>
            <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-base">{ticket.id}</SheetTitle>
                <Badge variant="secondary" className="rounded-full">
                  {ticket.priority}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {ticket.status}
                </Badge>
              </div>
              <SheetDescription className="text-sm text-foreground">
                {ticket.subject}
              </SheetDescription>
              <p className="text-xs text-muted-foreground">
                {ticket.customer} · {ticket.customerEmail} · Assigned to{" "}
                {ticket.agent}
              </p>
            </SheetHeader>

            <div className="border-b border-border/70 px-5 py-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Description
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {ticket.description}
              </p>
            </div>

            <Tabs defaultValue="timeline" className="flex min-h-0 flex-1 flex-col">
              <div className="px-5 pt-3">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/60 p-1">
                  <TabsTrigger value="timeline" className="rounded-xl">
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="rounded-xl">
                    Comments
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="rounded-xl">
                    Internal Notes
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="rounded-xl">
                    Attachments
                  </TabsTrigger>
                  <TabsTrigger value="history" className="rounded-xl">
                    History
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 px-5 py-4">
                <TabsContent value="timeline" className="mt-0">
                  <EventList
                    icon={History}
                    empty="No timeline events yet."
                    items={ticket.timeline}
                  />
                </TabsContent>

                <TabsContent value="comments" className="mt-0">
                  <CommentList
                    icon={MessageSquare}
                    empty="No customer comments yet."
                    items={ticket.comments}
                  />
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                  <CommentList
                    icon={NotebookPen}
                    empty="No internal notes yet."
                    items={ticket.notes}
                    internal
                  />
                </TabsContent>

                <TabsContent value="attachments" className="mt-0">
                  <AttachmentList items={ticket.attachments} />
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <EventList
                    icon={FileText}
                    empty="No history recorded."
                    items={ticket.history}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <Separator />
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Updated {ticket.updatedAt}
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function EventList({
  items,
  empty,
  icon: Icon,
}: {
  items: TicketEvent[]
  empty: string
  icon: typeof History
}) {
  if (items.length === 0) {
    return <EmptyPanel message={empty} />
  }

  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3">
          {index < items.length - 1 ? (
            <span
              className="absolute top-10 bottom-[-0.75rem] left-[1.15rem] w-px bg-border"
              aria-hidden
            />
          ) : null}
          <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-background px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {item.timestamp}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </p>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">
              {item.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function CommentList({
  items,
  empty,
  icon: Icon,
  internal = false,
}: {
  items: TicketComment[]
  empty: string
  icon: typeof MessageSquare
  internal?: boolean
}) {
  if (items.length === 0) {
    return <EmptyPanel message={empty} />
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.id}
          className={cn(
            "rounded-2xl border px-3.5 py-3",
            internal
              ? "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10"
              : "border-border/70 bg-background",
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <Icon className="size-3.5 text-primary" aria-hidden />
            <p className="text-sm font-semibold text-foreground">{item.author}</p>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {item.timestamp}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.body}
          </p>
        </article>
      ))}
    </div>
  )
}

function AttachmentList({ items }: { items: TicketAttachment[] }) {
  if (items.length === 0) {
    return <EmptyPanel message="No attachments uploaded." />
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background px-3.5 py-3"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Paperclip className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {item.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.size} · {item.uploadedBy} · {item.uploadedAt}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="rounded-xl">
            View
          </Button>
        </div>
      ))}
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
