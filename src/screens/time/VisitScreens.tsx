/**
 * Client visits: Visit in when you reach a client, Visit out when you leave.
 *
 * For sales and marketing people out in the field. Location is always on
 * here, whatever the company's punch rule: the map shows where you are, the
 * locate button asks the phone again (as on Google Maps), and both buttons
 * stay off until the fix is as precise as the company asks. Visit in also
 * needs who or where it is and a selfie taken there. A visit never changes
 * the day's attendance.
 *
 * Visits are sent straight away, not queued: a visit with no signal says so
 * and can be pressed again once the phone is back online.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Briefcase, Camera, Clock, LogIn, LogOut, MapPin, MapPinned, RefreshCw, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Linking, StyleSheet, View, useWindowDimensions } from 'react-native';

import { attendanceApi, type FieldVisit } from '../../api/attendance';
import { Badge } from '../../components/Badge';
import { Button, IconButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/Field';
import { ListGroup, ListRow } from '../../components/List';
import { FixLine, LocateButton } from '../../components/LocateButton';
import { PlaceMap } from '../../components/PlaceMap';
import { Screen, Section } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, Notice, QueryView, describeError } from '../../components/States';
import { Txt } from '../../components/Text';
import { toast } from '../../components/Toast';
import { addDays, formatClock, formatMinutes, localDay, todayISO } from '../../core/dates';
import { coordinateLine } from '../../core/geo';
import { takePhoto } from '../../lib/files';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { usePunch } from '../../lib/usePunch';
import { fixIsGood, useLivePosition, type LivePosition } from '../../lib/useLivePosition';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';

const NAME_LIMIT = 160;

/** The selfie, cut to a face's size so it stays well under the API's limit. */
async function selfieDataUrl(uri: string): Promise<string> {
  const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 640 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return `data:image/jpeg;base64,${small.base64 ?? ''}`;
}

