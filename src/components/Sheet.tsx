/**
 * Bottom sheets: pickers, confirmations, quick asks.
 *
 * A sheet has a grab handle and closes by swipe or by tapping outside — not a
 * centred web-style dialog. `ConfirmSheet` is the confirmation step every
 * approval and destructive action goes through: it can require a note, and it
 * ignores a second tap while the first is in flight.
 */

import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Platform, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../lib/i18n';
import { useKeyboardHeight } from '../lib/keyboard';
import { useRootHeight } from '../lib/rootHeight';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing, typography } from '../theme/tokens';
import { Button } from './Button';
import { InSheetContext } from './sheetContext';
import { Txt } from './Text';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /**
   * Kept for callers; every sheet now scrolls. A fixed body did not grow
   * when a validation message appeared, and its button slid under the
   * navigation bar.
   */
  scrollable?: boolean;
  /** Pinned under the content (actions). */
  footer?: ReactNode;
  /**
   * Something typed here would be lost by closing. A tap outside or a swipe
   * down then does nothing by accident, and Back asks first.
   */
  dirty?: boolean;
}

function confirmDiscard(discard: () => void) {
  Alert.alert(t('Discard changes?'), t('What you entered here will be lost.'), [
    { text: t('Keep editing'), style: 'cancel' },
    { text: t('Discard'), style: 'destructive', onPress: discard },
  ]);
}

/**
 * How much of the keyboard still covers the bottom of the screen. Android
 * shrinks the window for the keyboard on some runs and not on others, so this
 * measures: keyboard height minus how much the app's root actually shrank.
 */
function useKeyboardLift(active: boolean): number {
  const height = useKeyboardHeight();
  const keyboard = active ? height : 0;
  const root = useRootHeight();
  const baseline = useRef(0);
  if (keyboard === 0 && root > baseline.current) baseline.current = root;
  if (keyboard === 0) return 0;
  const shrunk = baseline.current > 0 ? Math.max(0, baseline.current - root) : 0;
  return Math.max(0, keyboard - shrunk);
}

export function Sheet({ open, onClose, title, description, children, footer, dirty = false }: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const keyboardLift = useKeyboardLift(open);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // When the app is laid out below an opaque status bar (insets.top is 0 on
  // Android), the window is taller than the app's own root by the status bar,
  // and a sheet measured against the window would lose its bottom edge.
  const shortBy = Platform.OS === 'android' && insets.top === 0 ? (StatusBar.currentHeight ?? 0) : 0;

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  // Android's back button closes the sheet, not the screen under it.
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dirtyRef.current) confirmDiscard(() => ref.current?.dismiss());
      else ref.current?.dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [open]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={dirty ? 'none' : 'close'}
        onPress={dirty ? () => confirmDiscard(() => ref.current?.dismiss()) : undefined}
        opacity={0.45}
      />
    ),
    [dirty],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enablePanDownToClose={!dirty}
      enableDynamicSizing
      maxDynamicContentSize={(height - shortBy) * 0.88}
      bottomInset={shortBy}
      // Never slide up under the status bar when the keyboard pushes it.
      topInset={insets.top}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.tier2 }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // The sheet never moves itself for the keyboard; `useKeyboardLift` pads
      // it by whatever part of the keyboard the window did not shrink away.
      android_keyboardInputMode="adjustResize"
      accessibilityLabel={title}
    >
      <BottomSheetScrollView
        style={styles.body}
        // A tap on a button while typing presses it, rather than only closing the keyboard.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: (keyboardLift || insets.bottom) + layout.gutter }]}
      >
        <View style={styles.stack}>
          {title ? (
            <View style={styles.header}>
              <Txt variant="title" accessibilityRole="header">
                {title}
              </Txt>
              {description ? (
                <Txt variant="callout" tone="muted">
                  {description}
                </Txt>
              ) : null}
            </View>
          ) : null}
          <InSheetContext.Provider value>{children}</InSheetContext.Provider>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

/** A text input that moves with the keyboard inside a sheet. */
export function SheetInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  error?: string | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Txt variant="label" tone="muted">
        {label}
      </Txt>
      <BottomSheetTextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        maxLength={maxLength}
        maxFontSizeMultiplier={1.6}
        style={[
          typography.body,
          styles.input,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: error ? colors.danger : colors.border },
        ]}
      />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

export interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel: string;
  /** The label of the button that backs out; "Cancel" by default. */
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'accent';
  /** Show a note box. `required` blocks confirm until it has text. */
  note?: { label: string; required?: boolean; placeholder?: string };
  /** Why confirming is blocked right now (offline…), shown above the buttons. */
  blocked?: string | null;
  onConfirm: (note: string) => Promise<unknown> | void;
}

export function ConfirmSheet({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  note,
  blocked,
  onConfirm,
}: ConfirmSheetProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (open) {
      setText('');
      setTouched(false);
    }
  }, [open]);

  const missingNote = Boolean(note?.required && !text.trim());

  const confirm = async () => {
    setTouched(true);
    if (inFlight.current || missingNote || blocked) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onConfirm(text);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={message}
      dirty={Boolean(text.trim())}
      footer={
        <View style={styles.actions}>
          {blocked ? (
            <Txt variant="callout" tone="warning">
              {blocked}
            </Txt>
          ) : null}
          <Button
            label={confirmLabel}
            onPress={() => void confirm()}
            variant={tone === 'danger' ? 'danger' : tone === 'accent' ? 'accent' : 'primary'}
            loading={busy}
            disabled={Boolean(blocked)}
            fullWidth
          />
          <Button label={cancelLabel ?? t('Cancel')} onPress={onClose} variant="ghost" disabled={busy} fullWidth />
        </View>
      }
    >
      {note ? (
        <SheetInput
          label={note.required ? `${note.label} (${t('required')})` : note.label}
          value={text}
          onChangeText={setText}
          placeholder={note.placeholder}
          multiline
          maxLength={1000}
          error={touched && missingNote ? t('Add a note so the person knows why.') : null}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { flexShrink: 1 },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.xs, gap: layout.row },
  /** Inside a scrolling sheet the padding is on the scroll content; the fields still need their gap. */
  stack: { gap: layout.row },
  header: { gap: spacing.xs },
  footer: { paddingTop: spacing.xs },
  actions: { gap: spacing.sm },
  field: { gap: layout.tight },
  input: {
    borderWidth: layout.hairline,
    borderRadius: radius.tier1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: layout.touch,
  },
  multiline: { minHeight: layout.rowHeight * 2, textAlignVertical: 'top' },
});
