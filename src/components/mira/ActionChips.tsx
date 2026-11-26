/**
 * "Apply leave →" under a reply: opens the normal form, pre-filled. Never
 * submits anything (see core/intents.ts).
 */

import { StyleSheet, View } from 'react-native';

import type { FeatureKey } from '../../core/access';
import { todayISO } from '../../core/dates';
import { matchIntents, type IntentKey } from '../../core/intents';
import type { CompanionMessage } from '../../core/types';
import { t } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useGo } from '../../navigation/navigate';
import { spacing } from '../../theme/tokens';
import { Chip } from '../Badge';

const NEEDS: Record<IntentKey, FeatureKey> = {
  apply_leave: 'leave',
  regularise: 'attendance',
  new_expense: 'expenses',
  raise_ticket: 'helpdesk',
  payslip: 'payslips',
  form16: 'tax',
  tax_declaration: 'tax',
  give_shoutout: 'culture',
};

export function ActionChips({ message, previous }: { message: CompanionMessage; previous: string }) {
  const go = useGo();
  const { can } = useSession();
  const intents = matchIntents(previous, message.text, todayISO()).filter((intent) => can(NEEDS[intent.key]));
  if (!intents.length) return null;
  return (
    <View style={styles.row}>
      {intents.map((intent) => (
        <Chip
          key={intent.key}
          label={`${t(intent.label)} →`}
          onPress={() => go(intent.route, { ...intent.params, fromMira: '1' })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
