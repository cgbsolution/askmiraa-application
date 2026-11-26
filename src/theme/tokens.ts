/**
 * AskMiraa design tokens — FRD 5.13, aligned with the web portal.
 *
 * The portal (frontend/src/app/globals.css) is the reference: Maroon
 * grounding (the website hero, #7D0712), Marigold accent, on Cream, with warm
 * Ink text. The nav rail is the hero's maroon gradient with a Marigold chip on
 * the active item; on the phone that is the tab bar. The bright logo red stays
 * inside the logo artwork only — never a UI colour (the user's call,
 * 2026-10-28: a bright or light red stings on screen).
 *
 * Defined once, here. No other file contains a colour literal; a test greps
 * every folder for violations. That is what makes a reskin a change to this
 * file rather than an archaeology exercise across a hundred screens.
 *
 * The Tier 1 / Tier 2 split is expressed as two surface styles rather than
 * left to each screen's judgement:
 *
 *   Tier 1 — payslips, tax declarations, attendance records, approvals.
 *            Flat, plain, dense Inter. A mistake here costs money.
 *   Tier 2 — Home, Ask Miraa, shoutouts, clubs, profile, onboarding.
 *            Rounder, blush borders, Fraunces headlines.
 *
 * Spacing is one scale plus a handful of layout roles (screen gutter, gap
 * between sections, card padding, gap between rows). Screens use the roles,
 * never raw numbers — a test fails any literal padding, margin or gap in a
 * screen or component — so the space around things cannot drift screen to
 * screen.
 */

export const palette = {
  // Maroon — the website hero and the portal's nav rail. Primary buttons,
  // links, selection. Tints are muted rose-beige, never pink.
  maroon25: '#fbf7f6',
  maroon50: '#f6eceb',
  maroon100: '#eedcda',
  maroon200: '#ddbcb9',
  maroon300: '#c4908c',
  maroon400: '#a3585b',
  maroon500: '#8a2128',
  maroon600: '#7d0712',
  maroon700: '#6b0710',
  maroon800: '#5c0a11',
  maroon900: '#48080e',
  maroon950: '#34040a',
  // Maroon lifted so it stands off a near-black card (the portal's dark primary).
  maroonNight: '#9e2630',

  // The rail's gradient and its quiet text (globals.css --sidebar-*).
  railTop: '#6b0a13',
  railBottom: '#34040a',
  railMuted: '#d6bcba',
  railPressed: '#74161e',
  railBorder: '#6e1219',
  railNightTop: '#48080e',
  railNightBottom: '#1c0306',
  railNightMuted: '#c9aeac',
  railNightBorder: '#4a0d14',

  // AskMiraa Red — the logo's "Ask" bubble. Inside the logo artwork, and as the
  // one accent of the spot illustrations (spotInk below), as on the website.
  logoRed: '#eb061d',
  // The spot illustrations' soft second layer (the website's brand-200).
  // Artwork only, never a fill or a tint in the interface.
  spotPink: '#ffabb3',

  // Blush — a warm peach between the maroon and the cream. Soft Tier 2 fills, icon chips.
  blush500: '#d9805f',
  blush400: '#e8a283',
  blush300: '#f2c2a9',
  blush200: '#f9d8c7',
  blush100: '#fde8dd',
  blush50: '#fff4ee',

  // Marigold — the logo's "Miraa". The one page CTA, the active tab chip, the Miraa button.
  marigold800: '#8f4e0f',
  marigold700: '#b8650a',
  marigold600: '#df840b',
  marigold500: '#f8a01a',
  marigold400: '#fab236',
  marigold300: '#fcc45c',
  marigold100: '#feebc4',
  marigold50: '#fff5e3',

  // Cream — the logo's tile. Backgrounds.
  cream300: '#e3cfc1',
  cream200: '#f0e2d8',
  cream100: '#f9efe8',
  cream50: '#fef8f4',
  cream25: '#fffdfb',

  // Ink — a warm near-black. Text.
  ink950: '#100404',
  ink900: '#1a1110',
  ink700: '#372d2a',
  ink500: '#645853',
  ink400: '#7a6e68',
  ink300: '#a89c98',
  ink200: '#ccc3c0',

  // Night — the dark theme's surfaces, the same warm near-black as the portal.
  night950: '#0d0706',
  night900: '#120b0a',
  night800: '#1e1514',
  night700: '#271e1c',
  night600: '#332825',
  night500: '#463936',
  nightRose: '#3a2420',
  mist100: '#f3f0ef',
  mist300: '#ccc3c0',
  mist500: '#a89c98',

  white: '#ffffff',
  black: '#000000',

  // Darker and browner than the maroon, so "danger" never reads as "primary".
  danger: '#b42318',
  danger300: '#f0645a',
  danger50: '#fbeae8',
  dangerNight: '#3a1715',
  success: '#2e7d5b',
  success300: '#5cb98d',
  success50: '#e5f3ec',
  successNight: '#12301f',
  warning: '#8f4e0f',
  warning50: '#fff5e3',
  warningNight: '#33270f',
  info: '#2d6a8a',
  info300: '#6fa8c8',
  info50: '#e6f1f7',
  infoNight: '#11283a',
  violet: '#6b5ba8',
  violet50: '#eeebf7',
  violetNight: '#241f3a',

  // Attendance calendar day tags: solid fills, each deep (or light) enough
  // for the date on it. Absent is a muted terracotta, never a light red.
  dayGreen: '#238640',
  dayTerracotta: '#cc4a3a',
  dayInk: '#2a1f1e',
  dayInkNight: '#463a37',
  dayYellow: '#f9e27d',
  dayPeriwinkle: '#6363d4',
  dayBrown: '#9a4a1c',
  dayGrey: '#78736f',
  dayGreyNight: '#9a9490',

  scrimLight: '#1a111066',
  scrimDark: '#00000099',
  shimmerLight: '#f3e9e2',
  shimmerDark: '#2a201e',
} as const;

