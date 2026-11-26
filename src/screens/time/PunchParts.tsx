/**
 * The punch card (Home and Attendance) and the sheet that confirms a punch.
 *
 * The card is the portal's: the date as a small heading, a live clock in
 * Fraunces, "Not punched in" and today's shift as pills, how much of the shift
 * has been worked, and both buttons — Punch in and Punch out — with the one
 * that follows the last punch filled. A punch is written to the phone first
 * and sent after (lib/usePunch.ts), so the sheet that follows says honestly
 * whether it reached HR or is waiting for signal, with the map and address of
 * where it was made, as the older HRMS showed.
 */

import * as Location from 'expo-location';
import { Clock, LocateFixed, LogIn, LogOut, MapPin, MapPinned, Navigation } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Pill } from '../../components/Badge';
import { Button, IconButton, LinkButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { FixLine } from '../../components/LocateButton';
import { Sheet } from '../../components/Sheet';
import { PlaceMap } from '../../components/PlaceMap';
import { Notice, ProgressBar } from '../../components/States';
import { Txt } from '../../components/Text';
import { MONTHS_LONG, WEEKDAYS_LONG, formatClock, formatDate, formatMinutes, localDay, todayISO, weekday } from '../../core/dates';
import { addressLine, coordinateLine, placeLine, type WorkPlace } from '../../core/geo';
import { shiftMinutes, shiftTimes, workedMinutes } from '../../core/home';
import { describeState, type QueuedPunch } from '../../core/offlineQueue';
import { t, tn } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { fixIsGood, useLivePosition } from '../../lib/useLivePosition';
import type { usePunch } from '../../lib/usePunch';
import { useGo } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';

type Punch = ReturnType<typeof usePunch>;
type Shift = { name: string; start_time: string; end_time: string } | null;

/** "THURSDAY, 29 OCTOBER". */
export function dateHeading(today: string): string {
  const day = Number(today.slice(8));
  return `${t(WEEKDAYS_LONG[weekday(today)] ?? '')}, ${day} ${t(MONTHS_LONG[Number(today.slice(5, 7)) - 1] ?? '')}`.toUpperCase();
}

export function PunchCard({
  punch,
  shift,
  hasNoShift,
  onPunched,
  showLinks = true,
  heading,
}: {
  punch: Punch;
  shift: Shift;
  hasNoShift: boolean;
  /** Called with the settled punch, to show the result sheet. */
  onPunched: (result: QueuedPunch) => void;
  showLinks?: boolean;
  /** The small heading over the clock; today's date unless given. */
  heading?: string;
}) {
  const go = useGo();
  const { colors } = useTheme();
  const now = useNow(1000);
  const today = todayISO(now);

  const todayPunches = [...punch.serverPunches]
    .filter((p) => localDay(p.punched_at) === today)
    .sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  const first = todayPunches.find((p) => p.direction === 'in');
  const latest = todayPunches[todayPunches.length - 1];
  const statusLabel = !first
    ? t('Not punched in')
    : latest?.direction === 'out'
      ? t('Out at {time}', { time: formatClock(latest.punched_at, false) })
      : t('In since {time}', { time: formatClock((latest ?? first).punched_at, false) });
  const statusTone = !first ? 'neutral' : latest?.direction === 'out' ? 'info' : 'success';

  const worked = workedMinutes(todayPunches, now.toISOString());
  const planned = shiftMinutes(shift);
  const suggested = punch.direction;
  // Location required: watch the position while this card is on screen, and
  // keep both buttons off until it is as precise as the company asks.
  const required = punch.enabled && punch.locationMode === 'required';
  const live = useLivePosition(required);
  const waiting = required && (!punch.settingsReady || !fixIsGood(live.position, punch.accuracyNeeded));

  const run = async (direction: 'in' | 'out') => {
    const result = await punch.punch(direction, required ? live.position : undefined);
    if (result) onPunched(result);
  };

  return (
    <Card tier="tier2">
      <View style={styles.stack}>
        <View style={styles.dateRow}>
          <Clock size={layout.iconSm} color={colors.textMuted} strokeWidth={2} />
          <Txt variant="overline" tone="muted" numberOfLines={2} style={styles.flex}>
            {heading ?? dateHeading(today)}
          </Txt>
        </View>

        <Txt variant="clock" numeric accessibilityRole="timer" accessibilityLabel={formatClock(now, false)}>
          {formatClock(now)}
        </Txt>

        <View style={styles.pills}>
          <Pill dot={statusTone} label={statusLabel} />
          <Pill label={shift ? `${shift.name} · ${shiftTimes(shift)}` : hasNoShift ? t('No shift assigned') : t('Shift not set')} />
          {punch.locationMode !== 'off' ? (
            <Pill icon={MapPin} label={punch.locationMode === 'required' ? t('Location needed') : t('Location recorded')} />
          ) : null}
        </View>

        {planned ? (
          <View style={styles.worked}>
            <View style={styles.workedRow}>
              <Txt variant="callout" tone="muted">
                {t('Worked today')}{' '}
                <Txt variant="bodyStrong">{formatMinutes(worked)}</Txt> {t('of {hours}', { hours: formatMinutes(planned) })}
              </Txt>
            </View>
            <ProgressBar value={worked / planned} label={t('Worked {worked} of {planned}', { worked: formatMinutes(worked), planned: formatMinutes(planned) })} />
          </View>
        ) : null}

        <View style={styles.buttons}>
          <Button
            label={t('Punch in')}
            icon={LogIn}
            variant={suggested === 'in' ? 'primary' : 'secondary'}
            loading={punch.busy && suggested === 'in'}
            disabled={punch.loading || punch.busy || waiting}
            onPress={() => void run('in')}
            style={styles.flex}
            accessibilityHint={punch.photoRequired ? t('Takes a selfie, then records the punch.') : undefined}
          />
          <Button
            label={t('Punch out')}
            icon={LogOut}
            variant={suggested === 'out' ? 'primary' : 'secondary'}
            loading={punch.busy && suggested === 'out'}
            disabled={punch.loading || punch.busy || waiting}
            onPress={() => void run('out')}
            style={styles.flex}
          />
        </View>

        {required ? (
          <View style={styles.fixRow}>
            <View style={styles.flex}>
              <FixLine position={live.position} needed={punch.accuracyNeeded} locating={live.locating || live.locatingNow} action={t('Punch in and out')} />
            </View>
            <IconButton icon={LocateFixed} label={t('Find my location')} variant="outlined" disabled={live.locatingNow} onPress={() => void live.locate()} />
          </View>
        ) : null}

        {required && live.problem === 'denied' ? (
          <Notice
            tone="danger"
            title={t('Location is not allowed for AskMiraa')}
            message={t('Your company needs your location to record a punch. Allow it in your phone settings, then come back.')}
            action={{ label: t('Open phone settings'), onPress: () => void Linking.openSettings() }}
          />
        ) : null}
        {required && (live.problem === 'off' || live.problem === 'settings') ? (
          <Notice
            tone="danger"
            title={t('Location is switched off')}
            message={t('Turn on your phone’s location (precise) so the punch can say where you were.')}
            action={{ label: t('Turn on location'), onPress: () => void live.turnOn() }}
          />
        ) : null}
        {required && live.problem === 'unavailable' && !live.position ? (
          <Notice
            tone="warning"
            message={t('Your location could not be found yet. Step near a window or outside, then try again.')}
            action={{ label: t('Try again'), onPress: () => void live.locate() }}
          />
        ) : null}
        {punch.error ? (
          <Notice
            tone="danger"
            message={punch.error}
            action={punch.needsSettings ? { label: t('Open phone settings'), onPress: () => void Linking.openSettings() } : undefined}
          />
        ) : null}
        {punch.waiting.length ? (
          <Notice
            tone="warning"
            message={tn(punch.waiting.length, '{count} punch saved on this phone, waiting for signal.', '{count} punches saved on this phone, waiting for signal.')}
          />
        ) : null}
        {punch.needsAttention.length ? (
          <Notice
            tone="warning"
            title={t('A punch was not recorded')}
            message={t('It was saved offline at {time} but signal came back too late to send it. Raise a regularisation for that time.', {
              time: formatClock(punch.needsAttention[0]!.punchedAt, false),
            })}
            action={{
              label: t('Regularise'),
              onPress: () => {
                const p = punch.needsAttention[0]!;
                go('Regularise', { date: localDay(p.punchedAt) ?? p.punchedAt.slice(0, 10), punchId: p.id, direction: p.direction, at: p.punchedAt });
              },
            }}
          />
        ) : null}

        {showLinks ? (
          <View style={[styles.links, { borderColor: colors.divider }]}>
            <LinkButton label={t('Map & location')} onPress={() => go('Punch')} tone="primary" arrow />
            <LinkButton label={t('Client visits')} onPress={() => go('Visits')} tone="muted" arrow />
            <LinkButton label={t('Punch history')} onPress={() => go('PunchHistory')} tone="muted" arrow />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * After a punch: what was recorded, when and where. "Recorded" only once the
 * server has it; a punch still on the phone says so.
 */
export function PunchResultSheet({
  result,
  places,
  onClose,
  inHistory = false,
}: {
  result: QueuedPunch | null;
  places: WorkPlace[];
  onClose: () => void;
  /** Opened from the punch history: no link back to it. */
  inHistory?: boolean;
}) {
  const { colors } = useTheme();
  const go = useGo();
  const [address, setAddress] = useState<string | null>(null);
  const hasPlace = result?.latitude !== undefined && result?.longitude !== undefined;

  useEffect(() => {
    setAddress(null);
    if (!result || result.latitude === undefined || result.longitude === undefined) return;
    let alive = true;
    void Location.reverseGeocodeAsync({ latitude: result.latitude, longitude: result.longitude })
      .then(([found]) => alive && setAddress(addressLine(found)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [result]);

  if (!result) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const state = describeState(result);
  const direction = result.direction === 'in' ? t('Punch in') : t('Punch out');
  const title = state.confirmed
    ? result.outsideGeofence
      ? t('Recorded, outside your work location')
      : t('Your punch is recorded')
    : state.needsAttention
      ? t('This punch was not recorded')
      : t('Saved on this phone');
  const place = hasPlace ? placeLine(result.latitude!, result.longitude!, places) : null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      description={state.confirmed ? undefined : t(state.label)}
      footer={
        state.needsAttention ? (
          <Button
            label={t('Raise a regularisation')}
            variant="primary"
            onPress={() => {
              onClose();
              go('Regularise', { date: localDay(result.punchedAt) ?? result.punchedAt.slice(0, 10), punchId: result.id, direction: result.direction, at: result.punchedAt });
            }}
            fullWidth
          />
        ) : (
          <Button label={t('Close')} variant="secondary" onPress={onClose} fullWidth />
        )
      }
    >
      {hasPlace ? (
        <PlaceMap
          latitude={result.latitude!}
          longitude={result.longitude!}
          height={layout.avatarXl * 2}
          marker="pin"
          places={places}
          zoom={17}
          accessibilityLabel={t('Map of where you punched')}
        />
      ) : null}
      <View style={styles.facts}>
        <Fact icon={result.direction === 'in' ? LogIn : LogOut} text={direction} strong />
        <Fact icon={Clock} text={`${formatDate(localDay(result.punchedAt))}, ${formatClock(result.serverPunchedAt ?? result.punchedAt)}`} />
        {hasPlace ? (
          <Fact icon={MapPinned} text={address ?? coordinateLine(result.latitude!, result.longitude!)} />
        ) : (
          <Fact icon={MapPin} text={t('No location was shared with this punch.')} muted />
        )}
        {place ? <Fact icon={Navigation} text={t(place.text)} tone={place.inside ? 'success' : 'warning'} /> : null}
      </View>
      <View style={[styles.stateRow, { backgroundColor: state.confirmed ? colors.successSoft : state.needsAttention ? colors.dangerSoft : colors.warningSoft }]}>
        <View style={[styles.stateDot, { backgroundColor: state.confirmed ? colors.success : state.needsAttention ? colors.danger : colors.warning }]} />
        <Txt variant="callout" style={styles.flex}>
          {state.confirmed ? t('HR can see this punch now.') : t(state.label)}
        </Txt>
      </View>
      {inHistory ? null : (
        <LinkButton
          label={t('See punch history')}
          onPress={() => {
            onClose();
            go('PunchHistory');
          }}
          arrow
        />
      )}
    </Sheet>
  );
}

function Fact({
  icon: Icon,
  text,
  strong,
  muted,
  tone,
}: {
  icon: typeof Clock;
  text: string;
  strong?: boolean;
  muted?: boolean;
  tone?: 'success' | 'warning';
}) {
  const { colors } = useTheme();
  const color = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.primaryText;
  return (
    <View style={styles.fact}>
      <Icon size={layout.icon} color={color} strokeWidth={2} />
      <Txt variant={strong ? 'bodyStrong' : 'body'} tone={muted ? 'muted' : tone ?? 'default'} style={styles.flex}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: layout.row },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + spacing.xxs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  worked: { gap: spacing.sm },
  workedRow: { flexDirection: 'row', alignItems: 'baseline' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  fixRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, columnGap: spacing.md, borderTopWidth: layout.hairline, paddingTop: layout.row },
  facts: { gap: layout.row },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: layout.row },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.control },
  stateDot: { width: spacing.sm + spacing.xxs, height: spacing.sm + spacing.xxs, borderRadius: radius.pill },
});
