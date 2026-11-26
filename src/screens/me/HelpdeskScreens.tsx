/**
 * Helpdesk: my tickets, one ticket's conversation (reply, reopen, rate,
 * withdraw — each only when the server's `can_*` flag says so) and raising a
 * ticket with a photo or PDF.
 *
 * When CGB Helpdesk is linked, tickets live there and this opens it instead.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Lock, Paperclip, Plus, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { helpdeskApi } from '../../api/helpdesk';
import { AttachField } from '../../components/AttachField';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Fab } from '../../components/Fab';
import { ChoiceField, SelectField, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { ProductLauncher } from '../../components/ProductLauncher';
import { Screen, Section, Stack } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, Notice, QueryView } from '../../components/States';
import { useResetOnOpen } from '../../components/sheetContext';
import { Txt } from '../../components/Text';
import { formatDate, formatDateTime, timeAgo } from '../../core/dates';
import type { AttachmentRead, CommentRead, HelpdeskPriority, TicketDetail, TicketSummary } from '../../core/types';
import type { UploadFile } from '../../lib/api';
import { openDownloaded, type FileRules } from '../../lib/files';
import { t, tn } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { layout, radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

/** What the server accepts on a ticket: one PDF, PNG or JPEG, up to the workspace upload limit. */
const TICKET_FILES: FileRules = { types: ['image/jpeg', 'image/png', 'application/pdf'] };

const OPEN_STATUSES = new Set(['open', 'in_progress', 'waiting_on_employee']);

const PRIORITY_LABEL: Record<HelpdeskPriority, string> = { low: 'Low', medium: 'Normal', high: 'High', urgent: 'Urgent' };

const SLA: Record<TicketSummary['sla_state'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } | null> = {
  on_track: null,
  due_soon: { label: 'Due soon', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'danger' },
  met: null,
  breached: null,
  none: null,
};