/**
 * The spot illustrations' tones (components/Spot.tsx): the website's own
 * (website/src/app/globals.css, `.spot`), so the app's icons are the
 * website's icons. d is the main mass, r one accent, p the second layer, m a
 * small highlight, w details cut into dark shapes. Artwork, like the logo —
 * never a button, text or background colour.
 */
export const spotInk = {
  d: palette.maroon800,
  r: palette.logoRed,
  p: palette.spotPink,
  m: palette.marigold400,
  w: palette.cream25,
} as const;

/**
 * The tiles a spot sits on, as on the website (SpotTile). The tile is always
 * light, in the dark theme too (the website sets them on its dark bands the
 * same way); its colour is also the colour of the spot's cuts.
 */
export const spotTiles = {
  blush: palette.blush100,
  marigold: palette.marigold100,
  cream: palette.cream100,
  white: palette.white,
} as const;

export type SpotTone = keyof typeof spotTiles;

/**
 * Semantic colours. The light and dark sets share every name; a screen asks
 * for `colors.surface`, never for a palette entry, so dark mode is a change of
 * set rather than a change of screen.
 */
export interface Colors {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderStrong: string;
  divider: string;

  primary: string;
  onPrimary: string;
  primarySoft: string;
  primaryText: string;
  /** Pressed state of a primary button (the portal's brand-700 hover). */
  primaryPressed: string;

  accent: string;
  onAccent: string;
  accentSoft: string;
  accentText: string;

  /** The warm Tier 2 fill for a hero or an inset panel. */
  soft: string;
  softBorder: string;
  /** The rounded square behind a menu or row icon (the portal's stat-tile chip). */
  iconChip: string;
  onIconChip: string;
  /** Behind the company's logo on Home: always light, as logos are drawn for white. */
  logoPlate: string;
  /** The company's name on that plate when it has no logo. */
  onLogoPlate: string;

  /** The maroon surfaces behind the logo: splash, sign-in, lock. A gradient, top to bottom. */
  brandSurface: string;
  brandSurfaceTop: string;
  brandSurfaceBottom: string;
  onBrandSurface: string;
  onBrandSurfaceMuted: string;
  /** A pressed or raised element on a brand surface. */
  brandSurfaceRaised: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  neutralSoft: string;

