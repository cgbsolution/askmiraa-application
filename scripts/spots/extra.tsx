/**
 * The spots the app needs that the website's set does not have, drawn in its
 * style (website/src/components/illustrations/spots.tsx). This file is appended
 * to the website's before compiling, so the website's helpers and tones
 * (Svg, CalendarBase, Lines, Check, sparkle, cut, ln, D R P M W B) are in scope
 * and there are no imports. Helpers defined here are prefixed by family.
 *
 * Drawn 2026-10-29: two illustrators per family, then a judge picked and refined
 * each against the website set at 96, 48 and 40 px. Change a drawing here, then
 * run `npm run spots`; judge it with scripts/spots/sheet.mjs.
 */

/* ------------------------------------------------- calendar: leave & holidays */

/*
 * Five more badges on the website's CalendarBase, like SpotCalendarClock and
 * SpotCalendarLock, for the app's Leave group. At 40 px only the badge tells
 * them apart, so each one differs from calendar (no badge) and calendarClock
 * (marigold disc) by its shape, its tone, or both:
 *
 *   calendarPlus   red disc, cream plus                 Apply leave
 *   calendarCheck  the tick itself, marigold, channelled My leave requests
 *   calendarStar   marigold star, one sparkle           Holiday calendar
 *   calendarHeart  red heart                            Optional holidays
 *   calendarSwap   wine disc, cream ⇄ (a day for a day) Comp-off
 *
 * The plus disc shares calendarClock's footprint (r 8.5 at 35.5, 35.5); the
 * wine disc is half a unit larger because it sits on a wine body and needs the
 * room for two arrows. The tick, star and heart are drawn a little wider than a
 * disc so they carry the same weight at list size.
 */

export const SpotCalendarPlus: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <CalendarBase
      badge={
        <>
          <circle cx="35.5" cy="35.5" r="8.5" fill={R} {...cut} />
          <path d="M35.5 31.5v8M31.5 35.5h8" {...ln(W, 2.6)} />
        </>
      }
    />
  </Svg>
);

export const SpotCalendarCheck: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <CalendarBase
      badge={
        <>
          <path d="M28.4 35.5l5 5 9.4-10" {...ln(B, 8)} />
          <path d="M28.4 35.5l5 5 9.4-10" {...ln(M, 4.6)} />
        </>
      }
    />
  </Svg>
);

export const SpotCalendarStar: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <CalendarBase
      badge={
        <path
          d="M35.1 25.7l2.79 6.26 6.81.72-5.09 4.59 1.42 6.7-5.94-3.42-5.94 3.42 1.42-6.7-5.09-4.59 6.81-.72z"
          fill={M}
          {...cut}
        />
      }
    />
    <path d={sparkle(41.5, 8.5, 4.5)} fill={M} />
  </Svg>
);

export const SpotCalendarHeart: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <CalendarBase
      badge={
        <path
          d="M35.5 43.8s-9-5.4-9-11.6a4.9 4.9 0 0 1 9-2.7 4.9 4.9 0 0 1 9 2.7c0 6.2-9 11.6-9 11.6z"
          fill={R}
          {...cut}
        />
      }
    />
  </Svg>
);

export const SpotCalendarSwap: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <CalendarBase
      badge={
        <>
          <circle cx="35.5" cy="35.5" r="9" fill={D} {...cut} />
          <path d="M31.2 32.1h8.4M36.8 29.3l2.8 2.8-2.8 2.8M39.8 38.9h-8.4M34.2 36.1l-2.8 2.8 2.8 2.8" {...ln(W, 2.6)} />
        </>
      }
    />
  </Svg>
);

/* ------------------------------------------------- time: attendance, exit and navigation */

/** SpotSign's pen as a pencil: wine cap, red body, wine nib. Drawn upright on 0,0, nib down; place it with `transform`. */
function TimePencil({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <rect x="-3.5" y="-15" width="7" height="23" rx="2.6" fill={R} {...cut} />
      <rect x="-3.5" y="-15" width="7" height="6.5" rx="2.6" fill={D} />
      <path d="M-3.2 8h6.4L0 15.5z" fill={D} {...cut} />
    </g>
  );
}