export function HelpdeskScreen() {
  const go = useGo();
  const { linked } = useSession();
  const tickets = useQuery({ queryKey: ['helpdesk', 'mine'], queryFn: () => helpdeskApi.mine(), enabled: !linked('helpdesk') });
  const [segment, setSegment] = useState<'open' | 'done'>('open');

  if (linked('helpdesk')) {
    return (
      <Screen>
        <ProductLauncher product="helpdesk" what={t('Tickets')} />
      </Screen>
    );
  }

  const all = tickets.data ?? [];
  const open = all.filter((ticket) => OPEN_STATUSES.has(ticket.status));
  const done = all.filter((ticket) => !OPEN_STATUSES.has(ticket.status));
  const waiting = open.filter((ticket) => ticket.status === 'waiting_on_employee').length;
  const shown = segment === 'open' ? open : done;

  return (
    <Screen onRefresh={() => tickets.refetch()} overlay={<Fab icon={Plus} label={t('Raise a ticket')} onPress={() => go('NewTicket')} />}>
      {waiting ? <Notice tone="warning" message={t('{count} waiting on your reply.', { count: waiting })} /> : null}
      <Segmented
        segments={[
          { value: 'open', label: t('Open'), count: open.length, quiet: true },
          { value: 'done', label: t('Resolved'), count: done.length, quiet: true },
        ]}
        value={segment}
        onChange={setSegment}
      />
      <QueryView query={tickets} skeleton={<SkeletonList rows={5} />}>
        {() =>
          shown.length ? (
            <ListGroup>
              {shown.map((ticket) => (
                <ListRow
                  key={ticket.id}
                  title={ticket.subject}
                  subtitle={`#${ticket.ticket_number} · ${ticket.category_name}`}
                  meta={t('Updated {when}', { when: timeAgo(ticket.last_activity_at) })}
                  trailing={<StatusBadge status={ticket.status} />}
                  onPress={() => go('TicketDetail', { id: ticket.id })}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState
              spot="headset"
              title={segment === 'open' ? t('No open tickets') : t('Nothing resolved yet')}
              message={segment === 'open' ? t('Need a letter, an ID card, or help with IT or pay? Raise a ticket.') : undefined}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function Attachments({ items }: { items: AttachmentRead[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <View style={styles.attachments}>
      {items.map((file) => (
        <Button
          key={file.id}
          label={file.file_name}
          icon={Paperclip}
          size="sm"
          variant="secondary"
          loading={opening === file.id}
          onPress={async () => {
            setOpening(file.id);
            await openDownloaded(helpdeskApi.attachmentPath(file.id), file.file_name, file.content_type);
            setOpening(null);
          }}
        />
      ))}
    </View>
  );
}

function Message({ comment }: { comment: CommentRead }) {
  const { colors } = useTheme();
  if (comment.is_system) {
    return (
      <Txt variant="caption" tone="subtle" style={styles.system}>
        {comment.body} · {formatDateTime(comment.created_at)}
      </Txt>
    );
  }
  const mine = comment.is_from_requester;
  return (
    <View
      style={[
        styles.message,
        mine ? styles.mine : styles.theirs,
        { backgroundColor: mine ? colors.primarySoft : colors.surface, borderColor: mine ? colors.primarySoft : colors.border },
      ]}
    >
      <Txt variant="label" tone={mine ? 'primary' : 'muted'}>
        {mine ? t('You') : (comment.author_name ?? t('Helpdesk'))} · {formatDateTime(comment.created_at)}
      </Txt>
      <Txt variant="body" selectable>
        {comment.body}
      </Txt>
      <Attachments items={comment.attachments} />
    </View>
  );
}

export function TicketDetailScreen() {
  const { colors } = useTheme();
  const { id } = useParams<{ id: string }>();
  const ticket = useQuery({ queryKey: ['helpdesk', 'ticket', id], queryFn: () => helpdeskApi.ticket(id!), enabled: Boolean(id) });
  const [replying, setReplying] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [rating, setRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancel = useAction((reason: string) => helpdeskApi.cancel(id!, reason), { success: t('Ticket withdrawn'), invalidate: [['helpdesk']] });
  const reopen = useAction((reason: string) => helpdeskApi.reopen(id!, reason), { success: t('Ticket reopened'), invalidate: [['helpdesk']] });

  if (ticket.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={6} />
      </Screen>
    );
  }
  if (!ticket.data) {
    return (
      <Screen>
        <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
      </Screen>
    );
  }
  const d = ticket.data;
  const sla = OPEN_STATUSES.has(d.status) ? SLA[d.sla_state] : null;
  const thread = d.comments.filter((c) => !c.is_internal);

  return (
    <Screen
      onRefresh={() => ticket.refetch()}
      footer={d.can_reply ? <Button label={t('Reply')} variant="primary" onPress={() => setReplying(true)} fullWidth /> : undefined}
    >
      <Card>
        <Stack gap="row">
          <View style={styles.titleRow}>
            <Txt variant="caption" tone="muted" style={styles.flex}>
              #{d.ticket_number} · {d.category_name}
            </Txt>
            <StatusBadge status={d.status} />
          </View>
          <Txt variant="title">{d.subject}</Txt>
          {d.is_confidential ? (
            <View style={styles.inline}>
              <Lock size={layout.iconSm} color={colors.textMuted} />
              <Txt variant="caption" tone="muted">
                {t('Confidential: only the people handling it can see it.')}
              </Txt>
            </View>
          ) : null}
          <Txt variant="body" selectable>
            {d.description}
          </Txt>
          <Attachments items={d.attachments} />
          <KeyValue label={t('Priority')} value={t(PRIORITY_LABEL[d.priority])} />
          <KeyValue label={t('With')} value={d.assignee_name ?? t('Not picked up yet')} />
          {OPEN_STATUSES.has(d.status) ? <KeyValue label={t('Due')} value={formatDateTime(d.due_at)} /> : null}
          {sla ? <Badge label={t(sla.label)} tone={sla.tone} /> : null}
          {d.satisfaction_rating ? <KeyValue label={t('Your rating')} value={'★'.repeat(d.satisfaction_rating) + '☆'.repeat(Math.max(0, 5 - d.satisfaction_rating))} /> : null}
        </Stack>
      </Card>

      {d.status === 'waiting_on_employee' ? <Notice tone="warning" message={t('The helpdesk is waiting for your reply.')} /> : null}

      <Section title={t('Conversation')}>
        {thread.length ? (
          <Stack gap="inline">
            {thread.map((comment) => (
              <Message key={comment.id} comment={comment} />
            ))}
          </Stack>
        ) : (
          <Txt variant="callout" tone="muted">
            {t('No replies yet. You will be told when someone answers.')}
          </Txt>
        )}
      </Section>

      {d.can_rate || d.can_reopen || d.can_cancel ? (
        <Stack gap="inline">
          {d.can_rate ? <Button label={t('Rate the help you got')} icon={Star} variant="secondary" onPress={() => setRating(true)} fullWidth /> : null}
          {d.can_reopen ? (
            <Button
              label={d.reopen_until ? t('Reopen (until {date})', { date: formatDate(d.reopen_until) }) : t('Reopen')}
              variant="secondary"
              onPress={() => setReopening(true)}
              fullWidth
            />
          ) : null}
          {d.can_cancel ? <Button label={t('Withdraw ticket')} variant="ghost" onPress={() => setCancelling(true)} fullWidth /> : null}
        </Stack>
      ) : null}

      <ReplySheet open={replying} onClose={() => setReplying(false)} ticket={d} />
      <RateSheet open={rating} onClose={() => setRating(false)} ticketId={d.id} />
      <ConfirmSheet
        open={reopening}
        onClose={() => setReopening(false)}
        title={t('Reopen this ticket?')}
        message={t('Say what is still not right.')}
        confirmLabel={t('Reopen')}
        note={{ label: t('What is still wrong'), required: true }}
        onConfirm={async (note) => {
          const done = await reopen.run(note);
          if (done) setReopening(false);
        }}
      />
      <ConfirmSheet
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t('Withdraw this ticket?')}
        message={t('Do this if you no longer need help with it.')}
        confirmLabel={t('Withdraw')}
        cancelLabel={t('Keep it')}
        tone="danger"
        note={{ label: t('Reason'), placeholder: t('Optional') }}
        onConfirm={async (note) => {
          const done = await cancel.run(note);
          if (done) setCancelling(false);
        }}
      />
    </Screen>
  );
}

function ReplySheet({ open, onClose, ticket }: { open: boolean; onClose: () => void; ticket: TicketDetail }) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setBody('');
    setFile(null);
    setTouched(false);
  });
  const error = !body.trim() ? t('Write a reply.') : null;
  const send = useAction(() => helpdeskApi.comment(ticket.id, body.trim(), file), {
    success: t('Reply sent'),
    invalidate: [['helpdesk']],
    onSuccess: () => {
      setBody('');
      setFile(null);
      setTouched(false);
      onClose();
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Reply on #{number}', { number: ticket.ticket_number })}
      scrollable
      dirty={Boolean(body.trim() || file)}
      footer={
        <Button
          label={t('Send')}
          variant="accent"
          loading={send.pending}
          onPress={() => {
            setTouched(true);
            if (!error) void send.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <TextField label={t('Your reply')} required value={body} onChangeText={setBody} multiline maxLength={10000} error={touched ? error : null} />
      <AttachField label={t('Attach a file')} value={file} onChange={setFile} rules={TICKET_FILES} />
    </Sheet>
  );
}

function RateSheet({ open, onClose, ticketId }: { open: boolean; onClose: () => void; ticketId: string }) {
  const { colors } = useTheme();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setStars(0);
    setComment('');
    setTouched(false);
  });
  const rate = useAction(() => helpdeskApi.rate(ticketId, stars, comment.trim()), {
    success: t('Thanks for the rating'),
    invalidate: [['helpdesk']],
    onSuccess: onClose,
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('How was the help?')}
      dirty={Boolean(stars || comment)}
      footer={
        <Button
          label={t('Send rating')}
          variant="accent"
          loading={rate.pending}
          onPress={() => {
            setTouched(true);
            if (stars) void rate.run(undefined);
          }}
          fullWidth
        />
      }
    >
      <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={t('{count} of 5 stars', { count: stars })}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => setStars(value)}
            accessibilityRole="button"
            accessibilityLabel={tn(value, '{count} star', '{count} stars')}
            hitSlop={spacing.xs}
            style={styles.star}
          >
            <Star size={layout.iconLg + spacing.md} color={value <= stars ? colors.accent : colors.textSubtle} fill={value <= stars ? colors.accent : 'transparent'} />
          </Pressable>
        ))}
      </View>
      {touched && !stars ? (
        <Txt variant="caption" tone="danger">
          {t('Tap a star to rate.')}
        </Txt>
      ) : null}
      <TextField label={t('Anything to add?')} value={comment} onChangeText={setComment} multiline maxLength={2000} placeholder={t('Optional')} />
    </Sheet>
  );
}

export function NewTicketScreen() {
  const navigation = useNavigation();
  const go = useGo();
  const params = useParams<{ subject: string }>();
  const categories = useQuery({ queryKey: ['helpdesk', 'categories'], queryFn: helpdeskApi.categories, staleTime: 10 * 60_000 });
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subject, setSubject] = useState(params.subject ?? '');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<HelpdeskPriority>('medium');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [touched, setTouched] = useState(false);

  const active = (categories.data ?? []).filter((c) => c.active).sort((a, b) => a.sort_order - b.sort_order);
  const category = active.find((c) => c.id === categoryId) ?? null;
  const errors = {
    category: !categoryId ? t('Choose what it is about.') : null,
    subject: subject.trim().length < 3 ? t('Give it a short title (at least 3 letters).') : null,
    description: !description.trim() ? t('Describe what you need.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const raise = useAction(
    () => helpdeskApi.create({ category_id: categoryId!, subject: subject.trim(), description: description.trim(), priority }, file),
    { success: (ticket) => t('Ticket #{number} raised', { number: ticket.ticket_number }), invalidate: [['helpdesk']] },
  );

  if (categories.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={5} />
      </Screen>
    );
  }
  if (categories.error) {
    return (
      <Screen>
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      </Screen>
    );
  }
  if (!active.length) {
    return (
      <Screen>
        <EmptyState spot="headset" title={t('The helpdesk is not set up yet')} message={t('HR has not added any ticket categories. Ask them how to raise this.')} />
      </Screen>
    );
  }

  return (
    <FormScreen
      submitLabel={t('Raise ticket')}
      dirty={Boolean(categoryId || description || file || (subject && subject !== params.subject))}
      submitDisabled={touched && invalid}
      onSubmit={async () => {
        setTouched(true);
        if (invalid) return;
        const ticket = await raise.run(undefined);
        if (ticket) {
          navigation.goBack();
          go('TicketDetail', { id: ticket.id });
        }
      }}
    >
      <Stack gap="row">
        <SelectField
          label={t('What is it about?')}
          required
          value={categoryId}
          options={active.map((c) => ({ value: c.id, label: c.name, description: c.description ?? undefined }))}
          onChange={setCategoryId}
          error={touched ? errors.category : null}
        />
        {category ? (
          <Txt variant="caption" tone="muted">
            {category.is_confidential
              ? t('Confidential: only the people who handle {name} can see it. Usually answered within {hours} hours.', { name: category.name, hours: category.sla_hours })
              : t('Usually answered within {hours} hours.', { hours: category.sla_hours })}
          </Txt>
        ) : null}
        <TextField label={t('Title')} required value={subject} onChangeText={setSubject} maxLength={200} error={touched ? errors.subject : null} />
        <TextField label={t('Details')} required value={description} onChangeText={setDescription} multiline maxLength={10000} error={touched ? errors.description : null} />
        <ChoiceField
          label={t('How urgent?')}
          value={priority}
          options={(['low', 'medium', 'high', 'urgent'] as HelpdeskPriority[]).map((value) => ({ value, label: t(PRIORITY_LABEL[value]) }))}
          onChange={setPriority}
        />
        <AttachField label={t('Attach a file')} value={file} onChange={setFile} rules={TICKET_FILES} />
      </Stack>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  message: { padding: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xs, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  system: { textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  star: { padding: spacing.xs },
});
