/**
 * Past conversations: Today, Yesterday, Earlier. Search runs over titles on
 * the phone. Swipe a conversation left to delete it (after a confirm).
 * Conversations are private to the person who had them.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { companionApi } from '../../api/companion';
import { SearchField, type SearchSuggestion } from '../../components/Field';
import { ConfirmSheet } from '../../components/Sheet';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { Txt } from '../../components/Text';
import { toast } from '../../components/Toast';
import { groupConversations, searchConversations } from '../../core/companion';
import { relativeDay, formatTime } from '../../core/dates';
import type { Conversation } from '../../core/types';
import { t } from '../../lib/i18n';
import { rankSuggestions } from '../../core/predictive';
import { useGo } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, spacing } from '../../theme/tokens';
import { describeError } from '../../components/States';

export function MiraHistoryScreen() {
  const go = useGo();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['companion', 'conversations'], queryFn: companionApi.conversations });
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<Conversation | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => companionApi.remove(id),
    onSuccess: () => {
      toast.success(t('Conversation deleted'));
      void queryClient.invalidateQueries({ queryKey: ['companion', 'conversations'] });
    },
    onError: (error) => toast.error(describeError(error).message),
  });

  const sections = useMemo(
    () =>
      groupConversations(searchConversations(list.data ?? [], query)).map((group) => ({
        title: t(group.title),
        data: group.items,
      })),
    [list.data, query],
  );

  // Conversations whose titles match, closest first: tapping one opens it.
  const suggestions = useMemo<SearchSuggestion[]>(
    () =>
      rankSuggestions(
        (list.data ?? []).map((conversation) => ({ conversation, label: conversation.title })),
        query,
        5,
      ).map(({ conversation }) => ({
        key: conversation.id,
        label: conversation.title,
        hint: relativeDay(conversation.last_message_at),
        onPress: () => go('AskMira', { conversationId: conversation.id }),
      })),
    [list.data, query, go],
  );

  const body = () => {
    if (list.isPending) return <SkeletonList rows={6} />;
    if (!list.data) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
    if (list.data.length === 0) {
      return (
        <EmptyState
          spot="mira"
          title={t('No conversations yet')}
          message={t('Your chats with Miraa stay here, and only you can see them.')}
        />
      );
    }
    if (sections.length === 0) return <EmptyState spot="search" title={t('Nothing matches “{q}”', { q: query.trim() })} />;
    return null;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.searchWrap}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('Search conversations')}
          label={t('Search conversations')}
          suggestions={suggestions}
        />
      </View>
      {body() ?? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Txt variant="label" tone="muted" style={styles.sectionHeader}>
              {section.title}
            </Txt>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={[
                styles.clip,
                index === 0 && styles.first,
                index === section.data.length - 1 && styles.last,
              ]}
            >
            <Swipeable
              friction={2}
              rightThreshold={layout.touch}
              renderRightActions={() => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Delete “{title}”', { title: item.title })}
                  onPress={() => setDeleting(item)}
                  style={[styles.delete, { backgroundColor: colors.danger }]}
                >
                  <Trash2 size={layout.icon} color={colors.onPrimary} />
                  <Txt variant="label" tone="onPrimary">
                    {t('Delete')}
                  </Txt>
                </Pressable>
              )}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${relativeDay(item.last_message_at)}`}
                accessibilityHint={t('Opens the conversation. Swipe left to delete.')}
                accessibilityActions={[{ name: 'delete', label: t('Delete') }]}
                onAccessibilityAction={() => setDeleting(item)}
                onLongPress={() => setDeleting(item)}
                onPress={() => go('AskMira', { conversationId: item.id })}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? colors.surfaceSunken : colors.surface, borderColor: colors.divider },
                  index === section.data.length - 1 && styles.lastRow,
                ]}
              >
                <MessageCircle size={layout.icon} color={colors.primaryText} />
                <View style={styles.texts}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {item.title}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {relativeDay(item.last_message_at)}, {formatTime(item.last_message_at)}
                  </Txt>
                </View>
              </Pressable>
            </Swipeable>
            </View>
          )}
        />
      )}

      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('Delete this conversation?')}
        message={t('“{title}” will be removed from your conversations. This cannot be undone.', { title: deleting?.title ?? '' })}
        confirmLabel={t('Delete')}
        tone="danger"
        onConfirm={async () => {
          const target = deleting;
          setDeleting(null);
          if (target) await remove.mutateAsync(target.id).catch(() => {});
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter },
  list: { padding: layout.gutter, paddingBottom: layout.section * 2 },
  sectionHeader: { marginTop: layout.row, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.row,
    minHeight: layout.rowHeight,
    paddingHorizontal: layout.card,
    paddingVertical: spacing.md,
    borderBottomWidth: layout.hairline,
  },
  clip: { overflow: 'hidden' },
  first: { borderTopLeftRadius: radius.tier1, borderTopRightRadius: radius.tier1 },
  last: { borderBottomLeftRadius: radius.tier1, borderBottomRightRadius: radius.tier1 },
  lastRow: { borderBottomWidth: 0 },
  texts: { flex: 1, gap: spacing.xxs },
  delete: { width: layout.rowHeight + spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
});
