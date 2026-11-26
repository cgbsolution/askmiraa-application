/**
 * The tier of the screen being drawn.
 *
 * `Screen tier="tier2"` sets it once; cards and buttons inside read it, so a
 * Home card is warm and a payslip card is flat without each one being told.
 * A block can still override it (the Tier 1 payroll strip on Home).
 */

import { createContext, useContext } from 'react';

import type { Tier } from '../theme/tokens';

export const TierContext = createContext<Tier>('tier1');

export function useTier(): Tier {
  return useContext(TierContext);
}
