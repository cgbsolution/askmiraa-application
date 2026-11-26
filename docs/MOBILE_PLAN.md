# AskMira mobile — build plan

The employee app: every self-service function the backend gives an employee, and a manager's
own-team view, with **Ask Mira** in the centre of the tab bar. HR administration and payroll
operations stay on the web on purpose.

Every endpoint below was checked against the FastAPI app's own OpenAPI output
(`app.openapi()`, 1,081 paths on 2026-10-26), not against a grep of decorators, so multi-line
routes such as `POST /attendance/regularisation` are included. All paths are under `/api/v1`.

## Platform decisions

| Decision | Choice | Why |
|---|---|---|
| SDK | Expo SDK 52, RN 0.76, React Navigation 7 | As found. Runs in Expo Go 52 for development; a dev build is only needed for voice input. |
| Data | TanStack Query 5 over `lib/api.ts` | Caching, retries, background refresh. Only last payslip, profile basics and holidays persist (README offline table). |
| Icons | `lucide-react-native` + `react-native-svg` | Same family as the portal. |
| Fonts | Inter (body, Tier 1), Fraunces (Tier 2 headlines) via `@expo-google-fonts` | Named in tokens since the first slice; now actually loaded. Splash stays up until they are. |
| Motion | Reanimated 3 | Mira button glow, sheets, success ticks. Respects reduce-motion. |
| Sheets | `@gorhom/bottom-sheet` | Pickers, confirmations, Mira quick asks. |
| Lists | `@shopify/flash-list` for long lists | Notifications, history, feeds. |
| Spacing | One scale + layout tokens (`gutter 16`, `section 24`, `card 16`, `row 12`) | A test fails any raw padding/margin/gap number in `screens/` or `components/`, so gaps cannot drift screen to screen. |
| i18n | `t('English text')` (gettext style), `hi.ts` scaffold | Every string goes through `t()`; Hindi covers navigation, Home and Ask Mira. |
| Certificate pinning | Out of scope | Needs a native module and a key-rotation plan; noted for the security review. |

## Navigation

Redesigned 2026-10-29 (see `REDESIGN.md`): Attendance and Leave are tabs of their own, and the
Inbox opens from the bell on every tab.

```
Root stack
├── Tabs
│   ├── Home stack        Home · All services · Announcements · Celebrations · Company links
│   ├── Attendance stack  Attendance (punch card, calendar / day by day, month at a glance) ·
│   │                     Punch (map) · Punch history · Day detail · My corrections · Shifts ·
│   │                     Overtime · Timesheet
│   ├── (Ask Mira)        centre button — opens the Mira modal, never a tab screen
│   ├── Leave stack       Leave (balance donut, balance by type) · My leave requests · Leave
│   │                     detail · Comp-off · Holidays · Optional holidays · Who's out
│   └── Me stack          Me hub · Profile … Settings (see Me) · My Team (managers)
├── Pages over the tabs   Inbox (Updates | Approvals | Tasks, bulk approve) · Approval detail
└── Modals                Ask Mira chat · Mira history · Apply leave · Regularise · New expense ·
                          New ticket · Give shoutout · Resign · Request asset · Refer · Apply loan
```

Deep links: `askmira://<route>[/<id>][?k=v]`, mapped in `core/deepLinks.ts`. Every event key the
backend emits (extracted from `services/**`, 90+ keys) has a destination; `unmappedEventKeys()` is
empty and tested.

## Screen inventory and endpoints

Module gates come from `tenant.enabled_modules` (`leave`, `payroll`, `core_hr`, `culture`,
`rewards`, `hiring`, …) — the same switches the routers enforce with `require_module`. An entry
point for a module that is off is hidden; a 403 "module is not enabled" renders the module-off state.

