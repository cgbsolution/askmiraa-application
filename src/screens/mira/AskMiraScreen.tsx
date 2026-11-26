/**
 * Ask Miraa — the workspace's AI companion, full screen.
 *
 * The same backend as the portal's /ask-mira. It answers as the person signed
 * in: every lookup runs with their own access, and what it finds is shown here
 * as cards, never sent to the model.
 *
 * Honest at every step:
 *   - the header says whether a model is planning ("AI") or the words are
 *     matched to a lookup on AskMiraa ("On-device lookup"), and why;
 *   - a message is shown as *sending* until the server returns it;
 *   - offline, nothing is queued — an answer to a stale question is worse
 *     than none;
 *   - at the daily limit the composer says when it resets.
 */

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Camera, FileText, History, Image as ImageIcon, MessageSquarePlus, Paperclip, SendHorizontal, ShieldCheck, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATTACHMENT_TYPES, MAX_ATTACHMENTS, companionApi } from '../../api/companion';
import { Badge } from '../../components/Badge';
import { KeyboardAware } from '../../components/KeyboardAware';
import { IconButton, LinkButton } from '../../components/Button';
import { ListGroup, ListRow } from '../../components/List';
import { CardView } from '../../components/mira/Cards';
import { MiraBubble, MiraMark, TypingDots, UserBubble } from '../../components/mira/MiraParts';
import { ActionChips } from '../../components/mira/ActionChips';
import { Sheet } from '../../components/Sheet';
import { SkeletonCard } from '../../components/Skeleton';
import { ErrorState, Notice, describeError } from '../../components/States';
import { Txt } from '../../components/Text';
import { TierContext } from '../../components/Tier';
import { composerState, modeLabel, reasonCopy } from '../../core/companion';
import type { CompanionCard, CompanionMessage, CompanionStatus } from '../../core/types';
import { MESSAGE_MAX_LENGTH } from '../../core/types';
import type { UploadFile } from '../../lib/api';
import { chooseDocument, choosePhoto, takePhoto } from '../../lib/files';
import { t } from '../../lib/i18n';
import { miraSignal } from '../../lib/miraSignal';
import { useOnline } from '../../lib/network';
import { useGo, useParams } from '../../navigation/navigate';

/** One message's own id (the server's client_ref: 8–64 letters, digits, _ or -). */
function newClientRef(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, layout, radius, spacing, typography } from '../../theme/tokens';

type Row =
  | { kind: 'message'; message: CompanionMessage }
  | { kind: 'pending'; text: string }
  | { kind: 'typing' };

