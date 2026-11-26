/**
 * The frame of a page pushed over the tabs (the Inbox, an approval): a back
 * arrow, the title and the page's own actions, drawn here rather than by the
 * native stack header. On Android 8–14 the native header left such a page
 * laid out taller than the window, which pushed its bottom bar (Select all ·
 * Bulk action) off the screen; modals avoid it the same way (ModalShell).
 *
 * A page puts its actions in the header with `usePageActions(<IconButton …/>)`.
 */

import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../lib/i18n';
import { useTheme } from '../theme/ThemeProvider';
import { layout, spacing } from '../theme/tokens';
import { IconButton } from './Button';
import { Txt } from './Text';

const PageActionsContext = createContext<(node: ReactNode) => void>(() => {});

/** Show `node` at the right of the page's header while the page is mounted. */
export function usePageActions(node: ReactNode, deps: unknown[]): void {
  const set = useContext(PageActionsContext);
  useEffect(() => {
    set(node);
    return () => set(null);
    // The caller lists what the node depends on, as with useMemo.
  }, deps);
}

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [actions, setActions] = useState<ReactNode>(null);
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.header }]}>
        <IconButton icon={ArrowLeft} label={t('Back')} onPress={() => navigation.goBack()} />
        <Txt variant="headline" numberOfLines={1} style={styles.flex} accessibilityRole="header">
          {title}
        </Txt>
        {actions}
      </View>
      <PageActionsContext.Provider value={setActions}>
        <View style={styles.flex}>{children}</View>
      </PageActionsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, minHeight: layout.appBar },
});