### Shell
| Screen | Endpoints |
|---|---|
| Sign in (password, workspace, 2-step, SSO) | `POST /auth/login`, `POST /auth/login/mfa`, `POST /sso/discover`, `GET /sso/start/{id}`, `POST /sso/oidc/callback`, `POST /auth/forgot-password` |
| Session | `GET /auth/session` (user, role, is_manager, employee_id, tenant.enabled_modules, linked_products) |
| Push | `POST /notifications/devices`, `POST /notifications/devices/unregister` (sign-out) |

### Home (Tier 2; payroll strip Tier 1)
| Block | Endpoints |
|---|---|
| Greeting, today | `GET /dashboard/summary` |
| Today's shift, punch state | `GET /attendance/day?from&to`, `GET /attendance/settings` (photo/geo rules), `POST /attendance/punch` via the offline queue |
| Quick actions | `GET/PUT /dashboard/quick-links` |
| To-dos | `/onboarding/my-tasks`, `/culture/surveys/mine`, `/documents/company` (unacknowledged), `/assets/me`, `/appraisal/my`, `/feedback/inbox`, `/tax/windows` |
| Announcements, celebrations, who's out, holiday | `/culture/announcements`, `/employees/celebrations`, `/leave/who-is-out`, `/leave/holidays` |
| Payroll strip | `/payroll/my-payslips`, `/payroll/payslip-protection` |

### Time (Tier 1)
| Screen | Endpoints |
|---|---|
| Attendance calendar + day | `GET /attendance/period`, `/attendance/day`, `/attendance/punches` |
| Regularise (day, range), list, cancel | `POST /attendance/regularisation`, `POST /attendance/regularisations/range`, `GET /attendance/regularisations`, `POST /attendance/regularisations/{id}/cancel` |
| Leave balances, apply (preview first), history, cancel | `/leave/balances`, `/leave/types`, `POST /leave/requests/preview`, `POST /leave/requests`, `POST /leave/attachments`, `GET /leave/requests`, `POST /leave/requests/{id}/cancel` |
| Comp-off | `GET/POST /leave/comp-off?mine=true`, `POST /leave/comp-off/{id}/cancel` |
| Optional holidays, calendar | `GET /leave/optional-holidays`, `POST/DELETE /leave/optional-holidays/{id}`, `GET /leave/holidays` |
| Shifts, swaps | `GET /attendance/assignments`, `/attendance/shifts`, `GET/POST /attendance/shift-swaps`, `…/{id}/respond`, `…/{id}/cancel` |
| Overtime | `GET /attendance/overtime/mine` |
| Timesheet | `GET/PUT /timesheets/me?week_of`, `POST /timesheets/me/submit`, `GET /timesheets/projects` |

