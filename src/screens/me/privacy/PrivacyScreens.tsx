/**
 * Privacy (DPDP Act): what the company holds about the person and why, the
 * choices they can make, copies of their data, their requests — and exactly
 * what AI may and may never do to their record.
 */

import { useQuery } from '@tanstack/react-query';
import { Bot, Download, FileSearch, Lock, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { privacyApi, type ConsentPurpose } from '../../../api/privacy';
import { Badge, StatusBadge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ChoiceField, SwitchRow, TextField } from '../../../components/Field';
import { KeyValue, ListGroup, ListRow } from '../../../components/List';
import { Screen, Section, Stack } from '../../../components/Screen';
import { ConfirmSheet, Sheet } from '../../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../../components/Skeleton';
import { EmptyState, Notice, QueryView } from '../../../components/States';
import { useResetOnOpen } from '../../../components/sheetContext';
import { Txt } from '../../../components/Text';
import { formatDate, formatDateTime } from '../../../core/dates';
import { statusLabel } from '../../../core/status';
import { t } from '../../../lib/i18n';
import { shareDownloaded } from '../../../lib/files';
import { useAction } from '../../../lib/useAction';
import { useGo } from '../../../navigation/navigate';
import { spacing } from '../../../theme/tokens';

const humanise = (key: string) => statusLabel(key);

export function PrivacyScreen() {
  const go = useGo();
  const notice = useQuery({ queryKey: ['privacy', 'notice'], queryFn: () => privacyApi.notice() });
  const consents = useQuery({ queryKey: ['privacy', 'consents'], queryFn: privacyApi.consents });
  const choosable = (consents.data?.purposes ?? []).filter((p) => p.lawful_basis === 'consent');
  const granted = choosable.filter((p) => p.status === 'granted').length;

  return (
    <Screen onRefresh={() => Promise.all([notice.refetch(), consents.refetch()])}>
      <QueryView query={notice} skeleton={<SkeletonCard lines={3} />}>
        {(data) => (
          <Card variant="soft">
            <Stack gap="inline">
              <Txt variant="headline">{data.title}</Txt>
              <Txt variant="callout" tone="muted">
                {data.intro}
              </Txt>
            </Stack>
          </Card>
        )}
      </QueryView>

      <Section>
        <ListGroup>
          <ListRow
            spot="privacy"
            title={t('Your choices')}
            subtitle={consents.data ? t('{granted} of {total} switched on', { granted, total: choosable.length }) : undefined}
            onPress={() => go('Consent')}
          />
          <ListRow spot="aiTrail" title={t('What can AI do to my record?')} onPress={() => go('AiTransparency')} />
          <ListRow spot="database" title={t('My data and requests')} subtitle={t('A copy of your data, corrections, deletion')} onPress={() => go('DataRequests')} />
        </ListGroup>
      </Section>

      <QueryView query={notice} skeleton={<SkeletonList rows={3} />}>
        {(data) => (
          <Section title={t('Used for your job')} description={t('These are part of employment and do not need your consent.')}>
            <ListGroup>
              {data.disclosures.map((item) => (
                <ListRow key={item.purpose} title={item.heading} subtitle={item.body} meta={item.basis_explanation} numberOfLines={4} />
              ))}
            </ListGroup>
            <Txt variant="caption" tone="muted">
              {data.rights_line}
            </Txt>
            {data.grievance_contact ? (
              <Txt variant="caption" tone="muted">
                {t('Questions or a complaint: {contact}', { contact: data.grievance_contact })}
              </Txt>
            ) : (
              <Txt variant="caption" tone="muted">
                {t('Your employer has not named a privacy contact yet. You can still see, correct or delete your data under My data.')}
              </Txt>
            )}
          </Section>
        )}
      </QueryView>
    </Screen>
  );
}

export function ConsentScreen() {
  const consents = useQuery({ queryKey: ['privacy', 'consents'], queryFn: privacyApi.consents });
  const notice = useQuery({ queryKey: ['privacy', 'notice'], queryFn: () => privacyApi.notice() });
  const [withdrawing, setWithdrawing] = useState<ConsentPurpose | null>(null);
  const invalidate = [['privacy'], ['companion']];
  const grant = useAction((purpose: string) => privacyApi.grant(purpose, notice.data?.notice_id), {
    success: t('Switched on'),
    invalidate,
  });
  const withdraw = useAction((purpose: string) => privacyApi.withdraw(purpose), { success: t('Switched off'), invalidate });

  const bodyFor = (purpose: string) =>
    notice.data?.choices.find((item) => item.purpose === purpose)?.body ?? null;

  return (
    <Screen onRefresh={() => consents.refetch()}>
      <QueryView query={consents} skeleton={<SkeletonList rows={5} />}>
        {(data) => {
          const choosable = data.purposes.filter((p) => p.lawful_basis === 'consent');
          const required = data.purposes.filter((p) => p.lawful_basis !== 'consent');
          return (
            <>
              <Section title={t('Your choices')} description={t('Each one is optional. Switching one off stops only what it lists.')}>
                {choosable.map((purpose) => (
                  <Card key={purpose.purpose}>
                    <Stack gap="inline">
                      <SwitchRow
                        label={purpose.name}
                        value={purpose.status === 'granted'}
                        disabled={grant.pending || withdraw.pending}
                        onChange={(on) => {
                          if (on) void grant.run(purpose.purpose);
                          else setWithdrawing(purpose);
                        }}
                      />
                      {bodyFor(purpose.purpose) ? (
                        <Txt variant="callout" tone="muted">
                          {bodyFor(purpose.purpose)}
                        </Txt>
                      ) : null}
                      <Txt variant="caption" tone="subtle">
                        {purpose.status === 'granted' && purpose.decided_at
                          ? t('On since {date}', { date: formatDateTime(purpose.decided_at) })
                          : purpose.status === 'not_asked'
                            ? t('Not decided yet')
                            : t('Off')}
                      </Txt>
                    </Stack>
                  </Card>
                ))}
              </Section>
              <Section title={t('Needed for your job')}>
                <ListGroup>
                  {required.map((purpose) => (
                    <ListRow key={purpose.purpose} icon={Lock} iconTone="neutral" title={purpose.name} subtitle={purpose.lawful_basis_label} />
                  ))}
                </ListGroup>
              </Section>
            </>
          );
        }}
      </QueryView>

      <ConfirmSheet
        open={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        title={t('Switch off {name}?', { name: withdrawing?.name ?? '' })}
        message={[
          withdrawing?.stops_if_withdrawn.length
            ? t('This stops: {list}. You can switch it back on at any time.', {
                list: withdrawing.stops_if_withdrawn.map(humanise).join(', ').toLowerCase(),
              })
            : t('You can switch it back on at any time.'),
          withdrawing?.withdrawal_erases?.length
            ? t('Deleted straight away: {list}.', { list: withdrawing.withdrawal_erases.join('; ') })
            : null,
          withdrawing?.withdrawal_keeps?.length ? t('Kept: {list}', { list: withdrawing.withdrawal_keeps.join(' ') }) : null,
        ]
          .filter(Boolean)
          .join('\n\n')}
        confirmLabel={t('Switch off')}
        tone="danger"
        onConfirm={async () => {
          const target = withdrawing;
          setWithdrawing(null);
          if (target) await withdraw.run(target.purpose);
        }}
      />
    </Screen>
  );
}

const REQUEST_TYPES = [
  { value: 'access', label: 'A copy of my data', description: 'Everything held about you, explained.' },
  { value: 'correction', label: 'Correct something', description: 'Say what is wrong and what it should be.' },
  { value: 'erasure', label: 'Delete my data', description: 'What the law lets your employer delete.' },
  { value: 'grievance', label: 'A complaint', description: 'About how your data was handled.' },
  { value: 'nomination', label: 'Nominate someone', description: 'To act for you if you cannot.' },
] as const;

export function DataRequestsScreen() {
  const requests = useQuery({ queryKey: ['privacy', 'requests'], queryFn: privacyApi.requests });
  const held = useQuery({ queryKey: ['privacy', 'export'], queryFn: privacyApi.exportSummary });
  const erasure = useQuery({ queryKey: ['privacy', 'erasure'], queryFn: privacyApi.erasurePreview, retry: false });
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>('access');
  const [details, setDetails] = useState('');
  const [downloading, setDownloading] = useState(false);
  useResetOnOpen(open, () => {
    setKind('access');
    setDetails('');
  });
  const raise = useAction(() => privacyApi.raise(kind, details.trim()), {
    success: t('Request sent. You will hear back by the date shown.'),
    invalidate: [['privacy', 'requests']],
    onSuccess: () => {
      setOpen(false);
      setDetails('');
    },
  });
  const needsDetails = kind === 'correction' || kind === 'grievance';

  return (
    <Screen onRefresh={() => Promise.all([requests.refetch(), held.refetch()])}>
      <Section title={t('Your data')}>
        <Card>
          <Stack gap="inline">
            <Txt variant="callout" tone="muted">
              {t('Download a copy of everything held about you, with why it is held and for how long.')}
            </Txt>
            <Button
              label={t('Download my data')}
              icon={Download}
              variant="secondary"
              loading={downloading}
              onPress={async () => {
                setDownloading(true);
                await shareDownloaded('/dpdp/me/export/download', 'my-askmira-data.json', 'application/json');
                setDownloading(false);
              }}
            />
          </Stack>
        </Card>
        <QueryView query={held} skeleton={<SkeletonList rows={3} />}>
          {(data) => (
            <ListGroup>
              {data.sections.map((section) => (
                <ListRow
                  key={section.category}
                  icon={FileSearch}
                  iconTone="neutral"
                  title={section.name}
                  subtitle={section.why_we_hold_it}
                  meta={section.how_long}
                  numberOfLines={3}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>

      <Section title={t('My requests')} action={{ label: t('New request'), onPress: () => setOpen(true) }}>
        <QueryView
          query={requests}
          isEmpty={(data) => data.requests.length === 0}
          empty={<EmptyState inline spot="sign" title={t('No requests yet')} message={t('Ask for a copy, a correction or deletion of your data.')} />}
        >
          {(data) => (
            <ListGroup>
              {data.requests.map((request) => (
                <ListRow
                  key={request.id}
                  title={t(REQUEST_TYPES.find((r) => r.value === request.type)?.label ?? statusLabel(request.type))}
                  subtitle={request.details ?? undefined}
                  meta={
                    request.responded_at
                      ? t('Answered {date}', { date: formatDateTime(request.responded_at) })
                      : request.due_by
                        ? t('Due by {date}', { date: formatDate(request.due_by) })
                        : undefined
                  }
                  trailing={<StatusBadge status={request.status} />}
                />
              ))}
            </ListGroup>
          )}
        </QueryView>
      </Section>

      {erasure.data && erasure.data.decisions.length ? (
        <Section title={t('Deletion')} description={erasure.data.summary}>
          <ListGroup>
            {erasure.data.decisions.map((decision) => (
              <ListRow
                key={decision.category}
                title={decision.category_name}
                subtitle={decision.explanation}
                numberOfLines={4}
                trailing={<Badge label={decision.outcome === 'purged' ? t('Deleted') : t('Kept by law')} tone={decision.outcome === 'purged' ? 'success' : 'neutral'} />}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('New request')}
        scrollable
        dirty={Boolean(details.trim())}
        footer={
          <Button
            label={t('Send request')}
            variant="accent"
            loading={raise.pending}
            disabled={needsDetails && details.trim().length < 5}
            onPress={() => void raise.run(undefined)}
            fullWidth
          />
        }
      >
        <ChoiceField
          label={t('What do you want?')}
          value={kind}
          options={REQUEST_TYPES.map((r) => ({ value: r.value, label: t(r.label) }))}
          onChange={setKind}
          helper={t(REQUEST_TYPES.find((r) => r.value === kind)?.description ?? '')}
        />
        <TextField
          label={needsDetails ? t('Details') : t('Details (optional)')}
          value={details}
          onChangeText={setDetails}
          multiline
          maxLength={4000}
          required={needsDetails}
          helper={needsDetails ? t('Say what is wrong and what it should be.') : undefined}
        />
      </Sheet>
    </Screen>
  );
}

export function AiTransparencyScreen() {
  const query = useQuery({ queryKey: ['privacy', 'ai'], queryFn: privacyApi.transparency });
  return (
    <Screen onRefresh={() => query.refetch()}>
      <QueryView query={query} skeleton={<SkeletonList rows={5} />}>
        {(data) => (
          <>
            <Notice tone="info" icon={ShieldCheck} title={t('Never automatic')} message={data.protected_statement} />
            <Section title={t('Protected actions')} description={t('A person always decides these, whatever the settings say.')}>
              <ListGroup>
                {data.protected.map((action) => (
                  <ListRow key={action.key} icon={Lock} iconTone="danger" title={action.description} subtitle={action.ceiling_reason} numberOfLines={4} />
                ))}
              </ListGroup>
            </Section>
            <Section title={t('Everything an AI agent may do')}>
              <ListGroup>
                {data.permitted
                  .filter((action) => !action.is_protected)
                  .map((action) => (
                    <ListRow
                      key={action.key}
                      icon={Bot}
                      iconTone="neutral"
                      title={action.description}
                      subtitle={action.max_autonomy_label}
                      meta={action.reversible ? t('Can be undone') : t('Cannot be undone')}
                      numberOfLines={3}
                    />
                  ))}
              </ListGroup>
            </Section>
            <Section title={t('Activity')}>
              <Card>
                <Stack gap="tight">
                  {Object.entries(data.activity).map(([key, value]) => (
                    <KeyValue key={key} label={t(statusLabel(key))} value={String(value)} />
                  ))}
                </Stack>
              </Card>
            </Section>
            {data.not_built.length ? (
              <Section title={t('Not built yet')} description={t('Said plainly, so nothing here is overstated.')}>
                <Card variant="sunken">
                  <View style={styles.notes}>
                    {data.not_built.map((note) => (
                      <Txt key={note} variant="caption" tone="muted">
                        • {note}
                      </Txt>
                    ))}
                  </View>
                </Card>
              </Section>
            ) : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notes: { gap: spacing.sm },
});
