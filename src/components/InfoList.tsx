/**
 * A record read as a list of facts: an icon, a small grey label and the value
 * under it — the older HRMS's profile, kept because people found it easy to
 * scan — grouped in cards with an optional Edit and a note on who changes it.
 */

import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, spacing } from '../theme/tokens';
import { Badge } from './Badge';
import { LinkButton } from './Button';
import { Card } from './Card';
import { Txt } from './Text';

export function InfoGroup({
  title,
  action,
  note,
  children,
}: {
  title: string;
  /** "Edit", "Request a change". */
  action?: { label: string; onPress: () => void };
  /** A badge beside the title, e.g. "HR checks". */
  note?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      <View style={styles.head}>
        <Txt variant="headline" accessibilityRole="header" style={styles.flex}>
          {title}
        </Txt>
        {note ? <Badge label={note} tone="neutral" /> : null}
        {action ? <LinkButton label={action.label} onPress={action.onPress} /> : null}
      </View>
      <Card padded="none">
        {rows.map((row, index) => (
          <Fragment key={(row.key as string) ?? index}>
            {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.divider }]} /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

export function InfoRow({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  /** Empty shows "Not added", as the older HRMS showed "Not Set". */
  value: string | null | undefined;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const shown = value && value.trim() ? value : null;
  const body = (
    <>
      <Icon size={layout.iconLg - 2} color={colors.primaryText} strokeWidth={1.75} />
      <View style={styles.flex}>
        <Txt variant="caption" tone="muted">
          {label}
        </Txt>
        <Txt variant="body" tone={shown ? 'default' : 'subtle'} selectable={Boolean(shown)}>
          {shown ?? t('Not added')}
        </Txt>
      </View>
      {onPress ? <ChevronRight size={layout.icon} color={colors.textSubtle} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${label}: ${shown ?? t('Not added')}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shown ?? t('Not added')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: layout.row },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.row + spacing.xs, paddingHorizontal: layout.card, paddingVertical: spacing.md, minHeight: layout.rowHeight + spacing.sm },
  rule: { height: layout.hairline, marginLeft: layout.card + layout.iconLg + spacing.md },
});
