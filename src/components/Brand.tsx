/**
 * The AskMiraa brand, from the brand kit (assets/brand, rendered from the same
 * vectors as the web portal's logo).
 *
 * One logo works on every surface: the red "Ask" bubble and the marigold
 * "Miraa" read on cream, white and the ink sign-in screen alike.
 */

import { Image } from 'expo-image';

import { t } from '../lib/i18n';
import { layout } from '../theme/tokens';

const LOGO = require('../../assets/brand/logo.png');
const MARK = require('../../assets/brand/mark.png');

/** The logo's width over its height (1150 × 340 in the brand file). */
const LOGO_RATIO = 1150 / 340;
/** The mark's width over its height (125 × 141). */
const MARK_RATIO = 125 / 141;

/** The full "Ask Miraa" logo, `height` tall. */
export function BrandLogo({ height = layout.avatarLg }: { height?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ height, width: Math.round(height * LOGO_RATIO) }}
      contentFit="contain"
      accessibilityLabel={t('AskMiraa')}
      accessibilityRole="image"
    />
  );
}

/** The icon mark — the red bubble with an "A". Decorative: Ask Miraa's avatar. */
export function BrandMark({ height = layout.avatarSm }: { height?: number }) {
  return (
    <Image
      source={MARK}
      style={{ height, width: Math.round(height * MARK_RATIO) }}
      contentFit="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