export function VisitsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const now = useNow(30_000);
  const today = todayISO(now);
  const punch = usePunch();
  const needed = punch.accuracyNeeded;
  const live = useLivePosition(true);
  // From yesterday, so a visit left open overnight still offers Visit out.
  const visits = useQuery({
    queryKey: ['attendance', 'visits', 'mine', today],
    queryFn: () => attendanceApi.myVisits(addDays(today, -1), today),
  });

  const [clientName, setClientName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<{ uri: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState<'in' | 'out' | 'photo' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [shown, setShown] = useState<FieldVisit | null>(null);

  const list = visits.data?.visits ?? [];
  const open = list.find((v) => v.ended_at === null) ?? null;
  const todays = list.filter((v) => localDay(v.started_at) === today);
  const rows = open && !todays.includes(open) ? [open, ...todays] : todays;
  const ready = fixIsGood(live.position, needed);
  const mapHeight = Math.round(Math.min(width * 0.7, layout.avatarXl * 3));

  /** A fix good enough to record: the one on screen, or a fresh one. */
  const fix = async (): Promise<LivePosition | null> => {
    const current = fixIsGood(live.position, needed) ? live.position : await live.locate();
    if (!current) {
      setProblem(t('Your location could not be found. Turn on location and tap the locate button.'));
      return null;
    }
    if (current.mocked) {
      setProblem(t('A fake location app is changing your location. Turn it off (Settings → Developer options → Select mock location app → No app), then tap the locate button.'));
      return null;
    }
    if (current.accuracy !== null && current.accuracy > needed) {
      setProblem(
        t('Your location is only accurate to about {found} m; your company needs it within {needed} m. Tap the locate button, or step outside or near a window.', {
          found: String(Math.round(current.accuracy)),
          needed: String(needed),
        }),
      );
      return null;
    }
    return current;
  };

  const snap = async () => {
    setBusy('photo');
    try {
      const photo = await takePhoto({ maxMb: 10, types: ['image/*'] }, { front: true });
      if (photo) setSelfie({ uri: photo.uri, dataUrl: await selfieDataUrl(photo.uri) });
    } catch {
      toast.error(t('The selfie could not be used. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['attendance', 'visits'] });

  const visitIn = async () => {
    const name = clientName.split(/\s+/).filter(Boolean).join(' ');
    if (!name) {
      setNameError(t('Say who or where you are visiting.'));
      return;
    }
    if (!selfie) {
      setProblem(t('Take a selfie at the client’s place first.'));
      return;
    }
    setBusy('in');
    setProblem(null);
    try {
      const at = await fix();
      if (!at) return;
      const created = await attendanceApi.visitIn({
        client_name: name,
        latitude: at.latitude,
        longitude: at.longitude,
        accuracy_metres: Math.round(at.accuracy ?? 0),
        is_mocked: at.mocked === true,
        photo: selfie.dataUrl,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('Visit in at {name}, {time}', { name: created.client_name, time: formatClock(created.started_at, false) }));
      setClientName('');
      setNameError(null);
      setSelfie(null);
      await refresh();
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setProblem(describeError(error).message);
    } finally {
      setBusy(null);
    }
  };

  const visitOut = async () => {
    if (!open) return;
    setBusy('out');
    setProblem(null);
    try {
      const at = await fix();
      if (!at) return;
      const closed = await attendanceApi.visitOut(open.id, {
        latitude: at.latitude,
        longitude: at.longitude,
        accuracy_metres: Math.round(at.accuracy ?? 0),
        is_mocked: at.mocked === true,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('Visit out from {name} after {time}', { name: closed.client_name, time: formatMinutes(closed.duration_minutes ?? 0) }));
      await refresh();
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setProblem(describeError(error).message);
    } finally {
      setBusy(null);
    }
  };

  const openMinutes = open ? Math.max(0, Math.floor((now.getTime() - new Date(open.started_at).getTime()) / 60_000)) : 0;

  return (
    <Screen onRefresh={() => Promise.all([visits.refetch(), live.locate()])}>
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
              <MapPin size={layout.iconXl} color={colors.textSubtle} strokeWidth={1.75} />
              <Txt variant="callout" tone="muted" align="center">
                {live.locating || live.locatingNow ? t('Finding your location…') : t('No map without your location')}
              </Txt>
            </View>
          )}
          <LocateButton onPress={() => void live.locate()} busy={live.locatingNow} />
        </View>
        <View style={styles.where}>
          <View style={styles.row}>
            <MapPinned size={layout.icon} color={colors.primaryText} strokeWidth={2} />
            <Txt variant="body" style={styles.flex} numberOfLines={3}>
              {live.position ? (live.address ?? coordinateLine(live.position.latitude, live.position.longitude)) : t('Location unknown')}
            </Txt>
          </View>
          <FixLine position={live.position} needed={needed} locating={live.locating || live.locatingNow} action={t('Visit in and out')} />
        </View>
      </Card>

      {live.problem === 'denied' ? (
        <Notice
          tone="danger"
          title={t('Location is not allowed for AskMiraa')}
          message={t('Visits always record where you are. Allow location in your phone settings, then come back.')}
          action={{ label: t('Open phone settings'), onPress: () => void Linking.openSettings() }}
        />
      ) : live.problem === 'off' || live.problem === 'settings' ? (
        <Notice
          tone="danger"
          title={t('Location is switched off')}
          message={t('Turn on your phone’s location (precise) so the visit can say where you were.')}
          action={{ label: t('Turn on location'), onPress: () => void live.turnOn() }}
        />
      ) : live.problem === 'unavailable' && !live.position ? (
        <Notice
          tone="warning"
          message={t('Your location could not be found yet. Step near a window or outside, then try again.')}
          action={{ label: t('Try again'), onPress: () => void live.locate() }}
        />
      ) : null}

      {visits.isPending ? null : open ? (
        <Card tier="tier2">
          <View style={styles.stack}>
            <View style={styles.row}>
              <Badge label={t('On a visit')} tone="success" />
              <Txt variant="caption" tone="muted" numeric>
                {t('since {time} · {spent}', { time: formatClock(open.started_at, false), spent: formatMinutes(openMinutes) })}
              </Txt>
            </View>
            <Txt variant="title">{open.client_name}</Txt>
            <Button
              label={busy === 'out' ? t('Locating…') : t('Visit out')}
              icon={LogOut}
              variant="primary"
              loading={busy === 'out'}
              disabled={busy !== null || !ready}
              onPress={() => void visitOut()}
              fullWidth
            />
          </View>
        </Card>
      ) : (
        <Card tier="tier2">
          <View style={styles.stack}>
            <TextField
              label={t('Client or place')}
              value={clientName}
              onChangeText={(value) => {
                setClientName(value);
                if (nameError) setNameError(null);
              }}
              placeholder={t('e.g. Sharma Traders, Lajpat Nagar')}
              maxLength={NAME_LIMIT}
              error={nameError}
              required
              editable={busy === null}
              autoCapitalize="words"
              returnKeyType="done"
            />
            {selfie ? (
              <View style={styles.row}>
                <Image source={{ uri: selfie.uri }} style={[styles.selfie, { borderColor: colors.border }]} accessibilityLabel={t('Your selfie')} />
                <Txt variant="callout" tone="success" style={styles.flex}>
                  {t('Selfie ready')}
                </Txt>
                <IconButton icon={X} label={t('Remove the selfie')} onPress={() => setSelfie(null)} />
              </View>
            ) : (
              <Button
                label={t('Take a selfie')}
                icon={Camera}
                variant="secondary"
                loading={busy === 'photo'}
                disabled={busy !== null}
                onPress={() => void snap()}
                fullWidth
              />
            )}
            <Button
              label={busy === 'in' ? t('Locating…') : t('Visit in')}
              icon={LogIn}
              variant="primary"
              loading={busy === 'in'}
              disabled={busy !== null || !ready}
              onPress={() => void visitIn()}
              fullWidth
            />
          </View>
        </Card>
      )}

      {problem ? <Notice tone="danger" title={t('Visit not recorded')} message={problem} /> : null}

      <Section title={t('Today’s visits')}>
        <QueryView
          query={visits}
          skeleton={<SkeletonList rows={3} />}
          isEmpty={() => rows.length === 0}
          empty={<EmptyState spot="pin" title={t('No visits today')} message={t('Press Visit in when you reach a client. Visits from the web show here too.')} />}
        >
          {() => (
            <ListGroup>
              {rows.map((v) => (
                <ListRow
                  key={v.id}
                  icon={Briefcase}
                  title={v.client_name}
                  subtitle={
                    v.ended_at
                      ? t('In {from} · Out {to} · {spent}', {
                          from: formatClock(v.started_at, false),
                          to: formatClock(v.ended_at, false),
                          spent: formatMinutes(v.duration_minutes ?? 0),
                        })
                      : t('In {from} · on the visit now', { from: formatClock(v.started_at, false) })
                  }
                  trailing={v.ended_at ? undefined : <Badge label={t('Open')} tone="success" />}
                  onPress={() => setShown(v)}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
        {visits.isError ? (
          <Button label={t('Try again')} icon={RefreshCw} variant="secondary" onPress={() => void visits.refetch()} fullWidth />
        ) : null}
      </Section>

      <VisitSheet visit={shown} places={punch.workLocations} onClose={() => setShown(null)} />
    </Screen>
  );
}

function VisitSheet({ visit, places, onClose }: { visit: FieldVisit | null; places: ReturnType<typeof usePunch>['workLocations']; onClose: () => void }) {
  const { colors } = useTheme();
  if (!visit) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  return (
    <Sheet
      open
      onClose={onClose}
      title={visit.client_name}
      footer={<Button label={t('Close')} variant="secondary" onPress={onClose} fullWidth />}
    >
      <PlaceMap
        latitude={visit.start_latitude}
        longitude={visit.start_longitude}
        height={layout.avatarXl * 2}
        marker="pin"
        places={places}
        zoom={17}
        accessibilityLabel={t('Map of the visit')}
      />
      <View style={styles.facts}>
        <Fact icon={LogIn} text={t('Visit in at {time}', { time: formatClock(visit.started_at, false) })} strong />
        <Fact icon={MapPinned} text={visit.start_address ?? coordinateLine(visit.start_latitude, visit.start_longitude)} />
        {visit.ended_at ? (
          <>
            <Fact icon={LogOut} text={t('Visit out at {time}', { time: formatClock(visit.ended_at, false) })} strong />
            {visit.end_latitude !== null && visit.end_longitude !== null ? (
              <Fact icon={MapPinned} text={visit.end_address ?? coordinateLine(visit.end_latitude, visit.end_longitude)} />
            ) : null}
            <Fact icon={Clock} text={t('{spent} at the client', { spent: formatMinutes(visit.duration_minutes ?? 0) })} />
          </>
        ) : (
          <Fact icon={Clock} text={t('Still on this visit')} />
        )}
      </View>
      <View style={[styles.note, { backgroundColor: colors.surfaceSunken }]}>
        <Txt variant="caption" tone="muted">
          {t('HR and your manager see this visit with its map, address and your selfie.')}
        </Txt>
      </View>
    </Sheet>
  );
}

function Fact({ icon: Icon, text, strong }: { icon: typeof Clock; text: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Icon size={layout.icon} color={colors.primaryText} strokeWidth={2} />
      <Txt variant={strong ? 'bodyStrong' : 'body'} style={styles.flex}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: layout.row },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: layout.card },
  where: { padding: layout.card, gap: spacing.sm },
  selfie: { width: layout.iconTile + spacing.lg, height: layout.iconTile + spacing.lg, borderRadius: radius.md, borderWidth: layout.hairline },
  facts: { gap: layout.row },
  note: { padding: spacing.md, borderRadius: radius.control },
});
