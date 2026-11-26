/** Linked products: a one-time sign-in link into ExpenseGenie, CGB Helpdesk or AnytimeHire. */

import type { ProductKey } from '../core/types';
import { api } from '../lib/api';

export const PRODUCT_NAMES: Record<ProductKey, string> = {
  expense: 'ExpenseGenie',
  helpdesk: 'CGB Helpdesk',
  interview: 'AnytimeHire',
};

export const productsApi = {
  /** Good for 60 seconds; open it straight away. */
  launch: (product: ProductKey, to?: string) =>
    api<{ url: string }>(`/products/${product}/launch`, { method: 'POST', query: { to } }),
};
