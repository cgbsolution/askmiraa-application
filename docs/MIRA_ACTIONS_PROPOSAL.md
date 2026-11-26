# Ask Mira actions: "suggest, then confirm"

**Status: proposal. Nothing in `backend/` has been changed for this. It needs your approval first.**

## What exists today

- Ask Mira's tools (`backend/app/services/companion/tools.py`) only read. Each returns cards
  (`notice`, `own_record`, `policy`, `table`, `report`, `launch`) and runs as the person asking.
- The phone already turns requests like "apply leave for Friday" into an **action chip** under
  Mira's reply (`mobile/src/core/intents.ts`, Phase 3). The chip opens the normal form, pre-filled
  only with what the words make unambiguous. The person reviews it and submits it through the
  module's own endpoint. Mira does not submit anything, and the server is not involved.

The chip works, but it is a guess made on the phone from the words alone. It cannot know the
leave type is called "Casual Leave" in this workspace, that the balance is 2 days, or that Friday
is a holiday. The web portal gets no chips at all.

## The proposal

Mira's tools may return one new card type, **`action`**. It is a prepared request that the person
can confirm, change, or ignore. The server prepares it with the same checks the form uses. The
client shows every field. Only a tap by the person sends it, through the existing module endpoint
and as that person.

```json
{
  "type": "action",
  "action_key": "apply_leave",
  "title": "Apply for leave",
  "summary": "Casual Leave · Fri 30 Oct · 1 day",
  "prefill": {
    "leave_type_id": "967a2e29-…",
    "start_date": "2026-10-30",
    "end_date": "2026-10-30",
    "half_day": null,
    "reason": "Family function"
  },
  "check": { "days": "1", "balance_after": "3", "problems": [] },
  "confirm_required": true,
  "expires_at": "2026-10-26T18:30:00Z"
}
```

- `confirm_required` is always `true`. No setting, prompt or client can turn it off.
- `check` is what the module's own preview says (for leave, `POST /leave/requests/preview`):
  days counted, balance after the request, and any rule it breaks. A request that would be refused
  is shown with the reason, and Confirm is disabled.
- `expires_at`: a card older than this cannot be confirmed (balances and rules change). The person
  can ask again.

### What it covers first

| `action_key` | What Mira prepares | Sent on confirm through | Confirm in the card? |
|---|---|---|---|
| `apply_leave` | type, dates, half day, reason; server preview | `POST /leave/requests` | yes |
| `regularise` | date, in/out times, reason; existing punches shown | `POST /attendance/regularisation` | yes |
| `claim_comp_off` | date worked, reason | `POST /leave/comp-off` | yes |
| `raise_ticket` | category, subject, description | `POST /helpdesk/tickets` | yes (no attachment) |
| `new_expense` | category, amount, date, notes | opens the expense form (a receipt photo is needed) | no, opens the form |
| `tax_declaration` | section, amount | opens the declaration form (proof upload) | no, opens the form |
| `withdraw_leave` | the pending request, named | `POST /leave/requests/{id}/cancel` | yes |

Reads that are only a screen to open (payslip, Form 16, my leave balance) stay `launch` cards.

### Never offered as actions

- The protected actions in `services/autonomy/catalogue.py` (`PROTECTED_KEYS`): payroll rule
  changes, releasing a disbursement, changing an appraisal rating, anything on a Your Voice case,
  timesheet approval, cover for a short shift.
- **Approving or rejecting someone else's request.** A manager's decision stays in the Inbox,
  where the request, the balance and the team calendar are on screen. This could be a later step.
- Anything about **money leaving**: loans, early salary, reimbursement release.
- Anything for **another person**. Prepared requests are always the asker's own.

## How it is gated

The same three checks that apply to every tool today (`tools.offered`):

1. **Admin switch.** A new group in `companion/config.TOOL_GROUPS`:
   `"actions": "Prepare leave, attendance and helpdesk requests for a person to confirm."`
   It is **off by default**. This is the only group where "not listed" means off, because it changes
   what the companion is for.