  /** The tab bar is the portal's nav rail: the maroon gradient. */
  tabBar: string;
  tabBarTop: string;
  tabBarBottom: string;
  tabBarBorder: string;
  /** The chip behind the active tab's icon, and the icon on it. */
  tabBarActive: string;
  tabBarActiveText: string;
  /** The active tab's label. */
  tabBarActiveLabel: string;
  tabBarInactive: string;
  header: string;
  onHeader: string;

  segmentedTrack: string;
  segmentedActive: string;
  onSegmentedActive: string;
  segmentedText: string;

  bubbleUser: string;
  onBubbleUser: string;
  bubbleMira: string;
  bubbleMiraBorder: string;
  miraRing: string;
  miraGlow: string;

  scrim: string;
  skeleton: string;
  skeletonHighlight: string;
  shadow: string;
  /** A switch's knob, on and off, and its track when off: visible on both themes. */
  switchThumbOn: string;
  switchThumbOff: string;
  switchTrackOff: string;

  // Attendance calendar: a fill and the date on it for each of the eight
  // day tags (core/home.ts DAY_TAG_ORDER), and the month band.
  dayFull: string;
  onDayFull: string;
  dayPartial: string;
  onDayPartial: string;
  dayAbsent: string;
  onDayAbsent: string;
  dayWeekOff: string;
  onDayWeekOff: string;
  dayHoliday: string;
  onDayHoliday: string;
  dayOptionalHoliday: string;
  onDayOptionalHoliday: string;
  dayApprovedLeave: string;
  onDayApprovedLeave: string;
  dayUnapprovedLeave: string;
  onDayUnapprovedLeave: string;
  calendarBand: string;
  onCalendarBand: string;
  /** The ring round the selected day and the dot under today. */
  calendarMark: string;

  /** Chart series, in order (the portal's --chart-1…5). */
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  /** The empty part of a bar, ring or progress track. */
  chartTrack: string;
}

export const lightColors: Colors = {
  background: palette.cream50,
  surface: palette.white,
  surfaceRaised: palette.cream25,
  surfaceSunken: palette.cream100,
  text: palette.ink900,
  textMuted: palette.ink500,
  textSubtle: palette.ink400,
  border: palette.cream200,
  borderStrong: palette.ink200,
  divider: palette.cream100,

  primary: palette.maroon600,
  onPrimary: palette.white,
  primarySoft: palette.maroon50,
  primaryText: palette.maroon600,
  primaryPressed: palette.maroon700,

  accent: palette.marigold500,
  onAccent: palette.ink950,
  accentSoft: palette.marigold50,
  accentText: palette.marigold800,

  soft: palette.blush50,
  softBorder: palette.blush200,
  iconChip: palette.blush100,
  onIconChip: palette.maroon600,
  logoPlate: palette.white,
  onLogoPlate: palette.maroon600,

  brandSurface: palette.maroon800,
  brandSurfaceTop: palette.railTop,
  brandSurfaceBottom: palette.railBottom,
  onBrandSurface: palette.white,
  onBrandSurfaceMuted: palette.railMuted,
  brandSurfaceRaised: palette.railPressed,

  success: palette.success,
  successSoft: palette.success50,
  warning: palette.warning,
  warningSoft: palette.warning50,
  danger: palette.danger,
  dangerSoft: palette.danger50,
  info: palette.info,
  infoSoft: palette.info50,
  neutralSoft: palette.cream100,

  tabBar: palette.maroon800,
  tabBarTop: palette.railTop,
  tabBarBottom: palette.railBottom,
  tabBarBorder: palette.railBorder,
  tabBarActive: palette.marigold500,
  tabBarActiveText: palette.ink950,
  tabBarActiveLabel: palette.white,
  tabBarInactive: palette.railMuted,
  header: palette.cream50,
  onHeader: palette.ink900,

  segmentedTrack: palette.blush100,
  segmentedActive: palette.maroon600,
  onSegmentedActive: palette.white,
  segmentedText: palette.ink700,

  bubbleUser: palette.maroon600,
  onBubbleUser: palette.white,
  bubbleMira: palette.white,
  bubbleMiraBorder: palette.blush200,
  miraRing: palette.railTop,
  miraGlow: palette.marigold300,

  scrim: palette.scrimLight,
  skeleton: palette.cream100,
  skeletonHighlight: palette.shimmerLight,
  shadow: palette.ink950,
  switchThumbOn: palette.white,
  switchThumbOff: palette.white,
  switchTrackOff: palette.ink200,

  dayFull: palette.dayGreen,
  onDayFull: palette.white,
  dayPartial: palette.marigold500,
  onDayPartial: palette.ink950,
  dayAbsent: palette.dayTerracotta,
  onDayAbsent: palette.white,
  dayWeekOff: palette.dayInk,
  onDayWeekOff: palette.white,
  dayHoliday: palette.dayPeriwinkle,
  onDayHoliday: palette.white,
  dayOptionalHoliday: palette.dayBrown,
  onDayOptionalHoliday: palette.white,
  dayApprovedLeave: palette.dayGrey,
  onDayApprovedLeave: palette.white,
  dayUnapprovedLeave: palette.dayYellow,
  onDayUnapprovedLeave: palette.ink950,
  calendarBand: palette.maroon600,
  onCalendarBand: palette.white,
  calendarMark: palette.maroon600,

  chart1: palette.maroon600,
  chart2: palette.marigold500,
  chart3: palette.ink500,
  chart4: palette.info,
  chart5: palette.marigold800,
  chartTrack: palette.maroon100,
};