/** An arrow laid over other shapes: a channel in the tile colour (the cut), then the line itself. */
function TimeArrow({ d, color }: { d: string; color: string }) {
  return (
    <>
      <path d={d} {...ln(B, 6.2)} />
      <path d={d} {...ln(color, 3.2)} />
    </>
  );
}

/** Regularise attendance: a wall clock at 9:00 (wine face, unlike SpotClock's pink one) and the pencil that corrects it. */
export const SpotClockEdit: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <circle cx="20.5" cy="21" r="16.5" fill={D} />
    <path d="M20.5 7.6v1.6M7.1 21h1.6M32.3 21h1.6M20.5 32.8v1.6" {...ln(P, 2.2)} />
    <path d="M20.5 14V21H14" {...ln(W, 3)} />
    <circle cx="20.5" cy="21" r="2.1" fill={M} />
    <TimePencil transform="translate(32.5 32) rotate(45)" />
  </Svg>
);

/** Overtime: a clock whose 12-to-3 quarter is marked in marigold (the extra hours), and a plus badge. */
export const SpotClockPlus: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <circle cx="21" cy="21.5" r="17" fill={D} />
    <circle cx="21" cy="21.5" r="12.5" fill={P} />
    <path d="M21 9a12.5 12.5 0 0 1 12.5 12.5H21z" fill={M} />
    <path d="M21 13v8.5h6.5" {...ln(D, 3)} />
    <circle cx="36.5" cy="36" r="8.5" fill={R} {...cut} />
    <path d="M36.5 31.8v8.4M32.3 36h8.4" {...ln(W, 2.6)} />
  </Svg>
);

/** Punch history (the "In Out Report"): a report with an arrow coming in and one going out. */
export const SpotInOut: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <rect x="6" y="5" width="21" height="30" rx="3" fill={P} transform="rotate(-8 16.5 20)" />
    <rect x="6.5" y="9" width="25" height="35" rx="3.5" fill={D} {...cut} />
    <Lines x={11} y={13.5} widths={[9]} />
    <Lines x={11} y={38} widths={[14]} />
    <TimeArrow d="M43.5 20.5H20.5M26 15l-5.5 5.5L26 26" color={R} />
    <TimeArrow d="M20.5 33h23M38 27.5l5.5 5.5-5.5 5.5" color={M} />
  </Svg>
);

/** Resignation: an open door and a calm way out. */
export const SpotDoor: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <rect x="5.5" y="4" width="27" height="40" rx="3.2" fill={D} />
    <rect x="10.5" y="9" width="17" height="35" fill={P} />
    <path d="M10.5 9l9.5 3.5v28.5l-9.5 3z" fill={D} {...cut} />
    <circle cx="17.3" cy="27.5" r="1.7" fill={M} />
    <TimeArrow d="M23 27h20.5M38.3 21.8l5.2 5.2-5.2 5.2" color={R} />
  </Svg>
);

/** All services: four app tiles, the red one turned on its corner ("and more"), a sparkle in the corner it leaves open. */
export const SpotGrid: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <rect x="4" y="4" width="18" height="18" rx="5" fill={D} />
    <rect x="27.25" y="6.75" width="15" height="15" rx="4" fill={R} transform="rotate(45 34.75 14.25)" />
    <rect x="4" y="26" width="18" height="18" rx="5" fill={P} />
    <rect x="26" y="26" width="18" height="18" rx="5" fill={D} />
    <path d={sparkle(42.5, 5.5, 4)} fill={M} />
  </Svg>
);

/** Search (and "Nothing called that"): a magnifying glass. */
export const SpotSearch: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <rect x="32" y="25.75" width="7.5" height="20" rx="3.75" fill={R} transform="rotate(-45 35.75 35.75)" />
    <circle cx="20" cy="20" r="15.5" fill={D} {...cut} />
    <circle cx="20" cy="20" r="10.5" fill={P} />
    <path d="M13.5 18.5a7 7 0 0 1 5-5.2" {...ln(W, 2.6)} />
    <path d={sparkle(40.5, 9, 4.5)} fill={M} />
  </Svg>
);

