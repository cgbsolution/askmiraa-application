/**
 * The states every screen has besides "here is your data": loading, empty,
 * error, offline, module switched off, and no employee record.
 *
 * `QueryView` picks the right one from a TanStack query, so a screen writes
 * only its happy path and still never shows a blank page, a raw error or an
 * invented number.
 */

import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, CloudOff, Lock, PackageOpen, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { isModuleOffError } from '../core/access';
import { ApiError, OfflineError } from '../lib/api';
import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';
import { Button } from './Button';
import { Card } from './Card';
import { SpotTile, type SpotName } from './Spot';
import { SkeletonList } from './Skeleton';
import { Txt } from './Text';
import { useTier } from './Tier';

export function EmptyState({
  icon: Icon = PackageOpen,
  spot,
  title,
  message,
  action,
  inline,
}: {
  icon?: LucideIcon;
  /** The website-style picture for what is empty (wins over `icon`). */
  spot?: SpotName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  /** Inside a section rather than filling a screen. */
  inline?: boolean;
}) {
  const { colors } = useTheme();
  const tier = useTier();
  return (
    <Card variant={tier === 'tier2' ? 'soft' : 'surface'}>
      <View style={[styles.empty, inline && styles.emptyInline]} accessible accessibilityLabel={[title, message].filter(Boolean).join('. ')}>
        {spot ? (
          <SpotTile name={spot} size="lg" tone={tier === 'tier2' ? 'white' : 'blush'} />
        ) : (
          <View style={[styles.emptyIcon, { backgroundColor: tier === 'tier2' ? colors.surface : colors.primarySoft }]}>
            <Icon size={layout.iconLg} color={colors.primaryText} strokeWidth={1.75} />
          </View>
        )}
        <Txt variant={tier === 'tier2' ? 'displaySmall' : 'headline'} align="center">
          {title}
        </Txt>
        {message ? (
          <Txt variant="callout" tone="muted" align="center">
            {message}
          </Txt>
        ) : null}
        {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" /> : null}
      </View>
    </Card>
  );
}

/** What an error means to the person reading it. */
export function describeError(error: unknown): { kind: 'offline' | 'module' | 'denied' | 'missing' | 'failed'; message: string } {
  if (error instanceof OfflineError) {
    return { kind: 'offline', message: t('You are offline. This needs a connection — pull down to try again when you have signal.') };
  }
  if (error instanceof ApiError) {
    if (isModuleOffError(error.status, error.message)) {
      return { kind: 'module', message: t('Your company has not switched this on. Ask HR if you need it.') };
    }
    if (error.status === 403) return { kind: 'denied', message: error.message };
    if (error.status === 404) return { kind: 'missing', message: error.message };
    return { kind: 'failed', message: error.message };
  }
  return { kind: 'failed', message: t('Something went wrong. Please try again.') };
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { colors } = useTheme();
  const { kind, message } = describeError(error);
  const Icon = kind === 'offline' ? CloudOff : kind === 'module' || kind === 'denied' ? Lock : AlertTriangle;
  const title =
    kind === 'offline'
      ? t("You're offline")
      : kind === 'module'
        ? t('Not switched on')
        : kind === 'denied'
          ? t('No access')
          : kind === 'missing'
            ? t('Not found')
            : t('Could not load this');
  const tone = kind === 'failed' ? colors.danger : colors.textMuted;
  return (
    <Card>
      <View style={styles.empty} accessible accessibilityRole="alert" accessibilityLabel={`${title}. ${message}`}>
        <Icon size={layout.iconXl} color={tone} strokeWidth={1.75} />
        <Txt variant="headline" align="center">
          {title}
        </Txt>
        <Txt variant="callout" tone="muted" align="center">
          {message}
        </Txt>
        {onRetry && kind !== 'module' && kind !== 'denied' ? (
          <Button label={t('Try again')} onPress={onRetry} variant="secondary" size="sm" />
        ) : null}
      </View>
    </Card>
  );
}

const MODULE_NAMES: Record<string, string> = {
  leave: 'Leave and attendance',
  payroll: 'Payroll',
  core_hr: 'Documents',
  culture: 'Culture',
  rewards: 'Rewards',
  hiring: 'Hiring and referrals',
  benefits: 'Benefits',
  analytics: 'Analytics',
};

/** A whole screen whose module this workspace has switched off: the message and nothing to press. */
export function ModuleOffState({ module }: { module: string }) {
  const { colors } = useTheme();
  const name = t(MODULE_NAMES[module] ?? module);
  const message = t('{module} is not switched on for your company. Ask HR if you need it.', { module: name });
  return (
    <Card>
      <View style={styles.empty} accessible accessibilityRole="alert" accessibilityLabel={`${t('Not switched on')}. ${message}`}>
        <Lock size={layout.iconXl} color={colors.textMuted} strokeWidth={1.75} />
        <Txt variant="headline" align="center">
          {t('Not switched on')}
        </Txt>
        <Txt variant="callout" tone="muted" align="center">
          {message}
        </Txt>
      </View>
    </Card>
  );
}

/** A thin banner at the top of a screen while the device is offline. */
export function OfflineBanner({ message }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
      accessibilityRole="alert"
    >
      <CloudOff size={layout.iconSm} color={colors.warning} />
      <Txt variant="callout" style={styles.bannerText}>
        {message ?? t("You're offline. Showing what was last loaded.")}
      </Txt>
    </View>
  );
}

