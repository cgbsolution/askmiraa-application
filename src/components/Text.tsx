/**
 * Text, through the type ramp only.
 *
 * Screens never set a font size: they pick a variant (`body`, `headline`,
 * `display`…) and a tone (`muted`, `danger`…). Each variant carries its own
 * cap on how far the OS text-size setting may grow it, so a large setting is
 * honoured without breaking the layout.
 */

import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle, type StyleProp } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { fontScaleCap, typography, type Colors, type TypeVariant } from '../theme/tokens';

export type TextTone =
  | 'default'
  | 'muted'
  | 'subtle'
  | 'primary'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info'
  | 'onPrimary'
  | 'onAccent'
  | 'onHeader';

export function toneColor(colors: Colors, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return colors.textMuted;
    case 'subtle':
      return colors.textSubtle;
    case 'primary':
      return colors.primaryText;
    case 'accent':
      return colors.accentText;
    case 'danger':
      return colors.danger;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'info':
      return colors.info;
    case 'onPrimary':
      return colors.onPrimary;
    case 'onAccent':
      return colors.onAccent;
    case 'onHeader':
      return colors.onHeader;
    default:
      return colors.text;
  }
}

export interface TxtProps extends Omit<TextProps, 'style'> {
  variant?: TypeVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  /** Tabular figures, for amounts and times that should line up. */
  numeric?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

export function Txt({ variant = 'body', tone = 'default', align, numeric, style, children, ...rest }: TxtProps) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={fontScaleCap[variant]}
      {...rest}
      style={[
        typography[variant],
        { color: toneColor(colors, tone) },
        align ? { textAlign: align } : null,
        numeric ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