export function AskMiraScreen() {
  const navigation = useNavigation();
  const params = useParams<{ conversationId: string; prefill: string; fresh: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const online = useOnline();
  const go = useGo();

  const status = useQuery({ queryKey: ['companion', 'status'], queryFn: companionApi.status, staleTime: 30_000 });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<unknown>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  // The id of a send that got no answer: the same words sent again reuse it, so the
  // server returns the first answer instead of running the turn (and its offers) twice.
  const unanswered = useRef<{ text: string; files: string; ref: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [modeSheet, setModeSheet] = useState(false);
  // Pictures and PDFs for the next message (a receipt, a visiting card): read, never kept.
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [attachSheet, setAttachSheet] = useState(false);
  const [inputHeight, setInputHeight] = useState<number>(layout.touch);
  const inFlight = useRef(false);
  const listRef = useRef<FlatList<Row>>(null);
  const name = status.data?.name || 'Miraa';

  // Mark the chat as on screen (clears the button's glow), and off when it closes.
  useFocusEffect(
    useCallback(() => {
      miraSignal.chatOpened();
      return () => miraSignal.chatClosed();
    }, []),
  );

  const open = useCallback(async (id: string | null) => {
    setOpenError(null);
    setSendError(null);
    setConversationId(id);
    setMessages([]);
    if (!id) return;
    setOpening(true);
    try {
      const detail = await companionApi.conversation(id);
      setMessages(detail.messages);
    } catch (error) {
      setOpenError(error);
      setConversationId(null);
    } finally {
      setOpening(false);
    }
  }, []);

  // What to show on arrival: a conversation picked from history, a reply that
  // landed after the chat was closed, or a fresh chat (optionally pre-filled).
  const unseenAtStart = useRef(miraSignal.unseenConversation());
  useEffect(() => {
    if (params.conversationId) void open(params.conversationId);
    else if (params.fresh) void open(null);
    else if (unseenAtStart.current) void open(unseenAtStart.current);
    if (params.prefill) setDraft(params.prefill);
  }, [params.conversationId, params.fresh, params.prefill, open]);

  const newChat = useCallback(() => {
    void open(null);
    setDraft('');
  }, [open]);


  const composer = composerState(status.data ?? null, draft, online, pending !== null, files.length);

  const attach = useCallback(
    async (how: 'camera' | 'photo' | 'pdf') => {
      setAttachSheet(false);
      const rules = { types: how === 'pdf' ? ['application/pdf'] : ATTACHMENT_TYPES };
      const picked =
        how === 'camera' ? await takePhoto(rules) : how === 'photo' ? await choosePhoto(rules) : await chooseDocument(rules);
      if (picked) setFiles((current) => [...current, picked].slice(0, MAX_ATTACHMENTS));
    },
    [],
  );

  const send = useCallback(
    async (text: string, withFiles = false) => {
      const body = text.trim();
      const sending = withFiles ? files : [];
      if ((!body && sending.length === 0) || inFlight.current || !status.data) return;
      const state = composerState(status.data, body, online, false, sending.length);
      if (!state.canSend) {
        setSendError(state.blocked);
        return;
      }
      inFlight.current = true;
      setSendError(null);
      setPending(body || sending.map((file) => file.name).join(', '));
      setDraft('');
      if (sending.length) setFiles([]);
      setInputHeight(layout.touch);
      const files_ = sending.map((file) => `${file.name}:${file.uri}`).join('|');
      const same = unanswered.current;
      const ref = same && same.text === body && same.files === files_ ? same.ref : newClientRef();
      unanswered.current = { text: body, files: files_, ref };
      try {
        const turn = sending.length
          ? await companionApi.sendFiles({ text: body, conversation_id: conversationId, client_ref: ref }, sending)
          : await companionApi.send({ text: body, conversation_id: conversationId, client_ref: ref });
        unanswered.current = null;
        setMessages((current) => [...current, ...turn.messages]);
        setConversationId(turn.conversation.id);
        miraSignal.replyArrived(turn.conversation.id);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void queryClient.invalidateQueries({ queryKey: ['companion'] });
      } catch (error) {
        setDraft(body);
        // The files come back too, so nothing the person picked is lost.
        if (sending.length) setFiles(sending);
        setSendError(describeError(error).message);
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [conversationId, files, online, queryClient, status.data],
  );

  // Confirm or Cancel on one offer: its own state replaces the card, and Miraa's line follows.
  const decide = useCallback(
    async (card: Extract<CompanionCard, { type: 'proposal' }>, confirm: boolean) => {
      if (deciding || inFlight.current) return;
      setDeciding(card.action_id);
      setSendError(null);
      try {
        const decision = await companionApi.decide(card.action_id, confirm);
        setMessages((current) => [
          ...current.map((message) => ({
            ...message,
            cards: message.cards.map((c) =>
              c.type === 'proposal' && c.action_id === card.action_id ? { ...c, ...decision.action } : c,
            ),
          })),
          decision.message,
        ]);
        void Haptics.notificationAsync(
          decision.action.status === 'done' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
        );
        void queryClient.invalidateQueries({ queryKey: ['companion'] });
      } catch (error) {
        setSendError(describeError(error).message);
      } finally {
        setDeciding(null);
      }
    },
    [deciding, queryClient],
  );

  const rows: Row[] = [
    ...messages.map((message) => ({ kind: 'message' as const, message })),
    ...(pending ? [{ kind: 'pending' as const, text: pending }, { kind: 'typing' as const }] : []),
  ];

  useEffect(() => {
    if (rows.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [rows.length]);

  if (!status.data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <MiraHeader name={name} status={null} onClose={() => navigation.goBack()} onHistory={() => go('MiraHistory')} onNew={newChat} onMode={() => {}} />
        <View style={styles.padded}>
          {status.isPending ? <SkeletonCard lines={4} /> : <ErrorState error={status.error} onRetry={() => void status.refetch()} />}
        </View>
      </View>
    );
  }
  const data = status.data;
  const why = reasonCopy(data.reason, name);

  return (
    <TierContext.Provider value="tier2">
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <MiraHeader
          name={name}
          status={status.data ?? null}
          onClose={() => navigation.goBack()}
          onHistory={() => go('MiraHistory')}
          onNew={newChat}
          onMode={() => setModeSheet(true)}
        />
        <KeyboardAware bottomOffset={insets.bottom}>
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(row, index) => (row.kind === 'message' ? row.message.id : `${row.kind}-${index}`)}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {!online ? (
                <Notice tone="warning" message={t('You are offline. Miraa needs a connection, and messages are not saved to send later.')} />
              ) : null}
              {why && rows.length === 0 ? (
                <Notice
                  tone="info"
                  icon={ShieldCheck}
                  title={t(why.title)}
                  message={t(why.message)}
                  action={data.reason === 'no_consent' ? { label: t('Agree in Privacy'), onPress: () => go('Consent') } : undefined}
                />
              ) : null}
              {openError ? <ErrorState error={openError} onRetry={() => void open(params.conversationId ?? null)} /> : null}
              {opening ? <SkeletonCard lines={3} /> : null}
              {!opening && rows.length === 0 && !openError ? (
                <Welcome status={data} name={name} />
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === 'pending') return <UserBubble text={item.text} pending />;
            if (item.kind === 'typing') return <TypingDots name={name} />;
            const message = item.message;
            if (message.role === 'user') {
              // What the person attached: its name, and whether it could be read.
              const attached = message.cards.filter((card) => card.type === 'attachment');
              return (
                <View style={styles.userTurn}>
                  {message.text ? (
                    <UserBubble text={message.text} />
                  ) : (
                    <UserBubble text={attached.map((card) => (card.type === 'attachment' ? card.name : '')).join(', ')} />
                  )}
                  {attached.map((card, index) => (
                    <CardView key={index} card={card} mode={data.mode} onAsk={(text) => void send(text)} />
                  ))}
                </View>
              );
            }
            return (
              <MiraBubble name={name} text={message.text} toolTitle={message.tool_title}>
                {message.cards.map((card, index) => (
                  <CardView
                    key={index}
                    card={card}
                    mode={data.mode}
                    onAsk={(text) => void send(text)}
                    onDecide={(offer, confirm) => void decide(offer, confirm)}
                    deciding={deciding}
                  />
                ))}
                <ActionChips message={message} previous={previousUserText(messages, message)} />
              </MiraBubble>
            );
          }}
          ItemSeparatorComponent={Gap}
        />

        <View
          style={[
            styles.composerBar,
            { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {sendError || (composer.blocked && online) ? (
            <Txt variant="caption" tone={sendError ? 'danger' : 'warning'} accessibilityLiveRegion="polite">
              {sendError ?? composer.blocked}
            </Txt>
          ) : null}
          {files.length ? (
            <View style={styles.attachments}>
              {files.map((file, index) => (
                <Pressable
                  key={`${file.uri}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('Remove {name}', { name: file.name })}
                  onPress={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  style={[styles.attachment, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                >
                  {file.type === 'application/pdf' ? (
                    <FileText size={14} color={colors.textMuted} />
                  ) : (
                    <ImageIcon size={14} color={colors.textMuted} />
                  )}
                  <Txt variant="caption" numberOfLines={1} style={styles.attachmentName}>
                    {file.name}
                  </Txt>
                  <X size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Attach a photo or PDF')}
              accessibilityState={{ disabled: files.length >= MAX_ATTACHMENTS || pending !== null }}
              disabled={files.length >= MAX_ATTACHMENTS || pending !== null}
              onPress={() => setAttachSheet(true)}
              style={({ pressed }) => [styles.attach, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Paperclip size={layout.icon} color={files.length >= MAX_ATTACHMENTS ? colors.textSubtle : colors.textMuted} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (sendError) setSendError(null);
              }}
              placeholder={t('Message {name}…', { name })}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={t('Message {name}…', { name })}
              multiline
              maxLength={MESSAGE_MAX_LENGTH + 1}
              editable={composer.remainingToday > 0}
              maxFontSizeMultiplier={1.5}
              onContentSizeChange={(event) =>
                setInputHeight(Math.min(Math.max(layout.touch, event.nativeEvent.contentSize.height + spacing.md), layout.rowHeight * 3))
              }
              style={[
                styles.input,
                { height: inputHeight },
                { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Send')}
              accessibilityState={{ disabled: !composer.canSend }}
              disabled={!composer.canSend}
              onPress={() => void send(draft, true)}
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: composer.canSend ? colors.accent : colors.neutralSoft },
                pressed && styles.pressed,
              ]}
            >
              <SendHorizontal size={layout.icon} color={composer.canSend ? colors.onAccent : colors.textSubtle} />
            </Pressable>
          </View>
          <View style={styles.composerMeta}>
            <Txt variant="caption" tone="subtle">
              {t('{left} of {limit} messages left today', { left: composer.remainingToday, limit: data.daily_limit })}
            </Txt>
            {composer.counter ? (
              <Txt variant="caption" tone={draft.length > MESSAGE_MAX_LENGTH ? 'danger' : 'subtle'} numeric>
                {composer.counter}
              </Txt>
            ) : null}
          </View>
        </View>
        </KeyboardAware>
      </View>

      <Sheet open={modeSheet} onClose={() => setModeSheet(false)} title={t(modeLabel(data))}>
        <Txt variant="callout">
          {data.mode === 'ai'
            ? t('A model reads your question and picks a lookup. The lookup runs as you, with your own access. The model reads a trimmed view of what it finds, only as far as your company’s privacy register allows, and the text read from files you attach; the rest is shown only to you here.')
            : why
              ? t(why.message)
              : ''}
        </Txt>
        {data.reason === 'no_consent' ? (
          <LinkButton
            label={t('Agree in Privacy')}
            onPress={() => {
              setModeSheet(false);
              go('Consent');
            }}
          />
        ) : null}
      </Sheet>

      <Sheet open={attachSheet} onClose={() => setAttachSheet(false)} title={t('Attach for {name} to read', { name })}>
        <Txt variant="caption" tone="muted">
          {t('A receipt, a bill, a visiting card or a profile. {name} reads it once; the file itself is not kept.', { name })}
        </Txt>
        <ListGroup>
          <ListRow title={t('Take a photo')} icon={Camera} onPress={() => void attach('camera')} />
          <ListRow title={t('Choose a photo')} icon={ImageIcon} onPress={() => void attach('photo')} />
          <ListRow title={t('Choose a PDF')} icon={FileText} onPress={() => void attach('pdf')} />
        </ListGroup>
      </Sheet>

    </TierContext.Provider>
  );
}

/**
 * The chat's own header: close, Miraa's name and mode, history, new chat.
 * Drawn here rather than by the navigator: re-setting a native header's
 * options inside an Android full-screen modal made the screen's height flip
 * and pushed the composer under the bottom edge.
 */
function MiraHeader({
  name,
  status,
  onClose,
  onHistory,
  onNew,
  onMode,
}: {
  name: string;
  status: CompanionStatus | null;
  onClose: () => void;
  onHistory: () => void;
  onNew: () => void;
  onMode: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.header }]}>
      <IconButton icon={X} label={t('Close')} onPress={onClose} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status ? `${name}, ${t(modeLabel(status))}. ${t('What does this mean?')}` : name}
        onPress={onMode}
        style={styles.headerTitle}
      >
        <MiraMark size={layout.avatarSm} />
        <View style={styles.flex}>
          <Txt variant="headline" numberOfLines={1}>
            {name}
          </Txt>
          {status ? (
            <Txt variant="caption" tone={status.mode === 'ai' ? 'primary' : 'muted'}>
              {t(modeLabel(status))}
            </Txt>
          ) : null}
        </View>
      </Pressable>
      <IconButton icon={History} label={t('History')} onPress={onHistory} />
      <IconButton icon={MessageSquarePlus} label={t('New chat')} onPress={onNew} />
    </View>
  );
}

function previousUserText(messages: CompanionMessage[], reply: CompanionMessage): string {
  const index = messages.indexOf(reply);
  for (let i = index - 1; i >= 0; i -= 1) if (messages[i]!.role === 'user') return messages[i]!.text;
  return '';
}

function Gap() {
  return <View style={styles.gap} />;
}

function Welcome({ status, name }: { status: CompanionStatus; name: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.welcome, { backgroundColor: colors.soft, borderColor: colors.softBorder }]}>
      <MiraMark size={layout.avatarLg - spacing.lg} />
      <Txt variant="displayMedium" align="center">
        {t('Hi, I’m {name}', { name })}
      </Txt>
      <Txt variant="callout" tone="muted" align="center">
        {status.greeting ||
          (status.mode === 'ai'
            ? t("Your company's AI companion. Ask me anything about work.")
            : t('Ask me short questions about your leave, your team and your company.'))}
      </Txt>
      {status.tools.length === 0 ? (
        <Txt variant="caption" tone="muted" align="center">
          {t('No lookups are switched on for you yet, so {name} can only chat.', { name })}
        </Txt>
      ) : null}
      <View style={styles.center}>
        <Badge label={t('Only you can see your conversations')} tone="neutral" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { padding: layout.gutter },
  thread: { padding: layout.gutter, paddingBottom: layout.section },
  headerBlock: { gap: layout.row, marginBottom: layout.row },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, minHeight: layout.rowHeight },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  gap: { height: layout.row + spacing.xs },
  welcome: {
    alignItems: 'center',
    gap: layout.row,
    padding: layout.card,
    paddingVertical: layout.section,
    borderRadius: radius.tier2,
    borderWidth: layout.hairline,
  },
  center: { alignItems: 'center' },
  composerBar: { paddingHorizontal: layout.gutter, paddingTop: spacing.sm, gap: spacing.xs, borderTopWidth: layout.hairline },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  attach: {
    width: layout.touch,
    height: layout.touch,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  userTurn: { gap: spacing.xs, alignItems: 'flex-end' },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  attachmentName: { flexShrink: 1, maxWidth: 180 },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: typography.callout.fontSize + 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + spacing.xxs,
    paddingBottom: spacing.sm + spacing.xxs,
    textAlignVertical: 'center',
    borderRadius: radius.tier2,
    borderWidth: layout.hairline,
  },
  send: { width: layout.touch, height: layout.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  composerMeta: { flexDirection: 'row', justifyContent: 'space-between' },
});