export const darkColors: Colors = {
  background: palette.night900,
  surface: palette.night800,
  surfaceRaised: palette.night700,
  surfaceSunken: palette.night950,
  text: palette.mist100,
  textMuted: palette.mist300,
  textSubtle: palette.mist500,
  border: palette.night600,
  borderStrong: palette.night500,
  divider: palette.night700,

  // The portal's dark primary: maroon lifted, white label. Never a light red.
  primary: palette.maroonNight,
  onPrimary: palette.white,
  primarySoft: palette.nightRose,
  primaryText: palette.maroon200,
  primaryPressed: palette.maroon500,

  accent: palette.marigold400,
  onAccent: palette.ink950,
  accentSoft: palette.warningNight,
  accentText: palette.marigold300,

  soft: palette.night700,
  softBorder: palette.night500,
  iconChip: palette.nightRose,
  onIconChip: palette.maroon200,
  // A light plate in the dark too (a dark logo vanishes on a dark card), dimmed from white.
  logoPlate: palette.cream100,
  onLogoPlate: palette.maroon600,

  brandSurface: palette.maroon950,
  brandSurfaceTop: palette.railNightTop,
  brandSurfaceBottom: palette.railNightBottom,
  onBrandSurface: palette.mist100,
  onBrandSurfaceMuted: palette.railNightMuted,
  brandSurfaceRaised: palette.maroon900,

  success: palette.success300,
  successSoft: palette.successNight,
  warning: palette.marigold300,
  warningSoft: palette.warningNight,
  danger: palette.danger300,
  dangerSoft: palette.dangerNight,
  info: palette.info300,
  infoSoft: palette.infoNight,
  neutralSoft: palette.night700,

  tabBar: palette.maroon950,
  tabBarTop: palette.railNightTop,
  tabBarBottom: palette.railNightBottom,
  tabBarBorder: palette.railNightBorder,
  tabBarActive: palette.marigold500,
  tabBarActiveText: palette.ink950,
  tabBarActiveLabel: palette.mist100,
  tabBarInactive: palette.railNightMuted,
  header: palette.night900,
  onHeader: palette.mist100,

  segmentedTrack: palette.night700,
  segmentedActive: palette.maroonNight,
  onSegmentedActive: palette.white,
  segmentedText: palette.mist300,

  bubbleUser: palette.maroonNight,
  onBubbleUser: palette.white,
  bubbleMira: palette.night800,
  bubbleMiraBorder: palette.night500,
  miraRing: palette.railNightTop,
  miraGlow: palette.marigold300,

  scrim: palette.scrimDark,
  skeleton: palette.night700,
  skeletonHighlight: palette.shimmerDark,
  shadow: palette.black,
  switchThumbOn: palette.mist100,
  switchThumbOff: palette.mist300,
  switchTrackOff: palette.night500,

  dayFull: palette.dayGreen,
  onDayFull: palette.white,
  dayPartial: palette.marigold500,
  onDayPartial: palette.ink950,
  dayAbsent: palette.dayTerracotta,
  onDayAbsent: palette.white,
  // Lifted off the near-black card; grey goes light with a dark date.
  dayWeekOff: palette.dayInkNight,
  onDayWeekOff: palette.white,
  dayHoliday: palette.dayPeriwinkle,
  onDayHoliday: palette.white,
  dayOptionalHoliday: palette.dayBrown,
  onDayOptionalHoliday: palette.white,
  dayApprovedLeave: palette.dayGreyNight,
  onDayApprovedLeave: palette.ink950,
  dayUnapprovedLeave: palette.dayYellow,
  onDayUnapprovedLeave: palette.ink950,
  calendarBand: palette.maroon800,
  onCalendarBand: palette.white,
  calendarMark: palette.mist100,

  chart1: palette.maroon300,
  chart2: palette.marigold400,
  chart3: palette.mist300,
  chart4: palette.info300,
  chart5: palette.blush400,
  chartTrack: palette.night600,
};