/** An inline note: info, warning or danger, with an optional action. */
export function Notice({
  tone = 'info',
  title,
  message,
  icon: Icon,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  message: string;
  icon?: LucideIcon;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  const palette = {
    info: { bg: colors.infoSoft, fg: colors.info },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      {Icon ? <Icon size={layout.icon} color={palette.fg} /> : null}
      <View style={styles.noticeText}>
        {title ? <Txt variant="calloutStrong">{title}</Txt> : null}
        <Txt variant="callout">{message}</Txt>
        {action ? (
          <Txt variant="calloutStrong" tone="primary" onPress={action.onPress} accessibilityRole="button" suppressHighlighting>
            {action.label}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function NoEmployeeRecord({ what }: { what: string }) {
  return (
    <EmptyState
      spot="person"
      title={t('Your login is not linked to an employee record')}
      message={t('{what} belong to an employee record, so there is nothing to show here. If you work at this company, ask HR to link your login.', { what })}
    />
  );
}

/**
 * Render a query: skeleton while the first load runs, the error state on
 * failure (offline, module off, denied, missing, failed), the empty state when
 * `isEmpty` says so, else `children(data)`.
 *
 * Once data has loaded, a failed background refresh keeps showing it under an
 * offline banner rather than replacing it with an error.
 */
export function QueryView<T>({
  query,
  children,
  skeleton,
  isEmpty,
  empty,
}: {
  query: Pick<UseQueryResult<T>, 'data' | 'error' | 'isPending' | 'isError' | 'refetch'>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <SkeletonList />}</>;
  if (query.data === undefined) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  const stale = query.isError && query.error instanceof OfflineError;
  if (isEmpty?.(data) && empty) {
    return (
      <>
        {stale ? <OfflineBanner /> : null}
        {empty}
      </>
    );
  }
  return (
    <>
      {stale ? <OfflineBanner /> : null}
      {children(data)}
    </>
  );
}

/** A horizontal bar showing progress, e.g. onboarding tasks done. */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: colors.chartTrack }]}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: layout.inline, paddingVertical: layout.section },
  emptyInline: { paddingVertical: spacing.sm },
  emptyIcon: {
    width: layout.avatarLg - spacing.lg,
    height: layout.avatarLg - spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
    paddingHorizontal: layout.card,
    paddingVertical: spacing.sm,
    borderRadius: radius.tier1,
    borderWidth: layout.hairline,
  },
  bannerText: { flex: 1 },
  notice: { flexDirection: 'row', gap: layout.inline, padding: layout.card, borderRadius: radius.tier1 },
  noticeText: { flex: 1, gap: spacing.xs },
  track: { height: spacing.sm, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
