/**
 * Security (fingerprint unlock, 2-step sign-in, password), Settings
 * (language, theme, notifications, WhatsApp) and notification preferences.
 *
 * The 2-step secret and recovery codes are shown once and never stored on
 * the phone.
 */

import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { securityApi } from '../../api/auth';
import { notificationsApi } from '../../api/notifications';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceField, SwitchRow, TextField } from '../../components/Field';
import { IconTile, KeyValue, ListGroup, ListRow } from '../../components/List';
import { Screen, Section, Stack } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { useResetOnOpen } from '../../components/sheetContext';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { ErrorState, Notice, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { toast } from '../../components/Toast';
import { formatDate } from '../../core/dates';
import { applyRows, groupPreferences, toggleGroup, type Preference } from '../../core/notificationGroups';
import { checks, passwordProblem } from '../../core/validators';
import { biometricAvailable, signInWithPassword } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { pushReady } from '../../lib/push';
import { useSession } from '../../lib/session';
import { useSettings, type ThemePreference } from '../../lib/settings';
import { useAction } from '../../lib/useAction';
import { useGo } from '../../navigation/navigate';
import { spacing } from '../../theme/tokens';

// ── Security ────────────────────────────────────────────────────────────────

export function SecurityScreen() {
  const { settings, update } = useSettings();
  const mfa = useQuery({ queryKey: ['mfa'], queryFn: securityApi.mfaStatus });
  const [canBiometric, setCanBiometric] = useState<boolean | null>(null);
  const [setup, setSetup] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    void biometricAvailable().then(setCanBiometric);
  }, []);

  return (
    <Screen onRefresh={() => mfa.refetch()}>
      <Section title={t('On this phone')}>
        <Card>
          <SwitchRow
            label={t('Unlock with fingerprint or face')}
            description={
              canBiometric === false
                ? t('This phone has no fingerprint or face unlock set up. Add one in the phone’s settings first.')
                : t('Asked when you open the app after a while away.')
            }
            value={Boolean(settings.biometric && canBiometric)}
            onChange={(biometric) => update({ biometric })}
            disabled={!canBiometric}
          />
        </Card>
      </Section>

      <Section title={t('2-step sign-in')} description={t('A code from an authenticator app as well as your password.')}>
        <QueryView query={mfa} skeleton={<SkeletonCard lines={2} />}>
          {(m) => (
            <Card>
              <Stack gap="inline">
                <View style={styles.titleRow}>
                  <IconTile icon={ShieldCheck} tone={m.enabled ? 'success' : 'warning'} />
                  <Txt variant="bodyStrong" style={styles.flex}>
                    {m.enabled ? t('On') : t('Off')}
                  </Txt>
                  <Badge label={m.enabled ? t('Protected') : t('Recommended')} tone={m.enabled ? 'success' : 'warning'} />
                </View>
                {m.enabled && m.enabled_at ? (
                  <Txt variant="caption" tone="muted">
                    {t('Since {date} · {count} recovery codes left', { date: formatDate(m.enabled_at as string), count: (m.recovery_codes_left as number) ?? 0 })}
                  </Txt>
                ) : null}
                {m.enabled ? (
                  <Button label={t('Turn off')} size="sm" variant="ghost" onPress={() => setDisabling(true)} />
                ) : (
                  <Button label={t('Turn on')} size="sm" variant="primary" onPress={() => setSetup(true)} />
                )}
              </Stack>
            </Card>
          )}
        </QueryView>
      </Section>

      <Section title={t('Password')}>
        <ListGroup>
          <ListRow spot="key" title={t('Change password')} onPress={() => setChanging(true)} />
        </ListGroup>
      </Section>

      <MfaSetupSheet open={setup} onClose={() => setSetup(false)} />
      <MfaDisableSheet open={disabling} onClose={() => setDisabling(false)} />
      <PasswordSheet open={changing} onClose={() => setChanging(false)} />
    </Screen>
  );
}

function MfaSetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [secret, setSecret] = useState<{ secret: string; uri: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState(false);
  useResetOnOpen(open, () => {
    setSecret(null);
    setCode('');
    setCodes(null);
    setTouched(false);
    setFailed(false);
  });
  const begin = useAction(() => securityApi.mfaSetup(), {
    onSuccess: (r) => setSecret({ secret: String(r.secret), uri: typeof r.otpauth_uri === 'string' ? (r.otpauth_uri as string) : null }),
  });
  const enable = useAction(() => securityApi.mfaEnable(code.trim()), {
    success: t('2-step sign-in is on'),
    invalidate: [['mfa']],
    onSuccess: (r) => setCodes(Array.isArray(r.recovery_codes) ? (r.recovery_codes as string[]) : []),
  });
  const fetchKey = () => {
    setFailed(false);
    void begin.run(undefined).then((r) => {
      if (!r) setFailed(true);
    });
  };
  useEffect(() => {
    // Only once per opening: the key changes every time it is asked for.
    if (open && !secret && !codes && !begin.pending) fetchKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const codeError = !/^\d{6}$/.test(code.trim()) ? t('Enter the 6-digit code from the app.') : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={codes ? t('Save your recovery codes') : t('Turn on 2-step sign-in')}
      dirty={Boolean(code) && !codes}
      footer={
        codes ? (
          <Button label={t('I have saved them')} variant="primary" onPress={onClose} fullWidth />
        ) : (
          <Button label={t('Turn on')} variant="accent" loading={enable.pending} disabled={!secret} onPress={() => { setTouched(true); if (!codeError) void enable.run(undefined); }} fullWidth />
        )
      }
    >
      {codes ? (
        <>
          <Notice tone="warning" message={t('If you lose your phone, each code signs you in once. They are shown only now, so keep them somewhere safe.')} />
          <Card variant="sunken">
            <Stack gap="tight">
              {codes.map((c) => (
                <Txt key={c} variant="bodyStrong" numeric selectable>
                  {c}
                </Txt>
              ))}
            </Stack>
          </Card>
          <Button
            label={t('Copy codes')}
            size="sm"
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(codes.join('\n'));
              toast.success(t('Copied'));
            }}
          />
        </>
      ) : !secret ? (
        failed ? (
          <Stack gap="inline">
            <Notice tone="warning" message={t('Could not start the set-up. Nothing has changed.')} />
            <Button label={t('Try again')} size="sm" variant="secondary" onPress={fetchKey} />
          </Stack>
        ) : (
          <SkeletonList rows={2} />
        )
      ) : (
        <>
          <Txt variant="callout">{t('1. Add AskMiraa to your authenticator app (Google Authenticator, Microsoft Authenticator…).')}</Txt>
          {secret.uri ? <Button label={t('Open authenticator app')} size="sm" variant="secondary" onPress={() => void Linking.openURL(secret.uri!).catch(() => toast.info(t('No authenticator app found. Type the key instead.')))} /> : null}
          <Card variant="sunken">
            <Stack gap="tight">
              <Txt variant="caption" tone="muted">
                {t('Or type this key')}
              </Txt>
              <Txt variant="bodyStrong" numeric selectable>
                {secret.secret.replace(/(.{4})/g, '$1 ').trim()}
              </Txt>
              <Button
                label={t('Copy key')}
                size="sm"
                variant="ghost"
                onPress={async () => {
                  await Clipboard.setStringAsync(secret.secret);
                  toast.success(t('Copied'));
                }}
              />
            </Stack>
          </Card>
          <Txt variant="callout">{t('2. Enter the 6-digit code it shows.')}</Txt>
          <TextField
            label={t('Code')}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            error={touched ? codeError : null}
          />
        </>
      )}
    </Sheet>
  );
}

function MfaDisableSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setPassword('');
    setCode('');
    setTouched(false);
  });
  const errors = { password: !password ? t('Your password.') : null, code: !code.trim() ? t('A code from the app, or a recovery code.') : null };
  const off = useAction(() => securityApi.mfaDisable(password, code.trim()), { success: t('2-step sign-in is off'), invalidate: [['mfa']], onSuccess: onClose });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Turn off 2-step sign-in?')}
      description={t('Your account will be protected by your password alone.')}
      dirty={Boolean(password || code)}
      footer={<Button label={t('Turn off')} variant="danger" loading={off.pending} onPress={() => { setTouched(true); if (!errors.password && !errors.code) void off.run(undefined); }} fullWidth />}
    >
      <TextField label={t('Password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" error={touched ? errors.password : null} />
      <TextField label={t('Code')} value={code} onChangeText={setCode} autoCapitalize="none" error={touched ? errors.code : null} />
    </Sheet>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setCurrent('');
    setNext('');
    setRepeat('');
    setTouched(false);
  });
  const errors = {
    current: !current ? t('Your current password.') : null,
    next: passwordProblem(next) ? t(passwordProblem(next)!) : next === current ? t('Choose a different password.') : null,
    repeat: repeat !== next ? t('The two do not match.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const { session, signOut } = useSession();
  // The server ends every session when a password changes, this phone's too.
  // Sign straight back in with the new one; with 2-step on that needs a code,
  // so the person signs in again themselves.
  const change = useAction(
    async () => {
      await securityApi.changePassword(current, next);
      const email = session?.user.email;
      try {
        const outcome = email ? await signInWithPassword(email, next, session?.tenant.slug) : null;
        return outcome?.kind === 'signed_in';
      } catch {
        return false;
      }
    },
    {
      onSuccess: (stillSignedIn) => {
        onClose();
        if (stillSignedIn) {
          toast.success(t('Password changed'));
        } else {
          toast.info(t('Password changed. Sign in with your new password.'));
          void signOut();
        }
      },
    },
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Change password')}
      dirty={Boolean(current || next || repeat)}
      footer={<Button label={t('Change password')} variant="accent" loading={change.pending} onPress={() => { setTouched(true); if (!invalid) void change.run(undefined); }} fullWidth />}
    >
      <TextField label={t('Current password')} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" error={touched ? errors.current : null} />
      <TextField label={t('New password')} value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" helper={t('At least 10 characters, with a letter and a digit.')} error={touched ? errors.next : null} />
      <TextField label={t('New password again')} value={repeat} onChangeText={setRepeat} secureTextEntry autoCapitalize="none" error={touched ? errors.repeat : null} />
    </Sheet>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const go = useGo();
  const { settings, update } = useSettings();
  const consent = useQuery({ queryKey: ['whatsapp-consent'], queryFn: notificationsApi.whatsappConsent });
  const [whatsapp, setWhatsapp] = useState(false);
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <Screen tier="tier2">
      <Section title={t('App')}>
        <Card>
          <Stack gap="row">
            <ChoiceField
              label={t('Language')}
              value={settings.language}
              options={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'हिन्दी' },
              ]}
              onChange={(language) => update({ language })}
            />
            <ChoiceField
              label={t('Appearance')}
              value={settings.theme}
              options={[
                { value: 'system', label: t('Same as phone') },
                { value: 'light', label: t('Light') },
                { value: 'dark', label: t('Dark') },
              ]}
              onChange={(theme) => update({ theme: theme as ThemePreference })}
            />
          </Stack>
        </Card>
      </Section>
      <Section title={t('Notifications')}>
        <ListGroup>
          <ListRow spot="bell" title={t('What you are told about')} subtitle={t('By area, in the app, on your phone and by email')} onPress={() => go('NotificationPrefs')} />
          <ListRow
            spot="phone"
            title={t('WhatsApp')}
            subtitle={consent.data?.opted_in ? t('On, to {phone}', { phone: displayPhone(consent.data.phone_e164) }) : t('Off')}
            onPress={() => setWhatsapp(true)}
          />
        </ListGroup>
      </Section>
      <Section title={t('About')}>
        <Card variant="sunken">
          <KeyValue label={t('Version')} value={version} />
        </Card>
      </Section>
      <WhatsappSheet open={whatsapp} onClose={() => setWhatsapp(false)} current={consent.data ?? null} />
    </Screen>
  );
}

function WhatsappSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: { phone_e164: string; opted_in: boolean } | null }) {
  const [phone, setPhone] = useState(current?.phone_e164 ?? '');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setPhone(current?.phone_e164 ?? '');
    setTouched(false);
  });
  const compact = phone.replace(/[\s()-]/g, '');
  const e164 = compact.startsWith('+') ? compact : `+91${compact}`;
  const error = checks.phone(phone.trim()) ? t(checks.phone(phone.trim())!) : null;
  const save = useAction((optIn: boolean) => notificationsApi.setWhatsappConsent(e164, optIn), {
    success: (_, optIn) => (optIn ? t('WhatsApp messages are on') : t('WhatsApp messages are off')),
    invalidate: [['whatsapp-consent']],
    onSuccess: onClose,
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('WhatsApp messages')}
      description={t('Messages on WhatsApp as well as in the app, for the areas you choose under notifications. You can stop any time.')}
      dirty={phone !== (current?.phone_e164 ?? '')}
      footer={
        <Stack gap="inline">
          <Button label={current?.opted_in ? t('Update number') : t('Turn on')} variant="accent" loading={save.pending} onPress={() => { setTouched(true); if (!error) void save.run(true); }} fullWidth />
          {current?.opted_in ? <Button label={t('Turn off')} variant="ghost" onPress={() => void save.run(false)} fullWidth /> : null}
        </Stack>
      }
    >
      <TextField
        label={t('WhatsApp number')}
        value={phone}
        // Digits, spaces, dashes and a leading + only: a pasted name or letters never get in.
        onChangeText={(v) => setPhone(v.replace(/[^\d+\s()-]/g, '').replace(/(?!^)\+/g, ''))}
        keyboardType="phone-pad"
        maxLength={20}
        placeholder="+91 98450 00000"
        error={touched ? error : null}
      />
    </Sheet>
  );
}

/** "+919845012345" as "+91 98450 12345"; other countries as stored. */
function displayPhone(e164: string): string {
  const india = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return india ? `+91 ${india[1]} ${india[2]}` : e164;
}

// ── Notification preferences ────────────────────────────────────────────────

const CHANNEL_LABEL: Record<string, string> = { in_app: 'In the app', push: 'On your phone', email: 'Email', whatsapp: 'WhatsApp' };

export function NotificationPrefsScreen() {
  const prefs = useQuery({ queryKey: ['notification-prefs'], queryFn: notificationsApi.preferences });
  const consent = useQuery({ queryKey: ['whatsapp-consent'], queryFn: notificationsApi.whatsappConsent });
  const [local, setLocal] = useState<Preference[] | null>(null);
  const [phoneReady, setPhoneReady] = useState<boolean | null>(null);
  useEffect(() => {
    void pushReady().then(setPhoneReady);
  }, []);
  useEffect(() => {
    if (prefs.data) setLocal(prefs.data.map((p) => ({ event_key: p.event_key, channel: p.channel, enabled: p.enabled, digest_mode: p.digest_mode })));
  }, [prefs.data]);
  const whatsapp = Boolean(consent.data?.opted_in);
  const groups = useMemo(() => (local ? groupPreferences(local, whatsapp ? ['in_app', 'push', 'email', 'whatsapp'] : ['in_app', 'push', 'email']) : []), [local, whatsapp]);
  const save = useAction(
    (rows: Preference[]) =>
      notificationsApi.savePreferences(
        rows.map((r) => ({ event_key: r.event_key, channel: r.channel as never, enabled: r.enabled, digest_mode: (r.digest_mode ?? 'immediate') as never })),
      ),
    { success: t('Saved'), invalidate: [['notification-prefs']] },
  );

  if (prefs.isPending || !local) {
    return (
      <Screen tier="tier2">
        {prefs.error ? <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} /> : <SkeletonList rows={6} />}
      </Screen>
    );
  }
  return (
    <Screen tier="tier2" onRefresh={() => prefs.refetch()}>
      <Txt variant="callout" tone="muted">
        {t('Approvals waiting on you and other urgent messages always reach you in the app.')}
      </Txt>
      {phoneReady === false ? (
        <Notice
          tone="info"
          message={t('This phone is not receiving notifications yet. Allow notifications for AskMiraa in the phone’s settings, then open the app again.')}
          action={{ label: t('Open phone settings'), onPress: () => void Linking.openSettings() }}
        />
      ) : null}
      <Stack gap="row">
        {groups.map((g) => (
          <Card key={g.key}>
            <Stack gap="tight">
              <Txt variant="headline">{t(g.label)}</Txt>
              {g.channels.map((c) => (
                <SwitchRow
                  key={c.channel}
                  label={t(CHANNEL_LABEL[c.channel] ?? c.channel)}
                  description={c.mixed ? t('On for some') : undefined}
                  value={c.on}
                  onChange={async (enabled) => {
                    const rows = toggleGroup(local, g, c.channel, enabled);
                    const before = local;
                    setLocal(applyRows(local, rows));
                    if (!(await save.run(rows))) setLocal(before);
                  }}
                />
              ))}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