/** The light set under its historical name, for code that predates dark mode. */
export const semantic = lightColors;

/** One spacing scale, on a 4-point grid. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Layout roles. Screens and components space things with these names, so
 * every screen has the same gutter, every card the same padding and every
 * list the same rhythm: row gap < group gap < section gap.
 */
export const layout = {
  /** Left and right edge of every screen. */
  gutter: spacing.lg,
  /** Between sections of a screen. */
  section: spacing.xl,
  /** Inside a card. */
  card: spacing.lg,
  /** Inside a Tier 2 hero card. */
  cardRoomy: spacing.xl,
  /** Between rows or fields in a group. */
  row: spacing.md,
  /** Between an icon and its text, or two chips. */
  inline: spacing.sm,
  /** Between a label and its value. */
  tight: spacing.xs,
  /** Minimum height of a tappable list row. */
  rowHeight: 56,
  /** Minimum touch target (Android 48dp, iOS 44pt — the larger wins). */
  touch: 48,
  /** A text field or select: a little taller than the touch minimum. */
  field: 52,
  /** A small button: still 48dp to touch, through its hit slop. */
  controlSmall: 36,
  /** The Ask Miraa centre button. */
  mira: 60,
  /** How far the Miraa button floats above the tab bar. */
  miraLift: 16,
  /** Tab bar height, excluding the bottom safe area. */
  tabBar: 66,
  /** The top bar of a tab's root screen. */
  appBar: 56,
  /** Icon sizes. */
  iconSm: 16,
  icon: 20,
  iconLg: 24,
  iconXl: 32,
  /** Leading icon tile in a list row. */
  iconTile: 40,
  /** A service tile's icon chip on Home and in All services. */
  serviceChip: 52,
  /** Spot tiles (components/Spot.tsx): a list row's, a service's, an empty state's, a hero's. */
  spotSm: 40,
  spotMd: 48,
  spotLg: 64,
  spotXl: 88,
  /** A floating action button. */
  fab: 56,
  avatarSm: 32,
  avatar: 40,
  avatarLg: 72,
  avatarXl: 96,
  hairline: 1,
  /** Widest a line of reading text should run on a tablet. */
  readingWidth: 640,
} as const;

/**
 * Radii carry the tier distinction, at the portal's sizes: a Tier 1 card is
 * the portal's `card-tier1` (14px), a Tier 2 card its `card-tier2` (20px).
 */
export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  control: 12,
  tier1: 14,
  lg: 16,
  tier2: 22,
  xl: 28,
  pill: 999,
} as const;

/**
 * Font families. Each weight is its own family on Android (fontWeight is
 * ignored for custom fonts there), so weight is chosen by family name.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'Fraunces_600SemiBold',
  displayRegular: 'Fraunces_400Regular',
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

/**
 * The type ramp. Fraunces for the warm, human moments — the greeting, the
 * clock, a hero figure — as on the portal; Inter for everything else,
 * including Tier 1 headings: precision over personality.
 */
