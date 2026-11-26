/**
 * Sign in.
 *
 * Step 1: work email or mobile number — the app learns which company it
 * belongs to and shows that company's name. Step 2: password, or the
 * company's single sign-on in the system browser. Step 3, when the
 * workspace asks: a 2-step code. "Forgot password" sends a reset link.
 */

import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_VERSION } from '../../components/AnimatedSplash';
import { BrandBackdrop } from '../../components/BrandBackdrop';
import { BrandLogo } from '../../components/Brand';
import { Button, LinkButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/Field';
import { KeyboardAware } from '../../components/KeyboardAware';
import { Notice } from '../../components/States';
import { Txt } from '../../components/Text';
import { TierContext } from '../../components/Tier';
import {
  completeMfa,
  discover,
  identify,
  requestPasswordReset,
  signInWithPassword,
  signInWithSso,
  type DiscoverResult,
  type LoginOutcome,
  type Workspace,
} from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, spacing } from '../../theme/tokens';

type Step = 'identify' | 'password' | 'mfa' | 'forgot' | 'forgot-sent';

export function SignInScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('identify');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [sso, setSso] = useState<DiscoverResult | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const finish = (outcome: LoginOutcome) => {
    if (outcome.kind === 'mfa') {
      setMfaToken(outcome.mfaToken);
      setCode('');
      setStep('mfa');
      return;
    }
    onSignedIn();
  };

  const submitIdentify = () =>
    run(async () => {
      const value = login.trim();
      if (!value) throw new Error(t('Enter your work email or mobile number.'));
      const found = await identify(value);
      setWorkspace(found);
      setSso(value.includes('@') ? await discover(value) : null);
      setStep('password');
      setTimeout(() => passwordRef.current?.focus(), 250);
    });

  const submitPassword = () =>
    run(async () => {
      if (!password) throw new Error(t('Enter your password.'));
      finish(await signInWithPassword(login, password, workspace?.workspace));
    });

  const submitMfa = () =>
    run(async () => {
      if (!/^\d{6}$/.test(code.replace(/\s/g, '')) && code.trim().length < 6) {
        throw new Error(t('Enter the 6-digit code from your authenticator app.'));
      }
      finish(await completeMfa(mfaToken, code));
    });

  const submitSso = () =>
    run(async () => {
      if (!sso?.providerId) return;
      finish(await signInWithSso(sso.providerId));
    });

  const submitForgot = () =>
    run(async () => {
      if (!login.includes('@')) throw new Error(t('Enter the email address you sign in with.'));
      await requestPasswordReset(login);
      setStep('forgot-sent');
    });

  const ssoOnly = Boolean(sso?.ssoRequired && sso.providerId);

  return (
    <TierContext.Provider value="tier2">
      <KeyboardAware style={{ backgroundColor: colors.brandSurface }}>
        <BrandBackdrop />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.section * 2, paddingBottom: insets.bottom + layout.gutter }]}
        >
          <View style={styles.brand}>
            <BrandLogo height={layout.avatarLg} />
            <Txt variant="callout" style={{ color: colors.onBrandSurfaceMuted }} align="center">
              {t('HR, payroll and culture for Indian companies')}
            </Txt>
          </View>

          <Card style={styles.card}>
            {step === 'identify' ? (
              <View style={styles.form}>
                <Txt variant="displaySmall">{t('Sign in')}</Txt>
                <TextField
                  label={t('Work email or mobile number')}
                  value={login}
                  onChangeText={(value) => {
                    setLogin(value);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => void submitIdentify()}
                  maxLength={320}
                  countFrom={0}
                />
                {error ? <Notice tone="danger" message={error} /> : null}
                <Button label={t('Continue')} variant="primary" onPress={() => void submitIdentify()} loading={busy} fullWidth />
              </View>
            ) : null}

            {step === 'password' ? (
              <View style={styles.form}>
                <View style={styles.who}>
                  <Txt variant="displaySmall">{workspace?.name ?? t('Sign in')}</Txt>
                  <View style={styles.whoRow}>
                    <Txt variant="callout" tone="muted" style={styles.flex} numberOfLines={1}>
                      {login.trim()}
                    </Txt>
                    <LinkButton
                      label={t('Change')}
                      onPress={() => {
                        setStep('identify');
                        setPassword('');
                        setError(null);
                      }}
                    />
                  </View>
                </View>
                {sso?.providerId ? (
                  <Button
                    label={t('Continue with {name}', { name: sso.providerName ?? t('single sign-on') })}
                    icon={ShieldCheck}
                    variant={ssoOnly ? 'accent' : 'secondary'}
                    onPress={() => void submitSso()}
                    loading={busy && ssoOnly}
                    fullWidth
                  />
                ) : null}
                {ssoOnly ? (
                  <Txt variant="caption" tone="muted">
                    {t('Your company signs you in through its own login page. It opens in your browser.')}
                  </Txt>
                ) : (
                  <>
                    <TextField
                      ref={passwordRef}
                      label={t('Password')}
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        setError(null);
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={() => void submitPassword()}
                      right={
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? t('Hide password') : t('Show password')}
                          onPress={() => setShowPassword((s) => !s)}
                          hitSlop={spacing.md}
                        >
                          {showPassword ? <EyeOff size={layout.icon} color={colors.textMuted} /> : <Eye size={layout.icon} color={colors.textMuted} />}
                        </Pressable>
                      }
                    />
                    {error ? <Notice tone="danger" message={error} /> : null}
                    <Button label={t('Sign in')} variant="primary" onPress={() => void submitPassword()} loading={busy} fullWidth />
                    <View style={styles.center}>
                      <LinkButton label={t('Forgot password?')} onPress={() => setStep('forgot')} />
                    </View>
                  </>
                )}
                {ssoOnly && error ? <Notice tone="danger" message={error} /> : null}
              </View>
            ) : null}

            {step === 'mfa' ? (
              <View style={styles.form}>
                <KeyRound size={layout.iconXl} color={colors.primaryText} />
                <Txt variant="displaySmall">{t('2-step sign-in')}</Txt>
                <Txt variant="callout" tone="muted">
                  {t('Enter the 6-digit code from your authenticator app, or a recovery code.')}
                </Txt>
                <TextField
                  label={t('Code')}
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 20));
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  autoFocus
                  onSubmitEditing={() => void submitMfa()}
                />
                {error ? <Notice tone="danger" message={error} /> : null}
                <Button label={t('Verify')} variant="primary" onPress={() => void submitMfa()} loading={busy} fullWidth />
                <View style={styles.center}>
                  <LinkButton label={t('Start again')} onPress={() => setStep('identify')} />
                </View>
              </View>
            ) : null}

            {step === 'forgot' ? (
              <View style={styles.form}>
                <Txt variant="displaySmall">{t('Reset your password')}</Txt>
                <Txt variant="callout" tone="muted">
                  {t('We will email a link to reset it. The link works once.')}
                </Txt>
                <TextField
                  label={t('Work email')}
                  value={login}
                  onChangeText={(value) => {
                    setLogin(value);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
                {error ? <Notice tone="danger" message={error} /> : null}
                <Button label={t('Send reset link')} variant="primary" onPress={() => void submitForgot()} loading={busy} fullWidth />
                <View style={styles.center}>
                  <LinkButton label={t('Back to sign in')} onPress={() => setStep(workspace ? 'password' : 'identify')} />
                </View>
              </View>
            ) : null}

            {step === 'forgot-sent' ? (
              <View style={styles.form}>
                <Txt variant="displaySmall">{t('Check your email')}</Txt>
                <Txt variant="callout" tone="muted">
                  {t('If {email} has an AskMiraa login, a reset link is on its way.', { email: login.trim() })}
                </Txt>
                <Button label={t('Back to sign in')} variant="secondary" onPress={() => setStep(workspace ? 'password' : 'identify')} fullWidth />
              </View>
            ) : null}
          </Card>
          <View style={styles.spacer} />
          <Txt variant="caption" align="center" style={{ color: colors.onBrandSurfaceMuted }}>
            {t('Version {version}', { version: APP_VERSION })}
          </Txt>
        </ScrollView>
      </KeyboardAware>
    </TierContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, gap: layout.section, flexGrow: 1 },
  brand: { alignItems: 'center', gap: spacing.sm },
  card: { maxWidth: layout.readingWidth, width: '100%', alignSelf: 'center' },
  form: { gap: layout.row },
  who: { gap: spacing.xxs },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  spacer: { flex: 1 },
});
