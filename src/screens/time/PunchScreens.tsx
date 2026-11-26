/**
 * Punch, with the map — and the punch history.
 *
 * The older HRMS's punch screen, kept familiar: a live clock and the date, a
 * map of where you are with the address under it, and Punch in / Punch out.
 * What is new: your work locations are drawn on the map, the screen says
 * plainly whether you are inside one ("At Bengaluru HQ") or how far away, and
 * every location problem (not allowed, switched off, no fix yet) comes with
 * the one thing that fixes it.
 *
 * Punch history lists each day's punches (the old "In Out" report, for the
 * person themselves), and "On this phone" lists punches made without signal
 * and what became of them.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ChevronDown, ChevronUp, History, LocateFixed, LogIn, LogOut, MapPin, MapPinOff, Navigation, RefreshCw } from 'lucide-react-native';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { attendanceApi, monthPeriodQuery } from '../../api/attendance';
import { Badge, Pill } from '../../components/Badge';
import { Button, IconButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { ListGroup, ListRow } from '../../components/List';
import { FixLine, LocateButton } from '../../components/LocateButton';
import { Screen, Section } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { PlaceMap } from '../../components/PlaceMap';
import { EmptyState, Notice, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { toast } from '../../components/Toast';
import { MONTHS, WEEKDAYS, addDays, formatClock, formatDate, formatMinutes, localDay, parseISODate, todayISO, weekday } from '../../core/dates';
import { coordinateLine, placeLine } from '../../core/geo';
import { workedMinutes } from '../../core/home';
import { describeState, type QueuedPunch } from '../../core/offlineQueue';
import { statusLabel } from '../../core/status';
import type { PunchRead } from '../../core/types';
import { t, tn } from '../../lib/i18n';
import { punchQueueFor } from '../../lib/punchQueue';
import { useSession } from '../../lib/session';
import { fixIsGood, useLivePosition } from '../../lib/useLivePosition';
import { useNow } from '../../lib/useNow';
import { usePunch } from '../../lib/usePunch';
import { useGo } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';
import { dateHeading, PunchResultSheet } from './PunchParts';

export function PunchScreen() {
  const navigation = useNavigation();
  const go = useGo();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const now = useNow(1000);
  const punch = usePunch();
  const today = todayISO(now);
  const period = useQuery(monthPeriodQuery(today));
  const tracking = punch.enabled && punch.locationMode !== 'off';
  const live = useLivePosition(tracking);
  const [result, setResult] = useState<QueuedPunch | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <IconButton icon={Briefcase} label={t('Client visits')} onPress={() => go('Visits')} />
          <IconButton icon={History} label={t('Punch history')} onPress={() => go('PunchHistory')} />
        </View>
      ),
    });
  }, [navigation, go]);

  const todayPunches = useMemo(
    () => [...punch.serverPunches].filter((p) => localDay(p.punched_at) === today).sort((a, b) => a.punched_at.localeCompare(b.punched_at)),
    [punch.serverPunches, today],
  );
  const last = todayPunches[todayPunches.length - 1];
  const place = live.position ? placeLine(live.position.latitude, live.position.longitude, punch.workLocations) : null;
  const shift = period.data?.shift_today ?? null;
  const mapHeight = Math.round(Math.min(width * 0.8, layout.avatarXl * 3.4));
  // Location required: the buttons wait for the settings and a precise enough fix.
  const waiting =
    punch.locationMode === 'required' && (!punch.settingsReady || !fixIsGood(live.position, punch.accuracyNeeded));

  const run = async (direction: 'in' | 'out') => {
    // Record the place shown on the map, so the address you see is the one HR sees.
    const settled = await punch.punch(direction, live.position);
    if (settled) setResult(settled);
  };

  return (
    <Screen onRefresh={() => Promise.all([punch.refresh(), period.refetch()]).then(() => live.retry())}>
      <View style={styles.clockBlock}>
        <Txt variant="clock" numeric align="center" accessibilityRole="timer">
          {formatClock(now)}
        </Txt>
        <Txt variant="overline" tone="muted" align="center">
          {dateHeading(today)}
        </Txt>
        {shift ? (
          <View style={styles.centrePill}>
            <Pill label={`${shift.name} · ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`} />
          </View>
        ) : null}
      </View>

      {!punch.enabled ? (
        <EmptyState spot="device" title={t('Punching is not available')} message={t('Your login is not linked to an employee record, or attendance is switched off for your company.')} />
      ) : punch.locationMode === 'off' ? (
        <Notice tone="info" icon={MapPinOff} message={t('Your company does not record a location with punches. Tap a button below to punch.')} />
      ) : (
        <Card padded="none">
          <View>
          {live.position ? (
            <PlaceMap
              latitude={live.position.latitude}
              longitude={live.position.longitude}
              accuracy={live.position.accuracy}
              height={mapHeight}
              places={punch.workLocations}
              controls
              framed={false}
              accessibilityLabel={t('Map of where you are')}
            />
          ) : (
            <View style={[styles.mapPlaceholder, { height: mapHeight, backgroundColor: colors.surfaceSunken }]}>
              {live.locating ? (
                <>
                  <LocateFixed size={layout.iconXl} color={colors.textSubtle} strokeWidth={1.75} />
                  <Txt variant="callout" tone="muted" align="center">
                    {t('Finding your location…')}
                  </Txt>
                </>
              ) : (
                <>
                  <MapPinOff size={layout.iconXl} color={colors.textSubtle} strokeWidth={1.75} />
                  <Txt variant="callout" tone="muted" align="center">
                    {t('No map without your location')}
                  </Txt>
                </>
              )}
            </View>
          )}
          <LocateButton onPress={() => void live.locate()} busy={live.locatingNow} />
          </View>
          <View style={styles.where}>
            <View style={styles.whereRow}>
              <MapPin size={layout.icon} color={colors.primaryText} strokeWidth={2} />
              <Txt variant="body" style={styles.flex} numberOfLines={3}>
                {live.position
                  ? (live.address ?? coordinateLine(live.position.latitude, live.position.longitude))
                  : live.locating
                    ? t('Looking for you…')
                    : t('Location unknown')}
              </Txt>
            </View>
            {place ? (
              <View style={styles.whereRow}>
                <Navigation size={layout.icon} color={place.inside ? colors.success : colors.warning} strokeWidth={2} />
                <Txt variant="calloutStrong" tone={place.inside ? 'success' : 'warning'} style={styles.flex}>
                  {t(place.text)}
                </Txt>
              </View>
            ) : null}
            {punch.locationMode === 'required' ? (
              <FixLine position={live.position} needed={punch.accuracyNeeded} locating={live.locating || live.locatingNow} action={t('Punch in and out')} />
            ) : null}
          </View>
        </Card>
      )}

      {tracking && live.problem === 'denied' ? (
        <Notice
          tone={punch.locationMode === 'required' ? 'danger' : 'warning'}
          title={t('Location is not allowed for AskMiraa')}
          message={
            punch.locationMode === 'required'
              ? t('Your company needs your location to record a punch. Allow it in your phone settings, then come back.')
              : t('You can still punch, but HR will see it without a location.')
          }
          action={{ label: t('Open phone settings'), onPress: () => void Linking.openSettings() }}
        />
      ) : null}
      {tracking && live.problem === 'off' ? (
        <Notice
          tone={punch.locationMode === 'required' ? 'danger' : 'warning'}
          title={t('Location is switched off')}
          message={t('Turn on your phone’s location so the punch can say where you were.')}
          action={{ label: t('Turn on location'), onPress: () => void live.turnOn() }}
        />
      ) : null}
      {tracking && live.problem === 'settings' ? (
        <Notice
          tone={punch.locationMode === 'required' ? 'danger' : 'warning'}
          title={t('Turn on precise location')}
          message={t('Your phone’s location accuracy setting is off, so it cannot find you. Android will ask to turn it on.')}
          action={{ label: t('Turn it on'), onPress: () => void live.turnOn() }}
        />
      ) : null}
      {tracking && live.problem === 'unavailable' && !live.position ? (
        <Notice
          tone="warning"
          message={t('Your location could not be found yet. Step near a window or outside, then try again.')}
          action={{ label: t('Try again'), onPress: live.retry }}
        />
      ) : null}

      {punch.enabled ? (
        <View style={styles.buttons}>
          <Button
            label={t('Punch in')}
            icon={LogIn}
            variant={punch.direction === 'in' ? 'primary' : 'secondary'}
            loading={punch.busy && punch.direction === 'in'}
            disabled={punch.loading || punch.busy || waiting}
            onPress={() => void run('in')}
            style={styles.flex}
          />
          <Button
            label={t('Punch out')}
            icon={LogOut}
            variant={punch.direction === 'out' ? 'primary' : 'secondary'}
            loading={punch.busy && punch.direction === 'out'}
            disabled={punch.loading || punch.busy || waiting}
            onPress={() => void run('out')}
            style={styles.flex}
          />
        </View>
      ) : null}

      {punch.error ? (
        <Notice
          tone="danger"
          message={punch.error}
          action={punch.needsSettings ? { label: t('Open phone settings'), onPress: () => void Linking.openSettings() } : undefined}
        />
      ) : null}

      {punch.enabled ? (
        <Txt variant="callout" tone="muted" align="center">
          {last
            ? t('Your last punch was {direction} at {time}.', {
                direction: last.direction === 'in' ? t('IN') : t('OUT'),
                time: formatClock(last.punched_at, false),
              })
            : t('No punch yet today.')}
        </Txt>
      ) : null}

      <PunchResultSheet result={result} places={punch.workLocations} onClose={() => setResult(null)} />
    </Screen>
  );
}

// ── Punch history ────────────────────────────────────────────────────────────

const PAGE_DAYS = 14;

/** "29 Oct 2026 · Thu". */
function dayTitle(date: string): string {
  const ymd = parseISODate(date);
  if (!ymd) return date;
  return `${ymd.d} ${t(MONTHS[ymd.m - 1] ?? '')} ${ymd.y} · ${t(WEEKDAYS[weekday(date)] ?? '')}`;
}

