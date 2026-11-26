/** Ask Miraa — the same backend the portal uses. No AI path of its own on the phone. */

import { api, upload, type UploadFile } from '../lib/api';
import type { CompanionStatus, Conversation, ConversationDetail, MessageIn, OfferDecision, Turn } from '../core/types';

/** The most files one message may carry (the server's own limit). */
export const MAX_ATTACHMENTS = 3;
/** What Miraa reads: pictures (receipts, cards, profiles) and PDFs. */
export const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];

export const companionApi = {
  status: () => api<CompanionStatus>('/companion/status'),
  conversations: () => api<Conversation[]>('/companion/conversations'),
  conversation: (id: string) => api<ConversationDetail>(`/companion/conversations/${id}`),
  remove: (id: string) => api<void>(`/companion/conversations/${id}`, { method: 'DELETE' }),
  /** One turn. A model may take a while; allow longer than a plain read. */
  send: (body: MessageIn) => api<Turn>('/companion/messages', { method: 'POST', body, timeoutMs: 60_000 }),
  /** One turn with files: each is read first (a picture by the workspace's AI), then the turn. */
  sendFiles: (body: MessageIn, files: UploadFile[]) =>
    upload<Turn>(
      '/companion/messages/files',
      { text: body.text, conversation_id: body.conversation_id ?? null, client_ref: body.client_ref ?? null, files },
      { timeoutMs: 150_000 },
    ),
  /** Confirm or Cancel on one offer, by its own id — never a "yes" the model must place. */
  decide: (actionId: string, confirm: boolean) =>
    api<OfferDecision>(`/companion/actions/${actionId}/${confirm ? 'confirm' : 'cancel'}`, {
      method: 'POST',
      // An order win opens positions and writes the P&L: allow it time.
      timeoutMs: 150_000,
    }),
};
