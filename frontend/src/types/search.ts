export type GlobalSearchResourceType =
  | "conversation"
  | "ticket"
  | "customer"
  | "knowledge"

export type GlobalSearchHit = {
  id: string
  type: GlobalSearchResourceType
  title: string
  subtitle: string | null
  href: string
}

export type GlobalSearchResponse = {
  query: string
  conversations: GlobalSearchHit[]
  tickets: GlobalSearchHit[]
  customers: GlobalSearchHit[]
  knowledge: GlobalSearchHit[]
}
