# AskMira mobile — redesign (2026-10-29)

The employee app restyled to the web portal's brand and rebuilt around the screens people
know from the older HRMS (the 44 screenshots in `C:\Users\Deepak\Downloads\mobileimg`). Every
workflow the app already had is kept and still talks to the same API; nothing on screen is
invented. Screenshots of the result: [screens/redesign/](screens/redesign/).

**Second pass, same day, from the user's review:** Home is now the old HRMS's home screen
(company logo, search, a two-column grid of services in the old app's order), and every
icon that names a place is the marketing website's own spot illustration — "icons should
be this type". See [Home](#home) and [Icons](#icons).

## Brand and design system

The portal (`frontend/src/app/globals.css`) is the reference.

| Token | Value | Use |
|---|---|---|
| Maroon `primary` | `#7D0712` (dark theme `#9E2630`) | Main buttons, links, selection, calendar band |
| Rail gradient | `#6B0A13 → #34040A` | Tab bar, splash, sign-in, lock, app-switcher cover |
| Marigold `accent` | `#F8A01A` | One hero action per hub (Apply leave), active tab chip, Ask Mira |
| Cream / Ink | `#FEF8F4` / `#1A1110` | Background / text |
| Blush chip | `#FDE8DD` + maroon icon | Every icon tile and service tile (the portal's stat-tile chip) |
| Logo red | `#EB061D` | Inside the logo artwork only — a test fails if any UI colour uses it |

- Type: Fraunces for the greeting, the live clock and hero names (as the portal); Inter for
  everything else. New styles: `clock`, `overline`, `tabActive`.
- Radii: the portal's — Tier 1 cards 14, Tier 2 cards 22, controls 12.
- Icons: the website's spot illustrations wherever an icon names a place (see [Icons](#icons));
  lucide line icons only inside controls and for status, as on the website.
- New shared components: `TabHeader`, `ServiceGrid`, `StatGrid`, `Charts` (donut, bars),
  `InfoList` (icon · label · value rows), `StaticMap`, `Fab`, `Checkbox`, `Pill`,
  `BrandBackdrop`, `AnimatedSplash`.

## Icons

The user pointed at the marketing website's module icons and asked for the app's icons to be
"this type": small flat pictures in wine, one red accent, pink and marigold, on a soft blush
tile. The app now uses exactly those drawings.

- Source of truth: `website/src/components/illustrations/spots.tsx` (62 drawings) plus 17 the
  app needs that the website lacks, drawn in the same style in `scripts/spots/extra.tsx`
  (apply leave, leave requests, holidays, optional holidays, comp-off, regularise, overtime,
  punch history, resignation, all services, search, total rewards, Form 16, reward points,
  flexi benefits, documents folder, celebrations).
- `npm run spots` (`scripts/spots/build.mjs`) renders each with React and writes
  react-native-svg code to `src/components/spots/drawings.gen.tsx` and the names to
  `src/core/spotNames.ts`. react-native-svg has no `paint-order`, so the website's "cut" (an
  outline in the tile colour under a shape) is drawn as two shapes. `scripts/spots/sheet.mjs`
  photographs a contact sheet with Chrome to judge a drawing; `check.mjs` validates one.
- Tones live in `theme/tokens.ts` (`spotInk`, `spotTiles`) — the website's own, including its
  red, which is artwork only (a test keeps every interface colour off it). Tiles stay light
  in the dark theme, as the website sets them on its dark bands.
- Shown with `<SpotTile>` (`components/Spot.tsx`): service tiles (48), list rows that lead
  somewhere (`ListRow spot=…`, 40), empty states (`EmptyState spot=…`, 64). Records and
  status rows keep a line icon in their tone, so colour still carries meaning.
- The same destination has the same picture everywhere (`core/services.ts` is the map; a test
  checks every service has one and no two in a group or on Home look alike).

## Home

The old HRMS's home, in AskMira's colours: the company's logo (the one an admin sets in the
portal, Settings → Company, served from the company's public sign-in page — the name when
there is none), a search box, and the services two to a row with the picture on the left and
the name beside it, in the old app's order — Punch, Leave, Payslips, Regularise attendance,
Documents ("Plug Me!"), Calendar, Ask Mira ("Fia"), IT declaration, Punch history ("In Out
Report"), Helpdesk, Company policies ("Acknowledgement"), Assets, Approvals — then All services.
A tile shows only when the person can reach it, and carries a count when something waits
there (approvals, a punch not recorded, a policy to acknowledge). The search covers every
service, by name or by the old app's words.

What Home used to carry moved; nothing was dropped: today's punch → the Punch tile and the
Attendance tab; leave left → the Leave tab; "Needs your attention" → the Inbox's Tasks tab,
counted on every tab's bell (`lib/todos.ts`); who's out, holidays, celebrations, announcements
and company links → their tiles in All services.

## Maps

The punch screens draw **Google's map**, as the portal does: the Maps JavaScript API in a web
view (`components/GoogleMap.tsx`), with the key the API hands out after sign-in
(`GET /attendance/map-config`). The key lives only in the backend's `.env`
(`MAPS_PROVIDER`, `GOOGLE_MAPS_API_KEY`); nothing about it is in the app or its build. The map
shows the person's dot and accuracy (or a punch's pin) and the work-location circles; the
dot moves as the phone's position updates without reloading the map. It takes two fingers to
pan, so one finger still scrolls the page.