### Inbox (Tier 1)
| Segment | Endpoints |
|---|---|
| Notifications | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET /notifications/unread-count`, `GET /notifications/stream` (SSE while foregrounded) |
| Approvals | `GET /approvals`, `GET /approvals/count`; decisions on each module's own route: leave approve/reject, `PATCH /attendance/regularisation/{id}`, comp-off approve/reject, `POST /expenses/claims/{id}/manager-decision`, `POST /timesheets/{id}/decide`, `POST /attendance/overtime/{id}/decide`, `POST /attendance/shift-swaps/{id}/decide`, travel manager-decision, asset request approve/reject, flexi decide |
| Tasks | `GET /onboarding/my-tasks`, `/exits/clearance/mine` |

### Ask Mira (Tier 2)
`GET /companion/status`, `GET /companion/conversations`, `GET/DELETE /companion/conversations/{id}`,
`POST /companion/messages {text ≤2000, conversation_id?}`. Card types mirror
`frontend/src/components/companion/types.ts`. Consent: `GET/POST /dpdp/me/consent`.

### Me
| Section | Endpoints |
|---|---|
| Profile | `GET /employees/me/profile`, `GET/POST /employees/me/change-requests`, `PUT/DELETE /employees/me/photo`, `GET /employees/me` |
| Org: manager + team | `GET /employees?manager_id`, `GET /employees/{id}` |
| Payslips | `GET /payroll/my-payslips`, `/payroll/my-payslips/{id}`, `/payroll/my-payslips/{id}/pdf` |
| Salary, total rewards | `GET /payroll/my-salary`, `GET /payroll/my-total-rewards` |
| Tax | `GET /tax/windows`, `GET/POST /tax/regime`, `GET /tax/regime/compare`, `GET/PUT /tax/declarations`, `POST /tax/declarations/{id}/submit`, `GET /tax/projection`, `GET /tax/form-16`, `GET /tax/form-16/pdf` |
| Loans, flexi, EWA | `GET /loans/schemes`, `GET/POST /loans/mine`, `GET/PUT /reimbursements/flexi/me`, `GET /ewa/me`, `POST /ewa/requests` |
| Benefits, ESOP | `GET /benefits/me`, `GET /benefits/plans`, `POST /benefits/plans/{id}/enrol`, `GET/POST /benefits/life-events`, `GET /esop/me`, `GET /esop/me/projection` |
| Expenses | `GET /expenses/meta`, `GET/POST /expenses/claims`, `GET /expenses/claims/{id}`, `POST …/submit`, `POST …/cancel`, `POST /expenses/receipts`, `GET/POST /expenses/advances`, `GET/POST /expenses/travel-requests` |
| Helpdesk | `GET /helpdesk/categories`, `GET /helpdesk/tickets/mine`, `POST /helpdesk/tickets` (multipart), `GET /helpdesk/tickets/{id}`, `POST …/comments`, `…/reopen`, `…/rate`, `…/cancel` |
| Documents & letters | `GET /documents?employee_id`, `GET /documents/categories/self-upload`, `POST /documents/mine`, `GET /documents/{id}/download`, `GET /documents/company`, `POST /documents/company/{id}/acknowledge`, `GET /letters`, `GET /letters/{id}/pdf`, `POST /letters/{id}/acknowledge` |
| Assets | `GET /assets/me`, `POST /assets/assignments/{id}/acknowledge`, `GET/POST /assets/requests`, `POST /assets/requests/{id}/cancel`, `GET /assets/categories` |
| Growth | `/goals/*`, `/one-on-ones`, `PUT /one-on-ones/{id}/my-note`, `/feedback/inbox`, `/feedback/requests`, `/appraisal/my`, `/learning/me`, `POST /learning/me/{id}/complete` |
| Culture & rewards | `/culture/shoutouts`, `POST /culture/shoutouts/draft`, reactions, `/culture/clubs`, `/culture/polls`, `/culture/events`, `/culture/surveys/mine`, awards, `/rewards/me/statement`, `/rewards/catalogue`, `POST /rewards/catalogue/{id}/redeem` |
| Referrals | `/recruiting/*` (open roles, refer, `GET /recruiting/my-referrals`) |
| Interviews | `GET /interviews/mine`, `GET /interviews/{id}`, `POST /interviews/{id}/feedback` (route verified to exist) |
| Onboarding | `GET /onboarding/me`, `/onboarding/me/summary`, `/onboarding/my-tasks` |
| Exit | `POST /exits/resign`, `GET /exits/mine`, `GET /exits/clearance/mine` |
| Privacy | `GET /dpdp/me/notice`, `GET/POST /dpdp/me/consent`, `POST /dpdp/me/consent/{key}/withdraw`, `GET /dpdp/me/export`, `GET/POST /dpdp/me/requests`, `GET /dpdp/me/erasure-preview`, `GET /autonomy/transparency`, `GET /autonomy/actions` |
| Security | `GET /auth/mfa`, `POST /auth/mfa/setup`, `/enable`, `/disable`, `POST /auth/change-password`, `POST /auth/logout` |
| Settings | `GET/PATCH /notifications/preferences`, `GET/PUT /notifications/whatsapp/consent` |

### My Team (managers: `user.is_manager`)
`GET /attendance/team/today`, `GET /approvals/count`, `GET /appraisal/team`,
`GET /appraisal/appraisals/{id}` + `/submit`, `/draft`, `/return` (manager and second review),
`GET /one-on-ones/reports`, `GET /leave/balances/team?q`, `GET /employees/{id}`. Decisions stay in
the Inbox (`/approvals`). A link to My Team opened by someone without reports shows an honest
"No one reports to you" page instead of failing calls.

## Build order

| Phase | Scope | Status |
|---|---|---|
| 1 | §1 gaps, fonts, icons, dark tokens, `core/types.ts`, TanStack Query, module API clients, 5-tab shell with the centre Mira button, stacks, linking + deep-link tests | **done** 2026-10-26 — boots on Android 15 (API 35) in Expo Go 52; sign-in, tabs, Time and Me hubs verified on the emulator; 110 tests |
| 2 | Ask Mira: status states, history, every card renderer, web→mobile route map, context chips | **done** 2026-10-26 — direct and AI modes, no-consent → in-app Consent → AI, own-record/table/notice/policy/report cards against the QA API, quick asks, history, daily limit, offline. Launch cards and paged tables need a linked product; a real report needs a real model key |
| 3 | Home, Time, Inbox end to end; intent action chips | **done** 2026-10-26 — punch online and offline (airplane mode, sync on reconnect), apply leave with preview and notice rule, regularise, attendance calendar and day detail, manager approvals with required reject note, intent chips from Mira |
| 4 | Me: Profile, Pay, Tax, Expenses, Helpdesk, Documents, Assets | **done** 2026-10-26 — tried as Vikram (manager) and Meera (employee) on the emulator against the QA API. Profile: direct edit saves and reopens exactly; HR-checked sections send a change request with a reason, show the field-by-field change and can be withdrawn; empty or reason-only requests refused. Pay: payslips, payslip detail, salary (monthly/yearly table), total rewards; every figure on a pay screen hides and shows together. Tax: projection, regime comparison table, declarations (add, submit, proof photo, proof above declared refused), HRA (server's landlord-PAN threshold surfaced, values reopen exactly), previous employer, Form 16/12BB. Expenses: receipt by camera, server policy verdict, over-limit claim submitted with a reason, withdraw, receipt opens in the photo viewer, travel request with advance > cost refused, cancel. Helpdesk: raise (double tap → one ticket), 12 MB file refused, wrong type not selectable, reply with photo, withdraw, rate, reopen offered after resolve. Documents: open (PDF named), add with photo, letters with integrity check and typed-name acceptance (wrong name refused by server). Assets: acknowledge receipt, request. Linked ExpenseGenie/CGB Helpdesk show an "Open in …" launcher |
| 5 | Growth, Culture, Referrals, Onboarding, Exit, Privacy, Security, Settings, My Team, Hindi scaffold | **done** 2026-10-26 — Growth: goals and check-ins, 1:1 points/actions/private note, feedback to give and received, self review (rate, draft, send, form closes itself) and the manager review of a report (the report's own rating shown per item, every applicable item required, live score preview, "send back" with a reason), learning with quiz and certificate. Culture: shoutouts with reactions and AI draft, clubs, polls, events, surveys, awards. Referrals, interviews (feedback with a 1–10 score), onboarding, exit (resign, withdraw). Security: 2-step sign-in turned on with a real authenticator code (recovery codes shown once) and off with password + code (wrong password refused); change password with the server's rules shown as you type, and the phone signs straight back in. Settings: language (Hindi scaffold switches the shell), light/dark/system, WhatsApp opt-in (letters dropped as typed, discard guard) and opt-out. Notifications: one card per area with in-app, phone, email (and WhatsApp once opted in); every switch stored as the full set with digests kept, checked in the database. My Team: today's attendance per person, approvals and reviews waiting, reviews and 1:1s; each person's today, leave balances, reviews and 1:1. Tried as Vikram (manager) and Meera (employee) |
| 6 | Polish: motion, haptics, every state on every screen, accessibility, performance | **done** 2026-10-26 — every screen swept in dark mode at large text (1.3×) and the busiest at the largest (2×); TalkBack labels checked on the four hubs (no unlabelled button); Android 8.0 (API 26) run: sign-in, forms and sheets with the keyboard, payslip PDF, punch with location refused/required/allowed (stored with coordinates, flagged outside the geofence), offline punch with the app killed (sent on reopen within 2 minutes; after that kept on the phone and turned into a pre-filled regularisation), switched-off module, a 2,001-character Mira message (counter and send blocked). Screenshots in `docs/screens/` |
| — | `MIRA_ACTIONS_PROPOSAL.md` — written, then stop for approval before any backend change | **written** 2026-10-26 — waiting for approval; no backend change made for it |

## Testing

- Pure logic (`src/core`) runs in Node: `npm test`.
- Device runs use the Android emulator against a **local QA database** (`askmira_mobile_qa` on the
  :5441 test cluster, seeded by `scripts/seed_flows.py`) through a QA API on :8010 with mail off.
  Never the shared database.

## Found and fixed while testing (app-wide)

Phase 4's device runs turned up problems that were not specific to one screen:

- **Signed out by a bad signal.** A refresh that failed for any reason ended the session. Now only
  the server refusing the refresh token does (`core/refresh.ts`); a 401 on a fresh-looking token gets
  one forced refresh and retry first.
- **Dates a day early.** Timestamps were cut to their UTC day, so an evening in India showed as the
  previous date. `formatDate` and `localDay` read timestamps in local time (`core/dates.ts`).
- **Status bar.** Returning from the camera turned the status bar see-through and headers slid under
  it. Every stack now declares the bar see-through and transparent, with dark icons on cream.
- **Sheets and the keyboard.** Fields in a sheet use the sheet's own input; the sheet rises above the
  keyboard without counting it twice; every sheet scrolls (a validation message no longer pushes the
  button under the navigation bar); Back closes the sheet, not the screen; a sheet with typed input
  asks before discarding; a form in a sheet starts fresh each time it opens.
- **Messages hidden.** Toasts drew behind open sheets and behind the keyboard; both fixed.
- **Navigation.** A form opened inside a tab had its Save bar behind the tab bar — forms are modals
  now, enforced by `core/__tests__/forms.test.ts`. Re-tapping a tab returns to its hub. A screen opened
  from a link has its hub underneath, so Back stays in the app.
- **Money on screen.** Pay screens masked the net pay but showed the gross; all figures on a pay
  screen now hide and show together. Float comparisons of amounts replaced with decimal ones.

Phase 6 added:

- **Switched-off modules.** A link into a module the company had switched off showed the
  screen's buttons over the server's refusal. The navigator now shows only "not switched on"
  for every screen of that module (`core/routeModules.ts`, mapped from the server's routers).
- **Dark mode and large text.** Switches were nearly invisible in dark mode; status badges
  squeezed titles into a narrow column at large text; segmented tabs and count bubbles spilled
  over; all fixed in the shared components, so every screen got the fix.
- **Android 8.** The navigation bar's buttons were white on cream (invisible); below Android 15
  the bar now takes the tab bar's colour. Location refused when the company requires it now
  offers "Open phone settings".
- **Tax figures.** The tax, regime and Form 16 screens showed income unmasked while payslips
  hid it; they now share the pay screens' eye toggle.

Phase 5 added:

- **Keyboard on Android 15.** React Native learns the keyboard closed only on the next layout pass,
  and closing it with Back makes none, so sheets and form bars stayed lifted over a blank gap until
  the next tap. It also never reports a keyboard that grows (a password keyboard, then one with a
  suggestion strip), which left buttons and error messages behind the strip. One app-wide store
  (`lib/keyboard.ts`) now lifts by the tallest keyboard the phone has shown (remembered across
  launches), and `components/KeyboardWatch.tsx` nudges a layout pass while the keyboard is up so the
  close is noticed at once.
- **Password change ended the session.** The server ends every session on a password change,
  including the phone's own; the next call bounced the person to sign-in. The phone now signs
  straight back in with the new password (or asks to sign in again when 2-step sign-in is on).
- **Server text with raw dates.** Refusals and notifications read "2026-10-26"; the app shows
  "26 Oct 2026" (`readableDates`, which leaves references and timestamps alone).
- **A loading sheet that never ended.** The 2-step set-up sheet showed a skeleton forever if the key
  could not be fetched; it now says so and offers "Try again".

## Backend gaps

Found while building; each is handled honestly on the phone and listed for a backend decision.

1. **Offline punch time.** `POST /attendance/punch` refuses a self-punch that carries its own
   `punched_at` (403, `punch_source_for`), so a punch queued offline cannot reach the server with the
   time it was tapped. The app sends a queued punch live only within 2 minutes of the tap; anything
   older is kept on the device with its real time and the person is taken to a pre-filled
   regularisation. *Proposal:* accept an offline `captured_at` for `mobile_geo` self-punches up to
   72 hours old, stored as an offline capture and flagged for HR review.
2. **Per-person quick actions.** `PUT /dashboard/quick-links` is admin-only and company-wide. The
   phone keeps each person's quick-action order on the device and shows the company's quick links
   separately. *Proposal:* a per-user `PUT /dashboard/my-quick-links`.
3. **Employees cannot read their roster.** `GET /attendance/assignments` is HR-only (403). The phone
   shows today's shift and weekly offs from `/attendance/period`; a per-day roster for the coming
   weeks needs a self-service endpoint.
4. **Linked products, natively.** When ExpenseGenie or CGB Helpdesk is linked, the phone opens the
   product in the browser, signed in (`POST /products/{product}/launch`). The portal's live views
   (`/products/{product}/views/…`) return the product's own shapes, which cannot be tested here
   without a running product; native lists can follow once one is available to test against.
5. **Profile identity lives on two records.** `GET /employees/me/profile` has no `identity` block
   (name and date of birth come from `GET /employees/me`). The phone reads both; one source would
   be simpler.

6. **A phone punch without a location is recorded as "web".** `PunchSource` has `mobile_geo`
   (phone, with a location) and `web`, nothing for a phone punch where the person declined location
   (allowed when the workspace's location mode is optional). The phone sends `web` rather than
   claim a location it does not have, so HR's punch list cannot tell phone from browser for these.
   *Proposal:* a `mobile` source. Also: the server's "location required" refusal tells the person
   to allow location "for this site in your browser"; the phone checks the rule first and words it
   for a phone, but the server text would read oddly if it ever reached the app.

## Fixed on the backend while building

- **The notification stream leaked a database connection per open app** (`GET /notifications/stream`
  used the request's session after FastAPI had closed it; fifteen open phones emptied the pool and
  every request then failed with "busy"). Each poll now borrows and returns its own session;
  covered by `tests/test_notification_stream.py` and `tests/integration/test_notification_feed_flow.py`.
  The web portal did not use the stream, so production web was not affected.
- **Notification settings did not match what was delivered.** Delivery uses a person's saved
  choices for an event *instead of* its defaults (deliberate, and tested), but
  `GET /notifications/preferences` showed the defaults as on beside them, so a channel looked on
  and was never sent. The list now fills in defaults only for events with nothing saved; the
  phone saves the full set per event either way.
- **"These four" over a list of six.** The AI transparency text (web and phone) said four
  actions can never be automatic while listing six; it is now counted from the list
  (`protected_statement`, tested).
- **Over-limit expense claims could not be submitted from the web dialog.** Capture reports
  `may_submit: false` for "needs a reason", but submit accepts it with one; the web dialog hid the
  reason box. Same rule on both clients now (`core/expenses.ts` on the phone).