2. **Role scope.** New self-service scopes in `oauth.allowed_scopes`: `leave:request:self`,
   `attendance:regularise:self`, `helpdesk:raise:self`. Everyone with an employee record holds
   them. A login without an employee record (a platform admin) does not.
3. **AI feature on** (`governance.FEATURES["companion"]`).

A module that is switched off for the workspace offers no actions for it. Linked products are not
touched: when CGB Helpdesk is linked, `raise_ticket` becomes a `launch` card to the helpdesk, as
the phone does today.

## How a confirm is sent, and audited

- The client keeps a fixed list mapping `action_key` to an endpoint and a form. The card names an
  `action_key`, never a URL, so a card cannot point the app at an arbitrary endpoint.
- On **Confirm**, the client sends the fields **as shown on screen** (after any edits) to the
  normal endpoint, with a header `X-AskMira-Origin: companion; message=<uuid>` and an
  `Idempotency-Key`. A second tap, or a retry after a dropped signal, makes one request, not two.
- `audit.record` reads that header from the request it is already given and writes
  `ai_context = {"origin": "companion", "message_id": …, "human_confirmed": true}` on the module's
  own audit row. That row is in the same transaction as the change, as now. No module code
  changes; every endpoint that passes `request` to the audit gets it.
- **Change** opens the full native form pre-filled, for anything the card does not show (a file,
  a half-day choice).
- The conversation stores the card as Mira showed it (`CompanionMessage.cards`, already stored).
  After a confirm, the card is updated to say what happened ("Sent · LR-0142") and links to the
  request.

## Safety rules (each one tested)

- Mira never submits. Building an `action` card writes nothing; the tool code that builds cards
  has no write path, and a test asserts that no database row changes while one is prepared.
- What the model suggests is untrusted input. The server re-reads every value: the leave type must
  be one the person may use, the dates real, the ticket category active. Anything it cannot verify
  is left empty for the person to fill.
- One action card per reply. A reply that would need two asks the person which first.
- Words in documents, policies or tickets that Mira reads cannot create actions. Actions come only
  from the person's own message in this conversation (the planner sees the source of each request).
- Rate limit: the existing daily message limit, plus at most 10 confirmed actions per person per day
  from Mira. The normal forms are not limited.

## What changes where

**Backend (after approval):**
- `companion/tools.py`: tools `prepare_leave`, `prepare_regularisation`, `prepare_comp_off`,
  `prepare_ticket`, `prepare_withdraw_leave`. Each calls the module's existing preview or read
  service as the person, and returns one `action` card.
- `companion/config.py`: the `actions` group, off by default. `oauth.allowed_scopes`: the three
  self-service scopes.
- `companion/direct.py`: the rule-based mode (no AI key) matches the same requests, so actions work
  without a model too.
- `services/audit.py`: read `X-AskMira-Origin` into `ai_context`. `core/idempotency.py` (new, small):
  replay the stored response for a repeated `Idempotency-Key` on these four endpoints.
- `POST /companion/messages/{id}/cards/{index}/outcome`: records "sent as LR-0142" on the card.
- Tests: gating (switch, scope, AI off), no write while preparing, an expired card is refused, an
  idempotent replay, the audit row carries the origin, protected and other-person requests are
  never offered.

**Phone:** an `action` card renderer (fields, check, Confirm / Change), and the client-side
`action_key` list. `core/intents.ts` stays as the fallback when actions are off.

**Web portal:** the same card in the companion panel (`frontend/src/components/companion/`).

## Size

About 2 days of backend work and 1 day each for the phone and the web, including tests. No new
tables. One optional migration only if you want confirmed actions listed in the AI transparency
page (`/autonomy/actions`); otherwise the audit rows already hold everything.

## Decisions for you

1. Approve this, or change the scope? (the first-wave list above)
2. Should the `actions` group be **off by default**, as proposed, or on?
3. Should managers be able to approve through Mira later (confirm in the card), or always in the
   Inbox?

Until you answer, nothing in `backend/` changes for this. The phone keeps its Phase 3 chips, which
need no server change.
