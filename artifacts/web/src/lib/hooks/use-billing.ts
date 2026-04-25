// ---------------------------------------------------------------------------
// React Query hooks for Billing, Subscriptions & Checkout.
// PayFast is the primary payment gateway (South Africa);
// Stripe is the secondary/international option.
// ---------------------------------------------------------------------------

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type InvoiceStatus = 'paid' | 'pending' | 'failed';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';
export type BillingCycle = 'monthly' | 'annual';
export type PaymentGateway = 'payfast' | 'stripe';

export interface Subscription {
  id: string;
  packId: string;
  packName: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  priceMonthly: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  gateway: PaymentGateway;
  createdAt: string;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  description: string;
  amountExclVat: number;
  vatAmount: number;
  amountInclVat: number;
  currency: string;
  status: InvoiceStatus;
  paidAt: string | null;
  downloadUrl: string | null;
  createdAt: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  gateway: PaymentGateway;
  expiresAt: string;
}

export interface PaymentMethodInfo {
  id: string;
  gateway: PaymentGateway;
  type: 'card' | 'eft' | 'payfast';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  bankName?: string;
  isDefault: boolean;
}

export interface UsageSummary {
  activeModules: number;
  apiCallsThisMonth: number;
  apiCallsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
}

export interface CreateCheckoutPayload {
  workspaceSlug: string;
  packId: string;
  billingCycle: BillingCycle;
  gateway: PaymentGateway;
  promoCode?: string;
}

export interface CancelSubscriptionPayload {
  workspaceSlug: string;
  subscriptionId: string;
}

export interface UpdatePaymentMethodPayload {
  workspaceSlug: string;
  gateway: PaymentGateway;
  token: string;
}

// ------------------------------------------------------------------
// Query keys
// ------------------------------------------------------------------

export const billingKeys = {
  subscriptions: (ws: string) => ['billing', 'subscriptions', ws] as const,
  invoices: (ws: string) => ['billing', 'invoices', ws] as const,
  paymentMethod: (ws: string) => ['billing', 'payment-method', ws] as const,
  usage: (ws: string) => ['billing', 'usage', ws] as const,
};

// ------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------

export function useSubscriptions(workspaceSlug: string | undefined) {
  return useQuery<Subscription[]>({
    queryKey: billingKeys.subscriptions(workspaceSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Subscription[]>(
        `/${workspaceSlug}/billing/subscriptions`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug,
  });
}

export function useBillingHistory(workspaceSlug: string | undefined) {
  return useQuery<Invoice[]>({
    queryKey: billingKeys.invoices(workspaceSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<Invoice[]>(
        `/${workspaceSlug}/billing/invoices`,
      );
      return res.data ?? [];
    },
    enabled: !!workspaceSlug,
  });
}

export function usePaymentMethod(workspaceSlug: string | undefined) {
  return useQuery<PaymentMethodInfo | null>({
    queryKey: billingKeys.paymentMethod(workspaceSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<PaymentMethodInfo>(
        `/${workspaceSlug}/billing/payment-method`,
      );
      return res.data ?? null;
    },
    enabled: !!workspaceSlug,
  });
}

export function useUsageSummary(workspaceSlug: string | undefined) {
  return useQuery<UsageSummary>({
    queryKey: billingKeys.usage(workspaceSlug ?? ''),
    queryFn: async () => {
      const res = await api.get<UsageSummary>(
        `/${workspaceSlug}/billing/usage`,
      );
      return res.data ?? {
        activeModules: 0,
        apiCallsThisMonth: 0,
        apiCallsLimit: 10000,
        storageUsedMb: 0,
        storageLimitMb: 5120,
      };
    },
    enabled: !!workspaceSlug,
  });
}

// ------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------

export function useCreateCheckout() {
  return useMutation<ApiResponse<CheckoutSession>, Error, CreateCheckoutPayload>({
    mutationFn: ({ workspaceSlug, ...body }) =>
      api.post<CheckoutSession>(
        `/${workspaceSlug}/billing/checkout`,
        body,
      ),
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();

  return useMutation<ApiResponse, Error, CancelSubscriptionPayload>({
    mutationFn: ({ workspaceSlug, subscriptionId }) =>
      api.post(
        `/${workspaceSlug}/billing/subscriptions/${subscriptionId}/cancel`,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: billingKeys.subscriptions(variables.workspaceSlug),
      });
      useToastStore.getState().addToast(
        'Subscription will be cancelled at the end of the billing period.',
        'success',
      );
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<PaymentMethodInfo>, Error, UpdatePaymentMethodPayload>({
    mutationFn: ({ workspaceSlug, ...body }) =>
      api.post<PaymentMethodInfo>(
        `/${workspaceSlug}/billing/payment-method`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: billingKeys.paymentMethod(variables.workspaceSlug),
      });
      useToastStore.getState().addToast('Payment method updated.', 'success');
    },
    onError: (err: Error) => {
      useToastStore.getState().addToast(err.message, 'error');
    },
  });
}
