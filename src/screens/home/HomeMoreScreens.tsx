/**
 * Home's detail screens: announcements, celebrations, who is out this week,
 * and the company's quick links.
 */

import { useQuery } from '@tanstack/react-query';
import { Cake, ExternalLink, Link2, PartyPopper } from 'lucide-react-native';
import { useState } from 'react';

import { cultureApi } from '../../api/culture';
import { dashboardApi } from '../../api/dashboard';
import { leaveApi } from '../../api/leave';
import { Avatar } from '../../components/Avatar';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ListGroup, ListRow } from '../../components/List';
import { Screen, Section, Stack } from '../../components/Screen';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { addDays, diffDays, formatDateTime, formatDayLabel, formatRange, startOfWeek, todayISO } from '../../core/dates';
import { webToMobileRoute } from '../../core/webToMobileRoute';
import { t } from '../../lib/i18n';
import { followLink } from '../../lib/links';
import { useAction } from '../../lib/useAction';
import { useGo } from '../../navigation/navigate';
import { layout } from '../../theme/tokens';

export function AnnouncementsScreen() {
  const query = useQuery({ queryKey: ['culture', 'announcements'], queryFn: cultureApi.announcements });
  const acknowledge = useAction((id: string) => cultureApi.acknowledgeAnnouncement(id), {
    success: t('Acknowledged'),
    invalidate: [['culture', 'announcements']],
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Screen tier="tier2" onRefresh={() => query.refetch()}>
      <QueryView
        query={query}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState spot="megaphone" title={t('No announcements')} message={t('Company news shows here.')} />}
      >
        {(data) =>
          data.map((item) => (
            <Card key={item.id} onPress={() => setExpanded(expanded === item.id ? null : item.id)} accessibilityLabel={item.title}>
              <Stack gap="inline">
                <Txt variant="displaySmall">{item.title}</Txt>
                <Txt variant="caption" tone="muted">
                  {formatDateTime(item.publish_at)}
                </Txt>
                <Txt variant="body" numberOfLines={expanded === item.id ? undefined : 4}>
                  {item.body}
                </Txt>
                {item.requires_acknowledgement ? (
                  item.acknowledged ? (
                    <Badge label={t('Acknowledged {when}', { when: item.acknowledged_at ? formatDateTime(item.acknowledged_at) : '' })} tone="success" />
                  ) : (
                    <Button label={t('I have read this')} variant="accent" onPress={() => void acknowledge.run(item.id)} loading={acknowledge.pending} />
                  )
                ) : null}
              </Stack>
            </Card>
          ))
        }
      </QueryView>
    </Screen>
  );
}

export function CelebrationsScreen() {
  const query = useQuery({ queryKey: ['celebrations', 30], queryFn: () => dashboardApi.celebrations(30) });
  return (
    <Screen tier="tier2" onRefresh={() => query.refetch()}>
      <QueryView
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            spot="cake"
            title={t('Nothing in the next 30 days')}
            message={query.data?.note ?? t('Birthdays and work anniversaries show here for people who chose to share them.')}
          />
        }
      >
        {(data) => (
          <>
            <ListGroup>
              {data.items.map((item) => (
                <ListRow
                  key={`${item.employee_id}-${item.kind}`}
                  leading={<Avatar name={item.name} url={item.photo_url} size={layout.iconTile} />}
                  title={item.name}
                  subtitle={
                    item.kind === 'birthday'
                      ? t('Birthday · {day}', { day: formatDayLabel(item.on_date) })
                      : t('{years} years at the company · {day}', { years: item.years ?? '', day: formatDayLabel(item.on_date) })
                  }
                  trailing={<Badge label={item.kind === 'birthday' ? t('Birthday') : t('Anniversary')} icon={item.kind === 'birthday' ? Cake : PartyPopper} tone="primary" />}
                />
              ))}
            </ListGroup>
            <Txt variant="caption" tone="muted">
              {data.note}
            </Txt>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

export function WhoIsOutScreen() {
  const today = todayISO();
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  const query = useQuery({ queryKey: ['leave', 'who-is-out', start, end], queryFn: () => leaveApi.whoIsOut(start, end) });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => diffDays(today, d) >= 0);
  return (
    <Screen onRefresh={() => query.refetch()}>
      <Txt variant="callout" tone="muted">
        {formatRange(start, end)}
      </Txt>
      <QueryView query={query} skeleton={<SkeletonList rows={4} />}>
        {(data) => {
          const shown = data.filter((item) => item.status === 'approved' || item.status === 'pending');
          if (!shown.length) return <EmptyState spot="plane" title={t('Everyone is in this week')} />;
          return days.map((day) => {
            const out = shown.filter((item) => diffDays(item.start_date, day) >= 0 && diffDays(day, item.end_date) >= 0);
            if (!out.length) return null;
            return (
              <Section key={day} title={day === today ? t('Today') : formatDayLabel(day)}>
                <ListGroup>
                  {out.map((item) => (
                    <ListRow
                      key={`${item.employee_id}-${item.start_date}`}
                      leading={<Avatar name={item.employee_name} url={item.photo_url} size={layout.iconTile} />}
                      title={item.employee_name}
                      subtitle={[item.leave_type_name, item.is_half_day ? t('Half day') : formatRange(item.start_date, item.end_date)].filter(Boolean).join(' · ')}
                      trailing={item.status === 'pending' ? <StatusBadge status="pending" label={t('Not yet approved')} /> : undefined}
                    />
                  ))}
                </ListGroup>
              </Section>
            );
          });
        }}
      </QueryView>
    </Screen>
  );
}

export function QuickLinksScreen() {
  const go = useGo();
  const query = useQuery({ queryKey: ['dashboard', 'quick-links'], queryFn: dashboardApi.quickLinks });
  return (
    <Screen onRefresh={() => query.refetch()}>
      <Txt variant="callout" tone="muted">
        {t('Links your company has set for everyone.')}
      </Txt>
      <QueryView query={query} isEmpty={(data) => !data.links?.length} empty={<EmptyState spot="connected" title={t('No company links')} />}>
        {(data) => (
          <ListGroup>
            {data.links!.map((link) => {
              const target = webToMobileRoute(link.url);
              return (
                <ListRow
                  key={`${link.label}-${link.url}`}
                  icon={target.kind === 'external' ? ExternalLink : Link2}
                  title={link.label}
                  onPress={() => followLink(link.url, go)}
                />
              );
            })}
          </ListGroup>
        )}
      </QueryView>
    </Screen>
  );
}