export const typography = {
  display: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  displayMedium: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  displaySmall: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  /** The live clock on the punch card and screen. */
  clock: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  callout: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  calloutStrong: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  /** A small uppercase line over a heading: "WEDNESDAY, 28 OCTOBER". */
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  stat: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  statSmall: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  buttonSmall: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  tab: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
  tabActive: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  // Historical names, kept so older call sites read the same scale.
  displayLarge: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  headingTier1: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typography;

/**
 * How far each variant may grow with the OS text-size setting. Body text
 * grows the most; chrome (tabs, buttons) the least, so a large setting does
 * not break the layout.
 */
export const fontScaleCap: Record<TypeVariant, number> = {
  display: 1.3,
  displayMedium: 1.4,
  displaySmall: 1.5,
  clock: 1.2,
  title: 1.4,
  headline: 1.6,
  body: 2,
  bodyStrong: 2,
  callout: 1.8,
  calloutStrong: 1.8,
  caption: 1.6,
  label: 1.5,
  overline: 1.4,
  stat: 1.3,
  statSmall: 1.4,
  button: 1.4,
  buttonSmall: 1.3,
  tab: 1.2,
  tabActive: 1.2,
  displayLarge: 1.3,
  bodySmall: 1.8,
  headingTier1: 1.5,
};

/** Durations, so animations across the app feel related. */
export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  /** The Miraa button's breathing glow, one full cycle. */
  breathe: 2500,
  /** The splash: the mark settles, then the wordmark follows. */
  splash: 650,
} as const;

/** Elevation, two levels. Hierarchy comes from type and grouping, not shadow. */
export const elevation = {
  card: { shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  raised: { shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
} as const;

export type Tier = 'tier1' | 'tier2';

export interface SurfaceStyle {
  backgroundColor: string;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  padding: number;
  /** Tier 2 permits illustration; Tier 1 does not. */
  allowsIllustration: boolean;
  shadowOpacity: number;
}

/**
 * The surface style for a tier.
 *
 * Screens call this (through `Card`) instead of choosing radii and fills
 * themselves, which is what keeps the split from eroding one pull request at
 * a time.
 */
export function surface(tier: Tier, colors: Colors = lightColors): SurfaceStyle {
  if (tier === 'tier1') {
    return {
      backgroundColor: colors.surface,
      borderRadius: radius.tier1,
      borderWidth: 1,
      borderColor: colors.border,
      padding: layout.card,
      allowsIllustration: false,
      shadowOpacity: 0.03,
    };
  }
  return {
    backgroundColor: colors.surface,
    borderRadius: radius.tier2,
    borderWidth: 1,
    borderColor: colors.softBorder,
    padding: layout.cardRoomy,
    allowsIllustration: true,
    shadowOpacity: 0.08,
  };
}

/**
 * Which tier a screen belongs to.
 *
 * The rule from FRD 5.13: if a mistake on the screen costs money or triggers a
 * statutory filing, it is Tier 1. If it is about people connecting with
 * people, it is Tier 2.
 */
export const SCREEN_TIERS = {
  Today: 'tier2',
  Home: 'tier2',
  AskMira: 'tier2',
  Recognition: 'tier2',
  Clubs: 'tier2',
  Profile: 'tier2',
  Onboarding: 'tier2',
  Culture: 'tier2',
  Growth: 'tier2',

  Payslips: 'tier1',
  PayslipDetail: 'tier1',
  Salary: 'tier1',
  TaxDeclarations: 'tier1',
  Attendance: 'tier1',
  AttendanceDetail: 'tier1',
  Punch: 'tier1',
  YourVoice: 'tier1',
  Approvals: 'tier1',
  Inbox: 'tier1',
  Leave: 'tier1',
  Expenses: 'tier1',
  Loans: 'tier1',
  Timesheet: 'tier1',
} as const satisfies Record<string, Tier>;

export type ScreenName = keyof typeof SCREEN_TIERS;

export function tierFor(screen: ScreenName): Tier {
  return SCREEN_TIERS[screen];
}
