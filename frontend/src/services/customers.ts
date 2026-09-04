import { api } from "@/services/api"
import {
  DEFAULT_PAGE_SIZE,
  mapPaginated,
  type ListPaginationParams,
  type PaginatedApi,
  type PaginatedList,
} from "@/types/pagination"
import type {
  Customer,
  CustomerCreatePayload,
  CustomerDetail,
  CustomerUpdatePayload,
} from "@/types/customers"

export type CustomerListParams = ListPaginationParams & {
  query?: string
}

export async function listCustomers(
  params: CustomerListParams = {},
): Promise<PaginatedList<Customer>> {
  const trimmed = params.query?.trim()
  const { data } = await api.get<PaginatedApi<Customer>>("/customers", {
    params: {
      q: trimmed || undefined,
      page: params.page ?? 1,
      page_size: params.pageSize ?? DEFAULT_PAGE_SIZE,
    },
  })
  return mapPaginated(data)
}

export async function getCustomer(customerId: string): Promise<CustomerDetail> {
  const { data } = await api.get<CustomerDetail>(`/customers/${customerId}`)
  return data
}

export async function createCustomer(
  payload: CustomerCreatePayload,
): Promise<Customer> {
  const { data } = await api.post<Customer>("/customers", payload)
  return data
}

export async function updateCustomer(
  customerId: string,
  payload: CustomerUpdatePayload,
): Promise<Customer> {
  const { data } = await api.patch<Customer>(
    `/customers/${customerId}`,
    payload,
  )
  return data
}

export async function deleteCustomer(customerId: string): Promise<void> {
  await api.delete(`/customers/${customerId}`)
}
