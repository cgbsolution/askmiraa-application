/**
 * The signed-in session, as screens see it.
 *
 * App owns whether someone is signed in. Screens read who they are, their
 * workspace's switched-on modules and what they may reach (`canSee`) from
 * here, and end the session with `signOut` rather than reaching up through
 * props.
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { FEATURES, accessFromSession, canSee, productLinked, type AccessContext, type FeatureKey } from '../core/access';
import type { Session } from '../core/types';
import { sessionApi } from '../api/auth';
import { setUploadLimit } from './files';

export interface SessionValue {
  session: Session | null;
  access: AccessContext | null;
  /** Whether a feature's entry point should show. False until the session loads. */
  can: (feature: FeatureKey) => boolean;
  /** Whether a linked product (ExpenseGenie, CGB Helpdesk) has taken this feature over. */
  linked: (feature: FeatureKey) => boolean;
  signOut: () => Promise<void>;
  reload: () => void;
}

const SessionContext = createContext<SessionValue>({
  session: null,
  access: null,
  can: () => false,
  linked: () => false,
  signOut: async () => {},
  reload: () => {},
});

export function SessionProvider({ children, signOut }: { children: ReactNode; signOut: () => Promise<void> }) {
  const query = useQuery({ queryKey: ['session'], queryFn: sessionApi.get, staleTime: 5 * 60_000 });
  const session = query.data ?? null;
  // Every file picker checks against the workspace's upload limit.
  const uploadLimit = session?.tenant.max_upload_mb;
  useEffect(() => setUploadLimit(uploadLimit), [uploadLimit]);

  const value = useMemo<SessionValue>(() => {
    const access = session ? accessFromSession(session) : null;
    return {
      session,
      access,
      can: (feature) => (access ? canSee(access, feature) : false),
      linked: (feature) => (access ? productLinked(access, FEATURES[feature]) : false),
      signOut,
      reload: () => void query.refetch(),
    };
  }, [session, signOut, query]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}

/** The signed-in user. Screens under the navigator always have one. */
export function useUser() {
  return useSession().session?.user ?? null;
}
