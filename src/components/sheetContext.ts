/**
 * Whether a field is inside a bottom sheet. A sheet only rises above the
 * keyboard for its own text input, so fields switch to it there.
 */

import { createContext, useContext, useEffect, useRef } from 'react';

export const InSheetContext = createContext(false);

export function useInSheet(): boolean {
  return useContext(InSheetContext);
}

/**
 * Run `reset` each time a sheet opens, so a form in it starts fresh instead
 * of showing what was typed (and discarded) last time.
 */
export function useResetOnOpen(open: boolean, reset: () => void): void {
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    if (open) resetRef.current();
  }, [open]);
}
