/**
 * "Ask Miraa about this" on a payslip, a leave balance or a policy. Opens the
 * chat with a question written for the screen. It only fills the box; the
 * person reads it and presses Send.
 */

import { Sparkles } from 'lucide-react-native';

import { t } from '../../lib/i18n';
import { useGo } from '../../navigation/navigate';
import { Chip } from '../Badge';

export function AskMiraChip({ question }: { question: string }) {
  const go = useGo();
  return <Chip label={t('Ask Miraa about this')} icon={Sparkles} onPress={() => go('AskMira', { prefill: question, fresh: '1' })} />;
}
