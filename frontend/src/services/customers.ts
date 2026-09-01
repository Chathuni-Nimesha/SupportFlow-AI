import { api } from "@/services/api"
import type {
  Customer,
  CustomerCreatePayload,
  CustomerDetail,
  CustomerUpdatePayload,
} from "@/types/customers"

export async function listCustomers(query?: string): Promise<Customer[]> {
  const trimmed = query?.trim()
  const { data } = await api.get<Customer[]>("/customers", {
    params: trimmed ? { q: trimmed } : undefined,
  })
  return data
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
