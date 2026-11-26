/**
 * The current time, ticking while the screen is in view.
 *
 * The punch card's clock and "worked today" read it. It stops when the
 * screen is not focused, so a clock on a tab nobody is looking at does not
 * re-render every second.
 */

import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): Date {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!focused) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [focused, intervalMs]);
  return now;
}