/** A server punch in the shape the result sheet reads. */
function asQueued(p: PunchRead): QueuedPunch {
  return {
    id: p.id,
    direction: p.direction,
    punchedAt: p.punched_at,
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    state: 'synced',
    attempts: 0,
    queuedAt: p.punched_at,
    serverPunchedAt: p.punched_at,
    outsideGeofence: p.outside_geofence,
  };
}

export function PunchHistoryScreen() {
  const [segment, setSegment] = useState<'history' | 'phone'>('history');
  const { session } = useSession();
  const userId = session?.user.id ?? 'anonymous';
  const queryClient = useQueryClient();
  const local = useQuery({ queryKey: ['punch-queue', userId], queryFn: () => punchQueueFor(userId).all(), networkMode: 'always' });
  const onPhone = (local.data ?? []).filter((p) => p.state !== 'synced');

  return (
    <Screen
      onRefresh={() =>
        Promise.all([local.refetch(), queryClient.invalidateQueries({ queryKey: ['attendance', 'punches', 'history'] })])
      }
    >
      <Segmented
        segments={[
          { value: 'history', label: t('Punch history') },
          { value: 'phone', label: t('On this phone'), count: onPhone.length, quiet: true },
        ]}
        value={segment}
        onChange={setSegment}
      />
      {segment === 'history' ? <ServerHistory /> : <PhoneQueue punches={onPhone} loading={local.isPending} userId={userId} />}
    </Screen>
  );
}