/* -------------------------------------------- pay, rewards, files and celebrations */

/** A five-point star centred on (x, y), outer radius r. */
function PayStar(x: number, y: number, r: number, inner = 0.47) {
  let d = "";
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    d += `${i === 0 ? "M" : "L"}${(x + rr * Math.cos(a)).toFixed(2)} ${(y + rr * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

/** A scalloped seal centred on (x, y): n small bumps round a circle of radius r. */
function PayRosette(x: number, y: number, r: number, n = 16) {
  const f = (v: number) => v.toFixed(2);
  const bump = f(r * Math.sin(Math.PI / n) * 1.08);
  const point = (i: number) => {
    const a = ((Math.PI * 2) / n) * i - Math.PI / 2;
    return `${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`;
  };
  let d = `M${point(0)}`;
  for (let i = 1; i <= n; i += 1) d += `A${bump} ${bump} 0 0 1 ${point(i % n)}`;
  return `${d}Z`;
}

/** One coin lying flat, seen from the side: face and edge as one shape; (cx, y) is the face's centre. */
function PayCoin(cx: number, y: number, rx = 12, ry = 4.2, t = 5) {
  return `M${cx - rx} ${y}v${t}a${rx} ${ry} 0 0 0 ${rx * 2} 0v-${t}a${rx} ${ry} 0 0 0-${rx * 2} 0z`;
}

/** A ribbon tail with a notched end, hanging from (0, 0); placed with a transform. */
const PayTail = "M0 0h6.2v11.5l-3.1-2.8L0 11.5z";

/** A bow's two loops, meeting at (24, 16). */
const PayBow =
  "M24 16c-2.5-6.5-7.5-11.5-11.5-10.5-3 .8-3.1 4.5-1 6.5 2.5 2.4 7.5 4 12.5 4zM24 16c2.5-6.5 7.5-11.5 11.5-10.5 3 .8 3.1 4.5 1 6.5-2.5 2.4-7.5 4-12.5 4z";

/** An open folder: the back with its tab, and the front flap leaning open. */
const PayFolderBack =
  "M4 11.5a3 3 0 0 1 3-3h9.6a3 3 0 0 1 2.3 1.1l2.6 3.4h19.5a3 3 0 0 1 3 3V40a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z";
const PayFolderFront =
  "M10.6 20.5h31.6a2 2 0 0 1 2 2.4l-3.4 18.2a2.4 2.4 0 0 1-2.4 1.9H6.2a2 2 0 0 1-2-2.4L8.3 22.3a2.3 2.3 0 0 1 2.3-1.8z";

/** Icing over a cake top 34 wide, dripping at six lengths. */
const PayIcing =
  "M7 24.5a3 3 0 0 1 3-3h28a3 3 0 0 1 3 3V27a2.833 2.833 0 0 1-5.667 0v3.2a2.833 2.833 0 0 1-5.666 0V27a2.833 2.833 0 0 1-5.667 0v2a2.833 2.833 0 0 1-5.667 0v-2a2.833 2.833 0 0 1-5.666 0v4a2.833 2.833 0 0 1-5.667 0z";
const PayFlame = "M24 3.5c2.3 2.7 3.4 4.5 3.4 6.1a3.4 3.4 0 0 1-6.8 0c0-1.6 1.1-3.4 3.4-6.1z";

/** Total rewards: a gift box, one red ribbon and bow, a gold knot. */
export const SpotGift: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <path d={PayBow} fill={R} />
    <rect x="8" y="24" width="32" height="19.5" rx="3" fill={D} />
    <rect x="5" y="16" width="38" height="9.5" rx="3" fill={D} {...cut} />
    <path d="M20.5 16h7v9.5h-7zM20.5 27h7v16.5h-7z" fill={R} />
    <circle cx="24" cy="15.6" r="3.2" fill={M} {...cut} />
  </Svg>
);

/** Form 16: a framed certificate with a red rosette seal (ticked: certified) on gold ribbon tails. */
export const SpotCertificate: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <rect x="3.5" y="7" width="38" height="28.5" rx="3" fill={D} />
    <rect x="7" y="10.5" width="31" height="21.5" rx="1.5" {...ln(P, 1.8)} />
    <rect x="12.5" y="14.5" width="20" height="3.2" rx="1.6" fill={W} />
    <Lines x={11} y={21.5} widths={[23, 13]} />
    <path transform="translate(29.2 32.2) rotate(16)" d={PayTail} fill={M} {...cut} />
    <path transform="translate(34.6 33.9) rotate(-16)" d={PayTail} fill={M} {...cut} />
    <path d={PayRosette(35, 30, 8)} fill={R} {...cut} />
    <path d="M31.3 30.2l2.6 2.6 4.6-5" {...ln(W, 2.5)} />
  </Svg>
);

/** Reward points: a stack of coins and a red star coin. */
export const SpotCoins: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <path d={PayCoin(18.5, 35)} fill={D} {...cut} />
    <path d={PayCoin(21.5, 29.5)} fill={D} {...cut} />
    <path d={PayCoin(16.5, 24)} fill={D} {...cut} />
    <path d={PayCoin(19.5, 18.5)} fill={D} {...cut} />
    <ellipse cx="19.5" cy="18.5" rx="9" ry="2.6" fill={P} />
    <circle cx="35" cy="33.5" r="9.5" fill={R} {...cut} />
    <path d={PayStar(35, 34.1, 5.4)} fill={W} stroke={W} strokeWidth={1} strokeLinejoin="round" />
    <path d={sparkle(40.5, 9.5, 4.5)} fill={M} />
  </Svg>
);

/** Flexi benefits: three sliders splitting an allowance (the rupee coin). */
export const SpotSliders: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <path d="M6 11h36M6 24h36M6 37h22" {...ln(P, 4.5)} />
    <path d="M6 11h22M6 24h12" {...ln(D, 4.5)} />
    <circle cx="28" cy="11" r="7" fill={D} {...cut} />
    <circle cx="18" cy="24" r="7" fill={R} {...cut} />
    <circle cx="10.5" cy="37" r="7" fill={D} {...cut} />
    <circle cx="36.5" cy="36.5" r="8" fill={M} {...cut} />
    <Rupee x={36.8} y={36.5} s={0.94} color={D} />
  </Svg>
);

/** Documents: an open folder, a red file and a cream page fanned out of it. */
export const SpotFolder: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <path d={PayFolderBack} fill={D} />
    <rect x="12.5" y="8" width="19.5" height="21" rx="2" fill={R} transform="rotate(-7 22 18.5)" {...cut} />
    <g transform="rotate(6 29 17)">
      <rect x="19" y="6.5" width="19.5" height="21" rx="2" fill={W} {...cut} />
      <Lines x={23} y={11} widths={[11, 7.5]} color={D} h={2.2} gap={4.5} />
    </g>
    <path d={PayFolderFront} fill={D} {...cut} />
  </Svg>
);

/** Celebrations: an iced cake on a plate, one red candle. */
export const SpotCake: SpotIcon = ({ className }) => (
  <Svg className={className}>
    <rect x="21.5" y="13.5" width="5" height="10" rx="1.5" fill={R} />
    <rect x="3.5" y="38" width="41" height="5.5" rx="2.75" fill={P} />
    <rect x="7" y="21.5" width="34" height="18" rx="3" fill={D} {...cut} />
    <path d={PayIcing} fill={P} />
    {[16.7, 24, 31.3].map((x) => (
      <circle key={x} cx={x} cy="35.6" r="1.6" fill={W} />
    ))}
    <path d={PayFlame} fill={M} />
    <path d={sparkle(39.5, 10, 4)} fill={M} />
  </Svg>
);