`components/PlaceMap.tsx` picks the map and falls back to OpenStreetMap (`StaticMap`) exactly
as the portal does: when the backend has no key or says `leaflet`, when Google refuses the key,
when the phone's web view is too old for Google's script, or when nothing is drawn in 12 s.
After one refusal the session stays on OpenStreetMap. In development the reason is logged as
`[map] …`. Google's map is billed per load (the punch screen and the punch sheet each load
it once).

Checked 2026-10-29: the key draws Google's JavaScript map; Google's Static Maps API is not
switched on for it (not used).

## Navigation

**Home · Attendance · ( Ask Mira ) · Leave · Me**, and the Inbox behind a bell on every tab.

Why: attendance and leave are what an employee opens most (the older HRMS's first tiles were
Punch, Leave, Payslip, Regularisation), so each got its own tab instead of sharing "Time". Ask
Mira stays in the centre — it is the product. Approvals matter daily only to managers and HR;
for them the bell's number, the Approvals tile on Home (with its count) and a row at the top
of Me all lead to them, so the fifth slot stays Me (pay, documents, profile, settings) for
everyone. The bell opens on what is waiting: approvals, else new updates, else things to do.

The older HRMS's side drawer (profile, change password, notifications, sign out / sign in as
someone else) is the Account group in Me.

## Screen map — older HRMS → AskMira

| Older HRMS screen | AskMira screen | Status |
|---|---|---|
| Splash | Animated splash: logo on the rail maroon, site tagline, version | Done |
| Home grid + company logo + search | **Home**: company logo, search, the old app's 13 tiles in its order with the website's icons, then All services; **All services** grouped, with search by the old names ("plug me", "salary slip", "AR") | Done |
| Drawer (profile, change password, notifications, sign out) | Me → Account | Done |
| Punch (map, clock, Punch In / Out, last punch) | **Punch**: live clock, map with work-location circles, address, "At Bengaluru HQ" / "2.3 km from…", both buttons, last punch line | Done |
| Punch registered sheet (map, type, time, address) | Punch result sheet: map pin, direction, time, address, geofence, honest state (recorded / saved on phone / not recorded) | Done |
| "Use location?" dialog | Notices for not allowed / switched off / accuracy setting / no fix, each with its fix | Done |
| Punch History / Offline Punch tabs | **Punch history**: by day (latest two open), map per punch; **On this phone**: queued punches, Send now, Regularise | Done |
| Calendar (day colours, legend, day detail) | Attendance tab → Calendar (same 8 colours from the API), selected-day card, month at a glance | Done |
| Attendance Regularisation (cycle, day cards, ⋮ menu) | Attendance tab → **Day by day**: shift, in, out, hours, late/regularised badges, ⋮ Regularise / View day / View my request | Done |
| Attendance application (dates, times, reason, remarks) | Regularise form (missed punch / wrong status / on duty / WFH, single day or range) | Kept |
| In Out Report | Punch history (own punches by date range) | Done (own only) |
| Leave (Apply, Balance, Balance report) | Leave tab | Done |
| Leave balance (donut + opening / accrued / availed / balance / applied / available) | Leave tab donut + **Balance by type** breakdown in the same terms; statutory leave listed apart | Done |
| Apply leave list (+) and form | My leave requests (+) and Apply leave (preview of days before sending) | Kept |
| Leave balance report (HR) | My team → team balances (managers) | Kept |
| Payslip (FY, chart, salary details, IT details, YTD, months) | **Payslips**: FY switch, net pay by month, month details with Payslip / View, year to date, every month, links to Income tax and IT declaration | Done |
| Payslip PDF preview | Payslip detail + PDF (open / share) | Kept |
| Approval hub (attendance, leave, shift, OT & comp-off, separation, loan) | Inbox → **Approvals**: filter by kind, latest first or person by person | Done |
| Attendance / Leave approval with Select all + Bulk action | Tick several (or a whole person), **Bulk action**: Approve / Reject with one remark (needed to reject); each sent as its own decision | Done |
| Plug Me (Company files / Personal files / folders / files) | **Documents**: the same folders, breadcrumb, view and share, search across files, + to add | Done |
| Tickets (Self, sort, filter, +) and Create ticket | Helpdesk (+) and Raise a ticket (type, title, details, priority, attachment) | Done |
| Fia chatbot with quick chips | Ask Mira (direct lookups, quick asks, history) | Kept |
| Profile (photo, contact, addresses, gender, marital, job, PAN, Aadhaar, UAN, ESI, bank, dates, managers, Separation) | **Profile**: the same groups as icon rows, Edit / Request a change per group, Separation at the foot | Done |
| IT Declaration | IT declaration | Kept |
| Acknowledgement | Company policies (read and acknowledge) | Kept |
| Assets | My assets | Kept |

