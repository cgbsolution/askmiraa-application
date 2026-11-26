/**
 * Attach a file: camera, photos or the file picker. The limits are said
 * before the person picks, and the chosen file shows with its name and a way
 * to remove it.
 */

import { Camera, FileUp, Image as ImageIcon, Paperclip, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { UploadFile } from '../lib/api';
import { chooseDocument, choosePhoto, describeLimits, takePhoto, type FileRules, DEFAULT_RULES } from '../lib/files';
import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, radius, spacing } from '../theme/tokens';
import { Button } from './Button';
import { Txt } from './Text';

export function AttachField({
  label,
  value,
  onChange,
  rules = DEFAULT_RULES,
  required,
  error,
  camera = true,
}: {
  label: string;
  value: UploadFile | null;
  onChange: (file: UploadFile | null) => void;
  rules?: FileRules;
  required?: boolean;
  error?: string | null;
  camera?: boolean;
}) {
  const { colors } = useTheme();
  const images = rules.types.some((type) => type.startsWith('image/'));
  return (
    <View style={styles.field}>
      <Txt variant="label" tone="muted">
        {label}
        {required ? ' *' : ''}
      </Txt>
      {value ? (
        <View style={[styles.file, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Paperclip size={layout.iconSm} color={colors.textMuted} />
          <Txt variant="callout" numberOfLines={1} style={styles.flex}>
            {value.name}
          </Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Remove {name}', { name: value.name })} onPress={() => onChange(null)} hitSlop={spacing.md}>
            <X size={layout.icon} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.buttons}>
          {camera && images ? (
            <Button label={t('Camera')} icon={Camera} variant="secondary" size="sm" onPress={() => void takePhoto(rules).then((f) => f && onChange(f))} />
          ) : null}
          {images ? (
            <Button label={t('Photos')} icon={ImageIcon} variant="secondary" size="sm" onPress={() => void choosePhoto(rules).then((f) => f && onChange(f))} />
          ) : null}
          <Button label={t('Files')} icon={FileUp} variant="secondary" size="sm" onPress={() => void chooseDocument(rules).then((f) => f && onChange(f))} />
        </View>
      )}
      <Txt variant="caption" tone={error ? 'danger' : 'subtle'}>
        {error ?? describeLimits(rules)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: layout.tight },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touch,
    paddingHorizontal: spacing.md,
    borderWidth: layout.hairline,
    borderRadius: radius.tier1,
  },
  flex: { flex: 1 },
});
