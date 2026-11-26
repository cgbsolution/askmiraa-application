/**
 * Home — the old HRMS's home screen, in AskMiraa's colours.
 *
 * Top to bottom, as the old app had it: the company's logo, a search box,
 * and the services as tiles, two to a row, in the old app's order (Punch,
 * Leave, Payslips, Regularise attendance, Documents, Calendar, Ask Miraa, IT
 * declaration, Punch history, Helpdesk, Company policies, Assets, Approvals),
 * then "All services" for everything else. Each tile shows only when the
 * person can reach it, and carries a count when something waits there.
 *
 * Typing in the search predicts: the closest services drop down under the box
 * (tap one to open it) and the tiles narrow to every match, by name or the
 * words the old HRMS used ("plug me", "salary slip", "AR"). What used to sit on Home
 * lives where it belongs: today's punch on Attendance, leave left on Leave,
 * things to do in the Inbox (the bell), news and celebrations in All services.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { workplaceApi } from '../../api/workplace';
import { CompanyCard } from '../../components/CompanyCard';
import { SearchField } from '../../components/Field';
import { Screen } from '../../components/Screen';
import { ServiceGrid, type GridEntry } from '../../components/ServiceGrid';
import { EmptyState, OfflineBanner } from '../../components/States';
import { TabHeader } from '../../components/TabHeader';
import { homeServices, searchServices } from '../../core/services';
import { useHomeServices } from '../../lib/homeServices';
import { t } from '../../lib/i18n';
import { useInboxCount } from '../../lib/inbox';
import { useOnline } from '../../lib/network';
import { useSession } from '../../lib/session';
import { useTodos } from '../../lib/todos';
import { useGo } from '../../navigation/navigate';
import { useServiceSuggestions, useVisibleServices } from './ServicesScreen';

export function HomeScreen() {
  const go = useGo();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const online = useOnline();
  const inbox = useInboxCount();
  const todo = useTodos();
  const [query, setQuery] = useState('');

  const { context, services: visible } = useVisibleServices();
  const [pinned] = useHomeServices();
  const home = homeServices(context, pinned);
  const found = useMemo(() => (query.trim() ? searchServices(query, visible) : null), [query, visible]);
  const suggestions = useServiceSuggestions(query, visible);

  // Counts on the tiles: what waits there, from the same sources as the bell.
  const policies = useQuery({ queryKey: ['documents', 'company'], queryFn: workplaceApi.companyDocuments, enabled: can('policies') });
  const counts = {
    approvals: inbox.approvals,
    punch: todo.todos.filter((item) => item.key.startsWith('punch-')).length,
    policies: (policies.data ?? []).filter((doc) => doc.requires_acknowledgement && !doc.acknowledged_by_me).length,
  };

  const allServices: GridEntry = { key: 'all', label: t('All services'), spot: 'grid', onPress: () => go('Services') };

  // Pull to refresh: the counts, the logo, and the session (a module switched on shows its tiles).
  const refresh = () =>
    Promise.all([
      policies.refetch(),
      todo.refetch(),
      queryClient.invalidateQueries({ queryKey: ['workspace-brand'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
      queryClient.invalidateQueries({ queryKey: ['approvals', 'count'] }),
      queryClient.invalidateQueries({ queryKey: ['session'] }),
    ]);

  return (
    <Screen tier="tier2" header={<TabHeader title={t('Home')} />} onRefresh={refresh}>
      <CompanyCard />
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('Search')}
        label={t('Search services')}
        suggestions={suggestions}
      />
      {!online ? <OfflineBanner message={t("You're offline. Punches are saved on this phone and sent when signal returns.")} /> : null}
      {found ? (
        found.length ? (
          <ServiceGrid services={found} counts={counts} />
        ) : (
          <EmptyState
            spot="search"
            title={t('Nothing called that')}
            message={t('Try another word — or ask Miraa, who can find most things for you.')}
            action={can('companion') ? { label: t('Ask Miraa'), onPress: () => go('AskMira') } : undefined}
          />
        )
      ) : (
        <ServiceGrid services={home} counts={counts} extra={[allServices]} />
      )}
    </Screen>
  );
}
