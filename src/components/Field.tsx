/**
 * Form fields.
 *
 * Every field has a visible label (not a placeholder pretending to be one), a
 * helper line, an error line that appears as soon as the value is wrong, and
 * the same height and padding. Amount fields filter input as it is typed;
 * date and time fields open the platform's own picker.
 */

import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar, ChevronDown, Clock, Search, X } from 'lucide-react-native';
import { forwardRef, useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { acceptAmountInput, type AmountRules } from '../core/amount';
import { matchWords } from '../core/predictive';
import { dateFromISO, formatDate, isoFromDate } from '../core/dates';
import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing, typography } from '../theme/tokens';
import { Chip } from './Badge';
import { Button, IconButton } from './Button';
import { Sheet } from './Sheet';
import { useInSheet } from './sheetContext';
import { Txt } from './Text';

function FieldFrame({
  label,
  required,
  helper,
  error,
  counter,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string | null;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Txt variant="label" tone="muted">
        {label}
        {required ? ' *' : ''}
      </Txt>
      {children}
      {error || helper || counter ? (
        <View style={styles.below}>
          <Txt variant="caption" tone={error ? 'danger' : 'subtle'} style={styles.belowText} accessibilityLiveRegion="polite">
            {error ?? helper ?? ''}
          </Txt>
          {counter ? (
            <Txt variant="caption" tone="subtle" numeric>
              {counter}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'onChange'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  required?: boolean;
  helper?: string;
  error?: string | null;
  /** Show the character count once within this many of maxLength (and never before 80% of it). */
  countFrom?: number;
  prefix?: string;
  right?: ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
  label,
  value,
  onChangeText,
  required,
  helper,
  error,
  maxLength,
  countFrom = 100,
  prefix,
  right,
  multiline,
  ...input
  }: TextFieldProps,
  ref,
) {
  const { colors } = useTheme();
  // Inside a sheet, the sheet's own input, so the sheet rises with the keyboard.
  const Input = (useInSheet() ? BottomSheetTextInput : TextInput) as typeof TextInput;
  const [focused, setFocused] = useState(false);
  const counter =
    maxLength && value.length >= Math.max(maxLength - countFrom, Math.floor(maxLength * 0.8)) ? `${value.length}/${maxLength}` : undefined;
  return (
    <FieldFrame label={label} required={required} helper={helper} error={error} counter={counter}>
      <View
        style={[
          styles.box,
          multiline && styles.boxMultiline,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.borderStrong,
          },
        ]}
      >
        {prefix ? (
          <Txt variant="body" tone="muted">
            {prefix}
          </Txt>
        ) : null}
        <Input
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={helper}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          multiline={multiline}
          placeholderTextColor={colors.textSubtle}
          maxFontSizeMultiplier={1.6}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={[typography.body, styles.input, multiline && styles.inputMultiline, { color: colors.text }]}
          {...input}
        />
        {right}
      </View>
    </FieldFrame>
  );
});

/**
 * A search box with no label above it (Home, All services): the magnifier
 * says what it is, as on the old HRMS's home. A clear button replaces the
 * magnifier once something is typed.
 */
/** One line offered under a search box as the words are typed. */
export interface SearchSuggestion {
  key: string;
  label: string;
  /** Quieter text at the right: which kind of thing it is. */
  hint?: string;
  /** Tapping opens something (a service) instead of filling the box. */
  onPress?: () => void;
  /** What tapping puts in the box. Defaults to `label`. */
  value?: string;
}

/**
 * A search box. With `suggestions` it predicts: as words are typed, the
 * closest matches drop down under it with the typed letters in bold; tapping
 * one opens it, or puts it in the box. Ranking is the caller's (see
 * lib/predictive), so the list is shown as given, up to `maxSuggestions`.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  label,
  suggestions,
  maxSuggestions = 6,
  onPick,
  showLabel = false,
  ...input
}: Omit<TextInputProps, 'style' | 'onChange' | 'value' | 'onChangeText' | 'placeholder'> & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** What a screen reader says for the box. */
  label: string;
  suggestions?: SearchSuggestion[];
  maxSuggestions?: number;
  /** After a line is tapped and the box holds its value (to choose a colleague, say). */
  onPick?: (line: SearchSuggestion) => void;
  /** In a form: the label shown above the box, as every other field has. */
  showLabel?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  // The value a tap put in the box: the list stays shut until it is changed.
  const [picked, setPicked] = useState<string | null>(null);
  const lines = (suggestions ?? []).slice(0, maxSuggestions);
  const showLines = Boolean(value.trim()) && value !== picked && lines.length > 0;
  const box = (
    <View style={styles.searchWrap}>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: focused ? colors.primary : colors.border }]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityRole="search"
          value={value}
          onChangeText={(text) => {
            setPicked(null);
            onChangeText(text);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          maxFontSizeMultiplier={1.6}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={[typography.body, styles.input, { color: colors.text }]}
          {...input}
        />
        {value ? (
          <IconButton icon={X} label={t('Clear search')} onPress={() => onChangeText('')} />
        ) : (
          <Search size={layout.iconLg} color={colors.textMuted} />
        )}
      </View>
      {showLines ? (
        <View
          accessibilityRole="list"
          accessibilityLabel={t('Suggestions')}
          style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {lines.map((line, index) => (
            <Pressable
              key={line.key}
              accessibilityRole="button"
              accessibilityLabel={line.hint ? `${line.label}, ${line.hint}` : line.label}
              onPress={() => {
                if (line.onPress) {
                  line.onPress();
                  return;
                }
                const next = line.value ?? line.label;
                setPicked(next);
                onChangeText(next);
                onPick?.(line);
              }}
              style={({ pressed }) => [
                styles.suggestion,
                index > 0 && { borderTopWidth: layout.hairline, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <Search size={layout.iconSm} color={colors.textMuted} />
              <Txt numberOfLines={1} style={styles.suggestionLabel}>
                <HighlightedText text={line.label} term={value} />
              </Txt>
              {line.hint ? (
                <Txt variant="caption" tone="muted" numberOfLines={1}>
                  {line.hint}
                </Txt>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
  return showLabel ? <FieldFrame label={label}>{box}</FieldFrame> : box;
}

/** The text with the typed words in bold. */
function HighlightedText({ text, term }: { text: string; term: string }) {
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const word of matchWords(term)) {
    const at = lower.indexOf(word);
    if (at >= 0) ranges.push([at, at + word.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let from = 0;
  ranges.forEach(([start, end], index) => {
    if (start < from) return;
    if (start > from) parts.push(text.slice(from, start));
    parts.push(
      <Txt key={index} variant="bodyStrong">
        {text.slice(start, end)}
      </Txt>,
    );
    from = end;
  });
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

/** An amount in rupees, filtered as it is typed: no letters, no minus, no third decimal. */
export function AmountField({
  value,
  onChangeText,
  rules,
  ...props
}: Omit<TextFieldProps, 'keyboardType'> & { rules?: AmountRules }) {
  return (
    <TextField
      {...props}
      value={value}
      onChangeText={(next) => onChangeText(acceptAmountInput(value, next, rules))}
      keyboardType={(rules?.decimals === 0 ? 'number-pad' : 'decimal-pad') as KeyboardTypeOptions}
      prefix={props.prefix ?? '₹'}
      inputMode={rules?.decimals === 0 ? 'numeric' : 'decimal'}
      autoCorrect={false}
      contextMenuHidden={false}
    />
  );
}

function PickerButton({
  label,
  text,
  placeholder,
  icon,
  onPress,
  error,
  required,
  helper,
  disabled,
}: {
  label: string;
  text: string | null;
  placeholder: string;
  icon: ReactNode;
  onPress: () => void;
  error?: string | null;
  required?: boolean;
  helper?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <FieldFrame label={label} required={required} helper={helper} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text ?? placeholder}`}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.box,
          {
            backgroundColor: disabled ? colors.surfaceSunken : pressed ? colors.surfaceSunken : colors.surface,
            borderColor: error ? colors.danger : colors.borderStrong,
          },
        ]}
      >
        <Txt variant="body" tone={text ? 'default' : 'subtle'} style={styles.input} numberOfLines={1}>
          {text ?? placeholder}
        </Txt>
        {icon}
      </Pressable>
    </FieldFrame>
  );
}

/** A calendar date ("YYYY-MM-DD") from the platform picker. */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
  ...frame
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  minimumDate?: string;
  maximumDate?: string;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  helper?: string;
  disabled?: boolean;
}) {
  const { colors, dark } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? dateFromISO(value) : new Date());

  const show = () => {
    const initial = value ? dateFromISO(value) : clampDate(new Date(), minimumDate, maximumDate);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: minimumDate ? dateFromISO(minimumDate) : undefined,
        maximumDate: maximumDate ? dateFromISO(maximumDate) : undefined,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(isoFromDate(date));
        },
      });
    } else {
      setDraft(initial);
      setOpen(true);
    }
  };

  return (
    <>
      <PickerButton
        label={label}
        text={value ? formatDate(value) : null}
        placeholder={placeholder ?? t('Choose a date')}
        icon={<Calendar size={layout.icon} color={colors.textMuted} />}
        onPress={show}
        {...frame}
      />
      {Platform.OS === 'ios' ? (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={label}
          footer={
            <Button
              label={t('Done')}
              onPress={() => {
                onChange(isoFromDate(draft));
                setOpen(false);
              }}
              variant="primary"
              fullWidth
            />
          }
        >
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            themeVariant={dark ? 'dark' : 'light'}
            accentColor={colors.primary}
            minimumDate={minimumDate ? dateFromISO(minimumDate) : undefined}
            maximumDate={maximumDate ? dateFromISO(maximumDate) : undefined}
            onChange={(_event, date) => date && setDraft(date)}
          />
        </Sheet>
      ) : null}
    </>
  );
}

function clampDate(date: Date, min?: string, max?: string): Date {
  if (min && date < dateFromISO(min)) return dateFromISO(min);
  if (max && date > dateFromISO(max)) return dateFromISO(max);
  return date;
}

/** A time of day, "HH:MM", from the platform picker. */
export function TimeField({
  label,
  value,
  onChange,
  ...frame
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
  helper?: string;
}) {
  const { colors, dark } = useTheme();
  const [open, setOpen] = useState(false);
  const toDate = (hhmm: string | null) => {
    const date = new Date();
    const [h, m] = (hhmm ?? '09:00').split(':').map(Number);
    date.setHours(h ?? 9, m ?? 0, 0, 0);
    return date;
  };
  const [draft, setDraft] = useState<Date>(toDate(value));
  const format = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'time',
        is24Hour: true,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(format(date));
        },
      });
    } else {
      setDraft(toDate(value));
      setOpen(true);
    }
  };

  return (
    <>
      <PickerButton
        label={label}
        text={value}
        placeholder={t('Choose a time')}
        icon={<Clock size={layout.icon} color={colors.textMuted} />}
        onPress={show}
        {...frame}
      />
      {Platform.OS === 'ios' ? (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={label}
          footer={
            <Button
              label={t('Done')}
              onPress={() => {
                onChange(format(draft));
                setOpen(false);
              }}
              fullWidth
            />
          }
        >
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            themeVariant={dark ? 'dark' : 'light'}
            onChange={(_event, date) => date && setDraft(date)}
          />
        </Sheet>
      ) : null}
    </>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Pick one from a list, in a sheet. Lists longer than eight get a search box. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  ...frame
}: {
  label: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  helper?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <>
      <PickerButton
        label={label}
        text={selected?.label ?? null}
        placeholder={placeholder ?? t('Choose…')}
        icon={<ChevronDown size={layout.icon} color={colors.textMuted} />}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        {...frame}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={label} scrollable>
        {options.length > 8 ? (
          <View style={[styles.box, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised }]}>
            <Search size={layout.iconSm} color={colors.textMuted} />
            <BottomSheetTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('Search')}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={t('Search')}
              style={[typography.body, styles.input, { color: colors.text }]}
            />
          </View>
        ) : null}
        <View>
          {filtered.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor: colors.divider },
                  (pressed || active) && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Txt variant={active ? 'bodyStrong' : 'body'}>{option.label}</Txt>
                {option.description ? (
                  <Txt variant="caption" tone="muted">
                    {option.description}
                  </Txt>
                ) : null}
              </Pressable>
            );
          })}
          {filtered.length === 0 ? (
            <Txt variant="callout" tone="muted" style={styles.none}>
              {t('Nothing matches.')}
            </Txt>
          ) : null}
        </View>
      </Sheet>
    </>
  );
}

/** One of a few options as chips (half day: first / second half). */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  helper,
  error,
  required,
}: {
  label: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
  helper?: string;
  error?: string | null;
  required?: boolean;
}) {
  return (
    <FieldFrame label={label} required={required} helper={helper} error={error}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((option) => (
          <Chip key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
        ))}
      </View>
    </FieldFrame>
  );
}

/** A labelled switch. */
export function SwitchRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Txt variant="bodyStrong">{label}</Txt>
        {description ? (
          <Txt variant="callout" tone="muted">
            {description}
          </Txt>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
        thumbColor={value ? colors.switchThumbOn : colors.switchThumbOff}
        ios_backgroundColor={colors.switchTrackOff}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: layout.tight },
  below: { flexDirection: 'row', gap: layout.inline },
  belowText: { flex: 1 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.field,
    borderWidth: layout.hairline,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md + spacing.xxs,
  },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: { flex: 1, paddingVertical: spacing.sm },
  searchWrap: { gap: spacing.xs },
  suggestions: { borderWidth: layout.hairline, borderRadius: radius.control, overflow: 'hidden' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionLabel: { flex: 1 },
  inputMultiline: { minHeight: layout.rowHeight * 2, textAlignVertical: 'top', paddingVertical: 0 },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: layout.touch,
    justifyContent: 'center',
    borderBottomWidth: layout.hairline,
    borderRadius: radius.sm,
    gap: spacing.xxs,
  },
  none: { paddingVertical: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: layout.row, minHeight: layout.touch, paddingVertical: spacing.xs },
  switchText: { flex: 1, gap: spacing.xxs },
});
