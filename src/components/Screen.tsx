/**
 * The page.
 *
 * Every screen is a `Screen`: same background, same gutter on both sides, the
 * same gap between sections, pull to refresh, and room at the bottom for the
 * tab bar and the Miraa button. Screens do not set their own padding — that is
 * where uneven gaps come from — and a test fails any literal spacing number in
 * a screen file.
 *
 * A tab's root screen passes its top bar as `header` (TabHeader): it stays put
 * under the status bar while the content scrolls beneath it.
 */

import { useFocusEffect } from '@react-navigation/native';
import type { LucideIcon } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setToastLift } from '../lib/toastLift';
import { useTheme } from '../theme/ThemeProvider';
import { layout, spacing, type Tier } from '../theme/tokens';
import { LinkButton } from './Button';
import { Txt } from './Text';
import { TierContext } from './Tier';

export interface ScreenProps {
  children: ReactNode;
  tier?: Tier;
  /** Pull to refresh. The spinner shows until the promise settles. */
  onRefresh?: () => Promise<unknown> | void;
  /** The screen sits above the tab bar (a tab's stack); leave room for it. */
  inTabs?: boolean;
  /** Draw under the status bar (a tab root with its own header block). */
  edgeToEdgeTop?: boolean;
  /** A fixed top bar (a tab root's TabHeader), drawn under the status bar. */
  header?: ReactNode;
  /** Something pinned under the scroll area, e.g. a sticky submit bar. */
  footer?: ReactNode;
  /** Something floating over the content, e.g. a floating action button. */
  overlay?: ReactNode;
  scrollEnabled?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
  testID?: string;
}

export function Screen({
  children,
  tier = 'tier1',
  onRefresh,
  inTabs = true,
  edgeToEdgeTop = false,
  header,
  footer,
  overlay,
  scrollEnabled = true,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const [footerHeight, setFooterHeight] = useState(0);
  useFooterLift(footer ? footerHeight : 0);
  const bottom = footer ? layout.section : inTabs ? bottomClearance(insets.bottom) : insets.bottom + layout.section;
  // A footer sits above the floating tab bar and the Miraa button, not behind them.
  const footerBottom = inTabs ? layout.tabBar + layout.miraLift + insets.bottom + layout.row : insets.bottom + layout.row;
  const top = header ? layout.row : edgeToEdgeTop ? insets.top + layout.gutter : layout.gutter;

  return (
    <TierContext.Provider value={tier}>
      <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
        {header ? <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background }]}>{header}</View> : null}
        <ScrollView
          scrollEnabled={scrollEnabled}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom }, contentStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {edgeToEdgeTop && !header ? (
          // Content scrolls under the see-through status bar; this keeps the
          // clock and icons on a plain background instead of over text.
          <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top, backgroundColor: colors.background }]} />
        ) : null}
        {footer ? (
          <View
            style={[styles.footer, { paddingBottom: footerBottom, backgroundColor: colors.surface, borderColor: colors.border }]}
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          >
            {footer}
          </View>
        ) : null}
        {overlay ? (
          <View
            pointerEvents="box-none"
            style={[styles.overlay, { bottom: (inTabs ? layout.tabBar + layout.miraLift + insets.bottom : insets.bottom) + layout.gutter }]}
          >
            {overlay}
          </View>
        ) : null}
      </View>
    </TierContext.Provider>
  );
}

/** While this screen is focused, messages sit above its bottom bar. */
export function useFooterLift(height: number): void {
  useFocusEffect(
    useCallback(() => {
      setToastLift(height);
      return () => setToastLift(0);
    }, [height]),
  );
}

/** Space to leave under scrolled content so the tab bar and Miraa button never cover it. */
export function bottomClearance(safeBottom: number): number {
  return layout.tabBar + layout.miraLift + safeBottom + layout.section;
}

/**
 * A section of a screen: an optional heading row (with a small icon, as the
 * portal's card titles have) and one action, then its content with an even
 * gap between items.
 */
export function Section({
  title,
  description,
  icon: Icon,
  action,
  children,
  gap = 'row',
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  gap?: 'row' | 'inline' | 'none';
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitles}>
            <View style={styles.sectionTitleRow}>
              {Icon ? <Icon size={layout.iconSm + 2} color={colors.primaryText} strokeWidth={2} /> : null}
              <Txt variant="headline" accessibilityRole="header" style={styles.flex}>
                {title}
              </Txt>
            </View>
            {description ? (
              <Txt variant="caption" tone="muted">
                {description}
              </Txt>
            ) : null}
          </View>
          {action ? <LinkButton label={action.label} onPress={action.onPress} arrow /> : null}
        </View>
      ) : null}
      <View style={gap === 'row' ? styles.gapRow : gap === 'inline' ? styles.gapInline : null}>{children}</View>
    </View>
  );
}

/**
 * The title block at the top of a screen that has no TabHeader: a large
 * title, an optional line under it, and up to two icon actions.
 */
export function ScreenTitle({
  title,
  subtitle,
  right,
  serif,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  serif?: boolean;
}) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleText}>
        <Txt variant={serif ? 'display' : 'title'} accessibilityRole="header">
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="callout" tone="muted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ? <View style={styles.titleActions}>{right}</View> : null}
    </View>
  );
}

/** Two or more items side by side with the standard gap (e.g. stat tiles). */
export function Row({ children, gap = 'row', wrap }: { children: ReactNode; gap?: 'row' | 'inline'; wrap?: boolean }) {
  return (
    <View style={[styles.row, gap === 'row' ? styles.gapRowH : styles.gapInlineH, wrap && styles.wrap]}>{children}</View>
  );
}

/** A vertical stack with the standard gap. */
export function Stack({ children, gap = 'row' }: { children: ReactNode; gap?: 'row' | 'inline' | 'tight' | 'section' }) {
  const value =
    gap === 'section' ? layout.section : gap === 'inline' ? layout.inline : gap === 'tight' ? layout.tight : layout.row;
  return <View style={{ gap: value }}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { zIndex: 1 },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: layout.row, borderTopWidth: StyleSheet.hairlineWidth },
  overlay: { position: 'absolute', right: layout.gutter, alignItems: 'flex-end' },
  content: { paddingHorizontal: layout.gutter, gap: layout.section },
  section: { gap: layout.row },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: layout.inline },
  sectionTitles: { flex: 1, gap: spacing.xxs },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gapRow: { gap: layout.row },
  gapInline: { gap: layout.inline },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: layout.inline },
  titleText: { flex: 1, gap: spacing.xxs },
  titleActions: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  gapRowH: { gap: layout.row },
  gapInlineH: { gap: layout.inline },
  wrap: { flexWrap: 'wrap' },
});