AskMira-only screens (expenses, loans, flexi, early pay, benefits, stock options, salary,
total rewards, tax regime, Form 16, letters, goals, reviews, 1:1s, feedback, learning,
culture, rewards, referrals, interviews, onboarding, privacy, security, settings,
notification settings, my team, holidays, optional holidays, comp-off, shifts, overtime,
timesheet, announcements, celebrations, who's out, company links) take the new look from the
shared components and were each opened and checked.

## Not done, and why

- **Half day on each end of a range** (older HRMS: from-date and to-date day types). The API
  takes a half day only for a single date (`is_half_day` + `half_day_session`), so the form
  offers exactly that.
- **"Email notification to"** on a leave request. Approvers are notified by the workflow; the
  API has no extra-recipient field.
- **In Out report for all employees, terminal filter** — an HR report; the portal's reports
  cover it. The phone shows a person's own punches.
- **Live map on Google, end to end.** Google's map was seen drawing in the app (punch sheet,
  Android 15) and the live-map page was checked in Chrome (dot, accuracy, moving without a
  reload, zoom buttons); the live Punch screen itself could not get a GPS fix on the
  Android 15 emulator (no Play Services), and the Android 8 emulator's 2018 web view is too
  old for Google's script, so there the app fell back to OpenStreetMap as designed. Check
  the Punch screen once on a real phone.
- **Splash in Expo Go.** Expo Go shows its own loader (the app icon); the native splash in
  `app.config.ts` (logo on maroon) applies to a store build, and hands over seamlessly to the
  animated one.

## Testing

On the Android 15 and Android 8 emulators against a local QA copy (`askmira_mobux_qa`, QA API
on :8010), as Meera (employee) and Vikram (manager):

- Every route opened by deep link and checked, light and dark; hubs at 1.3× text; main
  screens at 360 dp wide (small phone).
- Bulk approvals: two corrections approved, two rejected with a remark; reject with no
  remark refused; checked in the database (status, note, audit rows).
- Punch (Android 8, real GPS fixes): the live map, the work-location circle, the address and
  "At Bengaluru HQ"; Punch out recorded (201) with its coordinates and "inside" in the
  database; from New Delhi, "1142.8 km from Mumbai office – BKC" and "Recorded, outside your
  work location". Punch history shows each punch's map.
- Leave: statutory maternity / paternity leave kept out of "available".
- Payslips: amounts hidden until shown; year to date adds up exactly.
- Found and fixed while testing: pull-to-refresh on Punch history refreshed only half the
  screen; "1 punches"; large text cut the punch card heading and leave names; long service
  names broke mid-word at 360 dp; the Mira button's endless glow kept the CPU at 50–100%
  (now three breaths, then still: ~4% at rest); the live map could not get a fix where the
  phone's location-accuracy setting refuses requests (now uses GPS directly and explains);
  the punch took its own location fix, so the recorded place could differ from the map by
  kilometres (it now records the position shown); on Android 8 the Inbox's bottom bar
  (Select all · Bulk action) was pushed off the screen by the native header (pages over the
  tabs now draw their own header).

Second pass (Home, icons, Google map), same emulators and QA copy:

- Home with and without a company logo (a test logo uploaded to the QA copy only), search by
  old words ("plug me" → Documents) with the keyboard up, the tab bar hidden while typing,
  dark theme, 360 dp and 1.3× text. Found and fixed: a count badge squeezed "Approvals" until
  it broke mid-word (the count now sits on the picture's corner); at 360 dp or large text
  long words broke mid-word (the tiles now put the picture above the name there, and a
  one-word name shrinks rather than breaks); Home did not pick up a new "Choose for Home"
  until restart; the portal-address setting crashed when unset (`{}` in the manifest).
- Every converted menu and empty state reviewed against a snapshot by a second reviewer;
  Inbox → Tasks lists what Home's "Needs your attention" did; the bell counts it.
- Google's map drawn in the punch sheet (Android 15); fallback to OpenStreetMap seen on
  Android 8 (`[map] … Script error.` from its 2018 web view).

Unit tests: `npm test` (241, including `services` — every service has a picture, none
repeated in a group or on Home, Home in the old app's order — `inbox`, `geo`, `pay`,
bulk-approval and worked-time tests); `npx tsc --noEmit`.
