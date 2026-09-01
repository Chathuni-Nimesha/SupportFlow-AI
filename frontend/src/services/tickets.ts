import { api } from "@/services/api"
import type {
  Ticket,
  TicketCreatePayload,
  TicketListParams,
  TicketUpdatePayload,
} from "@/types/tickets"

export async function listTickets(
  params: TicketListParams = {},
): Promise<Ticket[]> {
  const query = params.query?.trim()
  const { data } = await api.get<Ticket[]>("/tickets", {
    params: {
      q: query || undefined,
      status: params.status || undefined,
      priority: params.priority || undefined,
      assignee_id: params.assigneeId || undefined,
      unassigned: params.unassigned || undefined,
      customer_id: params.customerId || undefined,
    },
  })
  return data
}

export async function getTicket(ticketId: string): Promise<Ticket> {
  const { data } = await api.get<Ticket>(`/tickets/${ticketId}`)
  return data
}

export async function createTicket(
  payload: TicketCreatePayload,
): Promise<Ticket> {
  const { data } = await api.post<Ticket>("/tickets", payload)
  return data
}

export async function updateTicket(
  ticketId: string,
  payload: TicketUpdatePayload,
): Promise<Ticket> {
  const { data } = await api.patch<Ticket>(`/tickets/${ticketId}`, payload)
  return data
}

export async function deleteTicket(ticketId: string): Promise<void> {
  await api.delete(`/tickets/${ticketId}`)
}