function ServerHistory() {
  const { colors } = useTheme();
  const punch = usePunch();
  const today = todayISO();
  const [days, setDays] = useState(PAGE_DAYS);
  const from = addDays(today, -(days - 1));
  const punches = useQuery({ queryKey: ['attendance', 'punches', 'history', from, today], queryFn: () => attendanceApi.punches(from, today) });
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [shown, setShown] = useState<QueuedPunch | null>(null);

  const byDay = useMemo(() => {
    const groups = new Map<string, PunchRead[]>();
    for (const p of punches.data ?? []) {
      const day = localDay(p.punched_at) ?? p.punched_at.slice(0, 10);
      groups.set(day, [...(groups.get(day) ?? []), p]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, list]) => ({ day, punches: [...list].sort((a, b) => b.punched_at.localeCompare(a.punched_at)) }));
  }, [punches.data]);

  // The two latest days start open, as on the older HRMS.
  const isOpen = (day: string, index: number) => (open ? open.has(day) : index < 2);
  const toggle = (day: string, index: number) => {
    const next = new Set(open ?? byDay.slice(0, 2).map((g) => g.day));
    if (isOpen(day, index)) next.delete(day);
    else next.add(day);
    setOpen(next);
  };

  return (
    <>
      <Txt variant="caption" tone="muted">
        {t('{from} to {to}', { from: formatDate(from), to: formatDate(today) })}
      </Txt>
      <QueryView
        query={punches}
        skeleton={<SkeletonList rows={5} />}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState spot="inOut" title={t('No punches in these days')} message={t('Punches from the app, the biometric device or the web show here.')} />}
      >
        {() => (
          <View style={styles.days}>
            {byDay.map((group, index) => {
              const expanded = isOpen(group.day, index);
              const worked = workedMinutes(group.punches, group.day === today ? new Date().toISOString() : group.punches[0]!.punched_at);
              return (
                <Card key={group.day} padded="none">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${dayTitle(group.day)}, ${group.punches.length} ${t('punches')}`}
                    onPress={() => toggle(group.day, index)}
                    style={({ pressed }) => [styles.dayHeader, pressed && { backgroundColor: colors.surfaceSunken }]}
                  >
                    <View style={styles.flex}>
                      <Txt variant="bodyStrong">{dayTitle(group.day)}</Txt>
                      <Txt variant="caption" tone="muted">
                        {tn(group.punches.length, '{count} punch · {worked} worked', '{count} punches · {worked} worked', { worked: formatMinutes(worked) })}
                      </Txt>
                    </View>
                    {expanded ? <ChevronUp size={layout.icon} color={colors.textMuted} /> : <ChevronDown size={layout.icon} color={colors.textMuted} />}
                  </Pressable>
                  {expanded
                    ? group.punches.map((p) => (
                        <View key={p.id} style={[styles.punchRow, { borderColor: colors.divider }]}>
                          <View style={[styles.directionChip, { backgroundColor: p.direction === 'in' ? colors.successSoft : colors.accentSoft }]}>
                            {p.direction === 'in' ? (
                              <LogIn size={layout.iconSm} color={colors.success} strokeWidth={2.25} />
                            ) : (
                              <LogOut size={layout.iconSm} color={colors.accentText} strokeWidth={2.25} />
                            )}
                          </View>
                          <View style={styles.flex}>
                            <Txt variant="bodyStrong" numeric>
                              {formatClock(p.punched_at)}
                            </Txt>
                            <Txt variant="caption" tone="muted" numberOfLines={1}>
                              {[p.direction === 'in' ? t('In') : t('Out'), t(statusLabel(p.source)), p.location_label].filter(Boolean).join(' · ')}
                            </Txt>
                          </View>
                          {p.outside_geofence ? <Badge label={t('Outside')} tone="warning" /> : null}
                          {p.latitude !== null && p.latitude !== undefined ? (
                            <IconButton icon={MapPin} label={t('Show on map')} onPress={() => setShown(asQueued(p))} />
                          ) : null}
                        </View>
                      ))
                    : null}
                </Card>
              );
            })}
            <Button label={t('Show 14 days earlier')} variant="secondary" onPress={() => setDays((d) => d + PAGE_DAYS)} fullWidth />
          </View>
        )}
      </QueryView>
      <PunchResultSheet result={shown} places={punch.workLocations} onClose={() => setShown(null)} inHistory />
    </>
  );
}

function PhoneQueue({ punches, loading, userId }: { punches: QueuedPunch[]; loading: boolean; userId: string }) {
  const go = useGo();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);

  if (loading) return <SkeletonCard lines={3} />;
  if (!punches.length) {
    return (
      <EmptyState
        spot="device"
        title={t('Nothing waiting on this phone')}
        message={t('A punch made without signal is kept here and sent as soon as the phone is back online.')}
      />
    );
  }
  const waiting = punches.some((p) => p.state === 'queued' || p.state === 'failed');
  return (
    <Section>
      <ListGroup>
        {[...punches]
          .sort((a, b) => b.punchedAt.localeCompare(a.punchedAt))
          .map((p) => {
            const state = describeState(p);
            const day = localDay(p.punchedAt) ?? p.punchedAt.slice(0, 10);
            return (
              <ListRow
                key={p.id}
                icon={p.direction === 'in' ? LogIn : LogOut}
                iconTone={state.needsAttention ? 'danger' : 'warning'}
                title={`${p.direction === 'in' ? t('In') : t('Out')} · ${formatDate(day)}, ${formatClock(p.punchedAt)}`}
                subtitle={t(state.label)}
                onPress={state.needsAttention ? () => go('Regularise', { date: day, punchId: p.id, direction: p.direction, at: p.punchedAt }) : undefined}
                trailing={state.needsAttention ? <Badge label={t('Regularise')} tone="danger" /> : undefined}
              />
            );
          })}
      </ListGroup>
      {waiting ? (
        <Button
          label={t('Send now')}
          icon={RefreshCw}
          variant="primary"
          loading={sending}
          onPress={async () => {
            setSending(true);
            try {
              const summary = await punchQueueFor(userId).sync();
              if (summary.synced) toast.success(t('Sent'));
              else toast.info(t('Still no signal. They will go when the phone is back online.'));
            } finally {
              setSending(false);
              void queryClient.invalidateQueries({ queryKey: ['punch-queue', userId] });
              void queryClient.invalidateQueries({ queryKey: ['attendance'] });
            }
          }}
          fullWidth
        />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  clockBlock: { alignItems: 'center', gap: spacing.xs },
  centrePill: { paddingTop: spacing.xs },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: layout.card },
  where: { padding: layout.card, gap: spacing.sm },
  whereRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  days: { gap: layout.row },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: layout.row, paddingHorizontal: layout.card, paddingVertical: spacing.md, minHeight: layout.rowHeight },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.row,
    paddingHorizontal: layout.card,
    paddingVertical: spacing.sm,
    borderTopWidth: layout.hairline,
    minHeight: layout.rowHeight,
  },
  directionChip: { width: layout.iconTile - spacing.sm, height: layout.iconTile - spacing.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
