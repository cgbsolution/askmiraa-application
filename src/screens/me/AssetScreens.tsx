/**
 * My assets: what I hold (acknowledge receipt), what I have asked for, and
 * asking for something new. Returns are recorded by whoever takes the item
 * back, so the app says so rather than offering a button that cannot work.
 *
 * When CGB Helpdesk is linked, assets live there and this opens it instead.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { assetsApi } from '../../api/assets';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField, SelectField, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { ProductLauncher } from '../../components/ProductLauncher';
import { Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { addDays, formatDate, todayISO } from '../../core/dates';
import { statusLabel } from '../../core/status';
import type { AssetRequestRead, AssetsAssignmentRead } from '../../core/types';
import { t } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useAction } from '../../lib/useAction';
import { useGo } from '../../navigation/navigate';
import { spacing } from '../../theme/tokens';

export function AssetsScreen() {
  const go = useGo();
  const { linked } = useSession();
  const isLinked = linked('assets');
  const mine = useQuery({ queryKey: ['assets', 'mine'], queryFn: assetsApi.mine, enabled: !isLinked });
  const requests = useQuery({ queryKey: ['assets', 'requests'], queryFn: assetsApi.requests, enabled: !isLinked });
  const [acknowledging, setAcknowledging] = useState<AssetsAssignmentRead | null>(null);
  const [cancelling, setCancelling] = useState<AssetRequestRead | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const acknowledge = useAction((id: string) => assetsApi.acknowledge(id), { success: t('Thanks — receipt recorded'), invalidate: [['assets'], ['dashboard']] });
  const cancel = useAction((id: string) => assetsApi.cancelRequest(id), { success: t('Request withdrawn'), invalidate: [['assets']] });

  if (isLinked) {
    return (
      <Screen>
        <ProductLauncher product="helpdesk" what={t('Your assets')} />
      </Screen>
    );
  }

  const openRequests = (requests.data ?? []).filter((r) => r.status === 'pending' || r.status === 'approved');
  const pastRequests = (requests.data ?? []).filter((r) => r.status !== 'pending' && r.status !== 'approved');

  return (
    <Screen onRefresh={() => Promise.all([mine.refetch(), requests.refetch()])}>
      <Button label={t('Request an asset')} icon={Plus} variant="accent" onPress={() => go('RequestAsset')} fullWidth />

      <Section title={t('With you now')}>
        <QueryView
          query={mine}
          skeleton={<SkeletonCard lines={4} />}
          isEmpty={(d) => d.current.length === 0}
          empty={<EmptyState inline spot="laptop" title={t('Nothing assigned to you')} message={t('Laptops, phones, ID cards and the like show here once IT or HR hands them over.')} />}
        >
          {(data) => (
            <Stack gap="row">
              {data.current.map((a) => (
                <Card key={a.id}>
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="headline" style={styles.flex}>
                        {a.asset_name}
                      </Txt>
                      {a.is_overdue ? <Badge label={t('Return overdue')} tone="danger" /> : null}
                    </View>
                    <Txt variant="caption" tone="muted">
                      {[a.category_name, a.asset_tag, a.serial_number ? t('S/N {serial}', { serial: a.serial_number }) : null].filter(Boolean).join(' · ')}
                    </Txt>
                    <KeyValue label={t('Given to you')} value={formatDate(a.assigned_at)} />
                    {a.expected_return_date ? <KeyValue label={t('Return by')} value={formatDate(a.expected_return_date)} tone={a.is_overdue ? 'danger' : 'default'} /> : null}
                    <KeyValue label={t('Condition')} value={t(statusLabel(a.condition_out))} />
                    {a.assignment_notes ? (
                      <Txt variant="callout" tone="muted">
                        {a.assignment_notes}
                      </Txt>
                    ) : null}
                    {a.requires_acknowledgement && !a.acknowledged_at ? (
                      <Button label={t('I have received it')} size="sm" variant="primary" onPress={() => setAcknowledging(a)} />
                    ) : a.acknowledged_at ? (
                      <Txt variant="caption" tone="subtle">
                        {t('You confirmed receipt on {date}.', { date: formatDate(a.acknowledged_at) })}
                      </Txt>
                    ) : null}
                  </Stack>
                </Card>
              ))}
              <Txt variant="caption" tone="subtle">
                {t('To hand something back, give it to IT or HR. They record the return.')}
              </Txt>
            </Stack>
          )}
        </QueryView>
      </Section>

      <Section title={t('My requests')}>
        <QueryView
          query={requests}
          skeleton={<SkeletonList rows={2} />}
          isEmpty={(d) => d.length === 0}
          empty={
            <Txt variant="callout" tone="muted">
              {t('You have not asked for anything.')}
            </Txt>
          }
        >
          {() => (
            <ListGroup>
              {[...openRequests, ...pastRequests].map((r) => (
                <ListRow
                  key={r.id}
                  title={r.category_name}
                  subtitle={[formatDate(r.created_at), r.needed_by ? t('needed by {date}', { date: formatDate(r.needed_by) }) : null].filter(Boolean).join(' · ')}
                  meta={r.decision_note ?? (r.fulfilled_asset_tag ? t('Given: {tag}', { tag: r.fulfilled_asset_tag }) : r.reason)}
                  trailing={<StatusBadge status={r.status} />}
                  onPress={r.can_cancel ? () => setCancelling(r) : undefined}
                  accessibilityHint={r.can_cancel ? t('Opens the option to withdraw it') : undefined}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>

      {mine.data?.history.length ? (
        <Section title={t('Returned')} action={{ label: showHistory ? t('Hide') : t('Show'), onPress: () => setShowHistory((v) => !v) }}>
          {showHistory ? (
            <ListGroup>
              {mine.data.history.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.asset_name}
                  subtitle={[a.asset_tag, a.returned_at ? t('returned {date}', { date: formatDate(a.returned_at) }) : t(statusLabel(a.outcome))].filter(Boolean).join(' · ')}
                  meta={a.return_notes ?? undefined}
                />
              ))}
            </ListGroup>
          ) : null}
        </Section>
      ) : null}

      <ConfirmSheet
        open={acknowledging !== null}
        onClose={() => setAcknowledging(null)}
        title={t('Confirm you have {name}?', { name: acknowledging?.asset_name ?? '' })}
        message={t('This records that it is with you, in the condition noted. You are responsible for it until you hand it back.')}
        confirmLabel={t('Yes, I have it')}
        onConfirm={async () => {
          const target = acknowledging;
          setAcknowledging(null);
          if (target) await acknowledge.run(target.id);
        }}
      />
      <ConfirmSheet
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={t('Withdraw your request for {name}?', { name: cancelling?.category_name ?? '' })}
        confirmLabel={t('Withdraw')}
        cancelLabel={t('Keep it')}
        tone="danger"
        onConfirm={async () => {
          const target = cancelling;
          setCancelling(null);
          if (target) await cancel.run(target.id);
        }}
      />
    </Screen>
  );
}

export function RequestAssetScreen() {
  const navigation = useNavigation();
  const categories = useQuery({ queryKey: ['assets', 'categories'], queryFn: assetsApi.categories, staleTime: 10 * 60_000 });
  const today = todayISO();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [neededBy, setNeededBy] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const errors = {
    category: !categoryId ? t('Choose what you need.') : null,
    reason: !reason.trim() ? t('Say why you need it.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const send = useAction(() => assetsApi.request({ category_id: categoryId!, reason: reason.trim(), needed_by: neededBy }), {
    success: t('Request sent'),
    invalidate: [['assets']],
  });

  if (categories.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }
  if (categories.error) {
    return (
      <Screen>
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      </Screen>
    );
  }
  const active = (categories.data ?? []).filter((c) => c.active);
  if (!active.length) {
    return (
      <Screen>
        <EmptyState spot="laptop" title={t('Nothing to request yet')} message={t('HR has not set up asset types. Ask IT or HR directly.')} />
      </Screen>
    );
  }

  return (
    <FormScreen
      submitLabel={t('Send request')}
      dirty={Boolean(categoryId || reason || neededBy)}
      submitDisabled={touched && invalid}
      onSubmit={async () => {
        setTouched(true);
        if (invalid) return;
        const done = await send.run(undefined);
        if (done) navigation.goBack();
      }}
    >
      <Stack gap="row">
        <SelectField
          label={t('What do you need?')}
          required
          value={categoryId}
          options={active.map((c) => ({
            value: c.id,
            label: c.name,
            description: c.in_stock_count > 0 ? t('{count} in stock', { count: c.in_stock_count }) : t('None in stock right now'),
          }))}
          onChange={setCategoryId}
          error={touched ? errors.category : null}
        />
        <TextField label={t('Why do you need it?')} required value={reason} onChangeText={setReason} multiline maxLength={2000} error={touched ? errors.reason : null} />
        <DateField label={t('Needed by')} value={neededBy} onChange={setNeededBy} minimumDate={today} maximumDate={addDays(today, 365)} placeholder={t('Optional')} />
      </Stack>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
