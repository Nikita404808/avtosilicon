import type { DeliveryCalculateResponse, DeliveryPvzSearchResponse } from '@/types/delivery';

const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE ?? 'http://79.174.85.129:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${AUTH_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Delivery API request failed');
  }

  return response.json() as Promise<T>;
}

export async function searchPvz(provider: string, city: string, query: string) {
  return request<DeliveryPvzSearchResponse>('/api/delivery/pvz/search', {
    method: 'POST',
    body: JSON.stringify({ provider, city, query }),
  });
}

export async function calculateDelivery(body: {
  provider: string;
  type: string;
  total_weight: number;
  pickup_point_id?: string | null;
  address?: Record<string, unknown>;
  provider_metadata?: Record<string, unknown>;
}) {
  return request<DeliveryCalculateResponse>('/api/delivery/calculate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function tariffs(body: {
  provider: string;
  type: string;
  total_weight: number;
  pickup_point_id?: string | null;
  address?: Record<string, unknown>;
  provider_metadata?: Record<string, unknown>;
}) {
  return request<{ tariffs: unknown[] }>('/api/delivery/tariffs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
