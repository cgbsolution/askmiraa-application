/**
 * A form: fields that scroll above the keyboard, and a submit bar pinned to
 * the bottom.
 *
 * - The keyboard never covers the focused field or the submit button.
 * - Leaving with unsaved edits asks "Discard changes?" first.
 * - The submit button shows progress and ignores further taps while the
 *   request is in flight, so a double tap cannot create two records.
 */

import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, spacing, type Tier } from '../theme/tokens';
import { Button, type ButtonVariant } from './Button';
import { KeyboardAware } from './KeyboardAware';
import { useFooterLift } from './Screen';
import { TierContext } from './Tier';

export interface FormScreenProps {
  children: ReactNode;
  tier?: Tier;
  submitLabel: string;
  onSubmit: () => Promise<unknown> | void;
  /** Edits not yet saved: guards leaving the screen. */
  dirty?: boolean;
  submitDisabled?: boolean;
  submitVariant?: ButtonVariant;
  /** A second action beside submit (e.g. "Preview"). */
  secondary?: { label: string; onPress: () => void; loading?: boolean };
  /** Shown above the buttons (a summary like "2 days will be deducted"). */
  footerNote?: ReactNode;
  /**
   * Set true once the form is saved from outside `onSubmit` (a confirm sheet).
   * The form then closes itself; the discard guard does not stop it.
   */
  closing?: boolean;
}

export function FormScreen({
  children,
  tier = 'tier1',
  submitLabel,
  onSubmit,
  dirty = false,
  submitDisabled,
  submitVariant = 'primary',
  secondary,
  footerNote,
  closing = false,
}: FormScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  useFooterLift(footerHeight);
  const inFlight = useRef(false);
  const leaving = useRef(false);

  // Close after the guard has been lifted in a render, not in the same tick:
  // the guard reads its flag from the last render.
  useEffect(() => {
    if (closing && navigation.canGoBack()) navigation.goBack();
  }, [closing, navigation]);

  usePreventRemove(dirty && !busy && !closing && !leaving.current, ({ data }) => {
    Alert.alert(t('Discard changes?'), t('What you entered here will be lost.'), [
      { text: t('Keep editing'), style: 'cancel' },
      {
        text: t('Discard'),
        style: 'destructive',
        onPress: () => {
          leaving.current = true;
          navigation.dispatch(data.action);
        },
      },
    ]);
  });

  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onSubmit();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <TierContext.Provider value={tier}>
      <KeyboardAware style={{ backgroundColor: colors.background }} bottomOffset={insets.bottom}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
        >
          {children}
        </ScrollView>
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          {footerNote}
          <View style={styles.buttons}>
            {secondary ? (
              <View style={styles.button}>
                <Button
                  label={secondary.label}
                  onPress={secondary.onPress}
                  variant="secondary"
                  loading={secondary.loading}
                  disabled={busy}
                  fullWidth
                />
              </View>
            ) : null}
            <View style={styles.button}>
              <Button
                label={submitLabel}
                onPress={() => void submit()}
                variant={submitVariant}
                loading={busy}
                disabled={submitDisabled}
                fullWidth
              />
            </View>
          </View>
        </View>
      </KeyboardAware>
    </TierContext.Provider>
  );
}

/** Mark the form as saved so the discard guard lets the screen close. */
export function useCloseAfterSave() {
  const navigation = useNavigation();
  return () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: layout.gutter, gap: layout.section, paddingBottom: layout.section },
  footer: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: layout.hairline,
  },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
});
