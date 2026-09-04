import type { ConversationApi } from "@/types/conversations"

export type Customer = {
  id: string
  owner_id: string
  workspace_id?: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type CustomerDetail = Customer & {
  conversations: ConversationApi[]
}

export type CustomerCreatePayload = {
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  company?: string | null
  notes?: string | null
}

export type CustomerUpdatePayload = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string | null
  company?: string | null
  notes?: string | null
}

export type CustomerFormValues = {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  notes: string
}
