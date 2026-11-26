/** Whether the device is online, for screens that must say so (chat, approvals). */

import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}
