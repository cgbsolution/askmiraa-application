/**
 * The top bar of a tab's root screen.
 *
 * Left: the screen's title. Right: the bell —
 * the way into the Inbox (notifications, approvals, tasks) from every tab,
 * with one number for everything waiting — and the person's avatar, which
 * opens Me. The portal's header has the same round bordered buttons.
 */

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { peopleApi } from '../api/people';
import { personName } from '../core/status';
import { t, tn } from '../lib/i18n';
import { inboxTarget, useInboxCount } from '../lib/inbox';
import { useSession } from '../lib/session';
import { useGo } from '../navigation/navigate';
import { layout, spacing } from '../theme/tokens';
import { Avatar } from './Avatar';
import { IconButton } from './Button';
import { Txt } from './Text';

export function TabHeader({
  title,
  subtitle,
  avatar = true,
  right,
}: {
  title: string;
  subtitle?: string;
  /** Show the person's avatar (it opens Me). Off on Me itself. */
  avatar?: boolean;
  /** An extra action before the bell. */
  right?: ReactNode;
}) {
  const go = useGo();
  const { session } = useSession();
  const inbox = useInboxCount();
  const me = useQuery({ queryKey: ['profile-basics'], queryFn: peopleApi.me, enabled: avatar && Boolean(session?.user.employee_id) });
  const name = personName(me.data) || session?.user.full_name || '';

  const bellLabel = inbox.total
    ? tn(inbox.total, '{count} item in your inbox', '{count} items in your inbox')
    : t('Inbox');

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <View style={styles.titles}>
          <Txt variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        {right}
        <IconButton
          icon={Bell}
          variant="outlined"
          label={bellLabel}
          count={inbox.total}
          // Straight to what is waiting: approvals, else updates, else things to do.
          onPress={() => go(inboxTarget(inbox).route)}
        />
        {avatar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('My profile and settings')}
            onPress={() => go('MeHub')}
            hitSlop={spacing.xs}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Avatar name={name} url={me.data?.photo_url} size={layout.controlSmall + spacing.xs} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: layout.appBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
    paddingHorizontal: layout.gutter,
  },
  left: { flex: 1, justifyContent: 'center' },
  titles: { gap: spacing.xxs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.7 },
});
