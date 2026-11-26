/**
 * All services — everything the app does, grouped, with a search.
 *
 * The same tiles as Home, with the website's icons. The search knows the
 * words people already use (the old HRMS called documents "Plug Me", time
 * corrections "AR", payslips "salary slip"), so typing what you know finds
 * the right place. "Choose for Home" picks Home's tiles, kept on this phone.
 */

import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../components/Button';
import { SearchField, type SearchSuggestion } from '../../components/Field';
import { ListGroup, ListRow } from '../../components/List';
import { Screen, Section } from '../../components/Screen';
import { ServiceGrid } from '../../components/ServiceGrid';
import { Sheet } from '../../components/Sheet';
import { EmptyState } from '../../components/States';
import { Txt } from '../../components/Text';
import { isHr } from '../../core/access';
import {
  HOME_SERVICE_COUNT,
  SERVICES,
  SERVICE_GROUPS,
  groupServices,
  homeServices,
  searchServices,
  serviceVisible,
  type Service,
} from '../../core/services';
import { useHomeServices } from '../../lib/homeServices';
import { rankSuggestions } from '../../core/predictive';
import { t } from '../../lib/i18n';
import { useInboxCount } from '../../lib/inbox';
import { useSession } from '../../lib/session';
import { useGo } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';

export function useVisibleServices() {
  const { can, access } = useSession();
  const approver = Boolean(access && (access.isManager || isHr(access)));
  return useMemo(() => {
    const context = { can, approver };
    return { context, services: SERVICES.filter((service) => serviceVisible(service, context)) };
  }, [can, approver]);
}

/**
 * The services a search predicts as it is typed, closest first: tapping one
 * opens it. Matched by name and by the words people use for it ("salary slip").
 */
export function useServiceSuggestions(query: string, services: Service[]): SearchSuggestion[] {
  const go = useGo();
  return useMemo(() => {
    const groupLabel = new Map(SERVICE_GROUPS.map((group) => [group.key, group.label]));
    const lines = services.map((service) => ({
      service,
      label: t(service.label),
      keywords: [service.label, ...(service.keywords ?? [])].join(' '),
    }));
    return rankSuggestions(lines, query, 6).map(({ service, label }) => ({
      key: service.key,
      label,
      hint: t(groupLabel.get(service.group) ?? ''),
      onPress: () => go(service.route),
    }));
  }, [query, services, go]);
}

export function ServicesScreen() {
  const go = useGo();
  const { can } = useSession();
  const { services } = useVisibleServices();
  const inbox = useInboxCount();
  const [query, setQuery] = useState('');
  const [choosing, setChoosing] = useState(false);
  const found = useMemo(() => searchServices(query, services), [query, services]);
  const groups = useMemo(() => groupServices(found), [found]);
  const counts = { approvals: inbox.approvals };
  const suggestions = useServiceSuggestions(query, services);

  return (
    <Screen tier="tier2">
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('Payslip, leave, documents, ticket…')}
        label={t('Search services')}
        suggestions={suggestions}
      />

      {groups.length === 0 ? (
        <EmptyState
          spot="search"
          title={t('Nothing called that')}
          message={t('Try another word — or ask Miraa, who can find most things for you.')}
          action={can('companion') ? { label: t('Ask Miraa'), onPress: () => go('AskMira') } : undefined}
        />
      ) : query.trim() ? (
        <ServiceGrid services={found} counts={counts} />
      ) : (
        groups.map((group) => (
          <Section key={group.key} title={t(group.label)}>
            <ServiceGrid services={group.services} counts={counts} />
          </Section>
        ))
      )}

      {!query.trim() ? <Button label={t('Choose for Home')} variant="secondary" onPress={() => setChoosing(true)} fullWidth /> : null}
      <ChooseHomeServices open={choosing} onClose={() => setChoosing(false)} />
    </Screen>
  );
}

/** Pick the services on Home. Kept on this phone. */
export function ChooseHomeServices({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { context, services } = useVisibleServices();
  const [pinned, save] = useHomeServices();
  const current = homeServices(context, pinned).map((s) => s.key);
  const [draft, setDraft] = useState<string[] | null>(null);
  const chosen = draft ?? current;
  const full = chosen.length >= HOME_SERVICE_COUNT;

  const toggle = (key: string) => {
    if (chosen.includes(key)) setDraft(chosen.filter((k) => k !== key));
    else if (!full) setDraft([...chosen, key]);
  };
  const close = () => {
    setDraft(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('Choose for Home')}
      description={t('Pick up to {count}. They show on Home in the order you pick them. Kept on this phone.', { count: HOME_SERVICE_COUNT })}
      footer={
        <View style={styles.footer}>
          <Button
            label={t('Reset')}
            variant="secondary"
            onPress={() => {
              save(null);
              close();
            }}
            style={styles.flex}
          />
          <Button
            label={t('Save ({count})', { count: chosen.length })}
            variant="primary"
            disabled={chosen.length === 0}
            onPress={() => {
              save(chosen);
              close();
            }}
            style={styles.flex}
          />
        </View>
      }
    >
      <ListGroup>
        {services.map((service) => {
          const on = chosen.includes(service.key);
          const position = chosen.indexOf(service.key) + 1;
          return (
            <ListRow
              key={service.key}
              spot={service.spot}
              title={t(service.label)}
              disabled={!on && full}
              chevron={false}
              onPress={() => toggle(service.key)}
              trailing={
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(service.label)}
                  onPress={() => toggle(service.key)}
                  style={[
                    styles.tick,
                    { borderColor: on ? colors.primary : colors.borderStrong, backgroundColor: on ? colors.primary : colors.surface },
                  ]}
                >
                  {on ? (
                    position > 0 ? (
                      <Txt variant="label" tone="onPrimary">
                        {String(position)}
                      </Txt>
                    ) : (
                      <Check size={layout.iconSm} color={colors.onPrimary} />
                    )
                  ) : null}
                </Pressable>
              }
            />
          );
        })}
      </ListGroup>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { flexDirection: 'row', gap: spacing.sm },
  tick: {
    width: layout.iconTile - spacing.md,
    height: layout.iconTile - spacing.md,
    borderRadius: radius.sm,
    borderWidth: spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
