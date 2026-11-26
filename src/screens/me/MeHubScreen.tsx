/**
 * Me — everything about the person, grouped the way they think of it.
 *
 * The top is the older HRMS's profile banner, quieter: photo, name, role and
 * code, and the way into the full profile. Below, the rest of the app in
 * groups — pay and tax, work, growth and culture, account — each with its
 * icon from the website's set (components/Spot.tsx). The older HRMS's side
 * menu (profile, change password, notifications, sign out) lives under
 * Account.
 *
 * Each entry shows only when the person can reach it: the workspace has the
 * module on, the login has an employee record, and (for My team and
 * Approvals) they have people reporting to them. A linked product
 * (ExpenseGenie, CGB Helpdesk) keeps its entry, which then opens the product.
 */

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { peopleApi } from '../../api/people';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ListGroup, ListRow } from '../../components/List';
import { Screen, Section } from '../../components/Screen';
import { ConfirmSheet } from '../../components/Sheet';
import { Skeleton } from '../../components/Skeleton';
import { TabHeader } from '../../components/TabHeader';
import { Txt } from '../../components/Text';
import { isHr } from '../../core/access';
import { formatDate } from '../../core/dates';
import { personName } from '../../core/status';
import { t } from '../../lib/i18n';
import { useInboxCount } from '../../lib/inbox';
import { useSession } from '../../lib/session';
import { useGo } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, spacing } from '../../theme/tokens';

export function MeHubScreen() {
  const go = useGo();
  const { colors } = useTheme();
  const { session, access, can, signOut } = useSession();
  const inbox = useInboxCount();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const me = useQuery({
    queryKey: ['profile-basics'],
    queryFn: peopleApi.me,
    enabled: Boolean(session?.user.employee_id),
  });

  const user = session?.user;
  const name = personName(me.data) || user?.full_name || '';
  const approver = Boolean(access && (access.isManager || isHr(access)));
  const roleLine = [me.data?.designation, me.data?.employee_code].filter(Boolean).join(' · ');

  return (
    <Screen tier="tier2" header={<TabHeader title={t('Me')} avatar={false} />} onRefresh={() => me.refetch()}>
      <Card variant="soft" onPress={() => (user?.employee_id ? go('Profile') : go('Security'))} accessibilityLabel={t('Open my profile')}>
        <View style={styles.profile}>
          <Avatar name={name} url={me.data?.photo_url} size={layout.avatarLg - spacing.xs} strong />
          <View style={styles.profileText}>
            {me.isPending && user?.employee_id ? (
              <>
                <Skeleton width="60%" height={spacing.lg + spacing.xs} />
                <Skeleton width="40%" />
              </>
            ) : (
              <>
                <Txt variant="displaySmall" tone="primary" numberOfLines={1}>
                  {name}
                </Txt>
                <Txt variant="callout" tone="muted" numberOfLines={2}>
                  {roleLine || user?.email}
                </Txt>
                <Txt variant="caption" tone="subtle" numberOfLines={1}>
                  {me.data?.date_of_joining
                    ? t('{company} · joined {date}', { company: session?.tenant.name ?? '', date: formatDate(me.data.date_of_joining) })
                    : session?.tenant.name}
                </Txt>
              </>
            )}
          </View>
          <ChevronRight size={layout.icon} color={colors.textMuted} />
        </View>
        {user?.employee_id ? (
          <View style={[styles.profileLinks, { borderColor: colors.softBorder }]}>
            <ProfileLink label={t('View profile')} onPress={() => go('Profile')} />
            <ProfileLink label={t('Documents')} onPress={() => go('Documents')} hidden={!can('documents')} />
            <ProfileLink label={t('Payslips')} onPress={() => go('Payslips')} hidden={!can('payslips')} />
          </View>
        ) : null}
      </Card>

      {approver || can('myTeam') ? (
        <Section title={t('My team')}>
          <ListGroup>
            {approver ? (
              <ListRow
                spot="workflow"
                title={t('Approvals')}
                subtitle={t('Leave, attendance, shifts, overtime, expenses')}
                trailing={inbox.approvals ? <Badge label={t('{count} waiting', { count: inbox.approvals })} tone="warning" /> : undefined}
                onPress={() => go('Approvals')}
              />
            ) : null}
            {can('myTeam') ? <ListRow spot="team" title={t('My team')} subtitle={t('Who is in, leave balances, reviews and 1:1s')} onPress={() => go('MyTeam')} /> : null}
          </ListGroup>
        </Section>
      ) : null}

      {can('payslips') || can('tax') || can('loans') || can('flexi') || can('ewa') || can('benefits') || can('esop') ? (
        <Section title={t('Pay & tax')}>
          <ListGroup tier="tier1">
            {can('payslips') ? <ListRow spot="payslip" title={t('Payslips')} subtitle={t('Monthly payslips, year to date')} onPress={() => go('Payslips')} /> : null}
            {can('salary') ? <ListRow spot="rupee" title={t('Salary structure')} onPress={() => go('Salary')} /> : null}
            {can('salary') ? <ListRow spot="gift" title={t('Total rewards')} subtitle={t('Pay, benefits, employer share')} onPress={() => go('TotalRewards')} /> : null}
            {can('tax') ? <ListRow spot="fileSend" title={t('IT declaration')} subtitle={t('Investments and proofs')} onPress={() => go('TaxDeclarations')} /> : null}
            {can('tax') ? <ListRow spot="calculator" title={t('Income tax')} subtitle={t('Regime, projection, Form 16')} onPress={() => go('Tax')} /> : null}
            {can('loans') ? <ListRow spot="bank" title={t('Loans & advances')} onPress={() => go('Loans')} /> : null}
            {can('flexi') ? <ListRow spot="sliders" title={t('Flexi benefits')} subtitle={t('Split your flexi pot')} onPress={() => go('Flexi')} /> : null}
            {can('ewa') ? <ListRow spot="cash" title={t('Early pay')} subtitle={t('Draw earned pay before payday')} onPress={() => go('Ewa')} /> : null}
            {can('benefits') ? <ListRow spot="shield" title={t('Benefits')} onPress={() => go('Benefits')} /> : null}
            {can('esop') ? <ListRow spot="growth" title={t('Stock options')} onPress={() => go('Esop')} /> : null}
          </ListGroup>
        </Section>
      ) : null}

      <Section title={t('Work')}>
        <ListGroup>
          {can('documents') || can('letters') ? <ListRow spot="folder" title={t('Documents')} subtitle={t('Your files and company files')} onPress={() => go('Documents')} /> : null}
          {can('policies') ? <ListRow spot="book" title={t('Company policies')} subtitle={t('Read and acknowledge')} onPress={() => go('CompanyPolicies')} /> : null}
          {can('letters') ? <ListRow spot="mail" title={t('Letters')} onPress={() => go('Letters')} /> : null}
          {can('helpdesk') ? <ListRow spot="headset" title={t('Helpdesk')} subtitle={t('Raise and track tickets')} onPress={() => go('Helpdesk')} /> : null}
          {can('assets') ? <ListRow spot="laptop" title={t('My assets')} onPress={() => go('Assets')} /> : null}
          {can('expenses') ? <ListRow spot="receipt" title={t('Expenses')} subtitle={t('Claims, advances and travel')} onPress={() => go('Expenses')} /> : null}
          {can('org') ? <ListRow spot="org" title={t('Manager & team')} onPress={() => go('OrgChart')} /> : null}
          {can('onboarding') ? <ListRow spot="checklist" title={t('My onboarding')} onPress={() => go('Onboarding')} /> : null}
        </ListGroup>
      </Section>

      {can('goals') || can('culture') || can('rewards') || can('referrals') || can('interviews') ? (
        <Section title={t('Growth & culture')}>
          <ListGroup>
            {can('goals') ? <ListRow spot="target" title={t('Goals')} onPress={() => go('Goals')} /> : null}
            {can('appraisal') ? <ListRow spot="trend" title={t('My reviews')} onPress={() => go('Appraisal')} /> : null}
            {can('goals') ? <ListRow spot="chat" title={t('1:1s')} onPress={() => go('OneOnOnes')} /> : null}
            {can('feedback') ? <ListRow spot="quote" title={t('Feedback')} onPress={() => go('Feedback')} /> : null}
            {can('learning') ? <ListRow spot="cap" title={t('Learning')} onPress={() => go('Learning')} /> : null}
            {can('culture') ? <ListRow spot="heart" title={t('Culture')} subtitle={t('Shoutouts, clubs, polls, events')} onPress={() => go('Culture')} /> : null}
            {can('rewards') ? <ListRow spot="coins" title={t('Reward points')} onPress={() => go('Rewards')} /> : null}
            {can('referrals') ? <ListRow spot="recruit" title={t('Refer a friend')} onPress={() => go('Referrals')} /> : null}
            {can('interviews') ? <ListRow spot="question" title={t('My interviews')} onPress={() => go('Interviews')} /> : null}
          </ListGroup>
        </Section>
      ) : null}

      <Section title={t('Account')}>
        <ListGroup>
          <ListRow spot="key" title={t('Password & security')} subtitle={t('Change password, fingerprint unlock, 2-step sign-in')} onPress={() => go('Security')} />
          <ListRow spot="bell" title={t('Notification settings')} subtitle={t('What you hear about, and how')} onPress={() => go('NotificationPrefs')} />
          <ListRow spot="toggle" title={t('Settings')} subtitle={t('Language, light or dark')} onPress={() => go('Settings')} />
          <ListRow spot="privacy" title={t('Privacy')} subtitle={t('Consent, your data, AI and your record')} onPress={() => go('Privacy')} />
          {can('exit') ? <ListRow spot="door" title={t('Resignation')} onPress={() => go('Exit')} /> : null}
          <ListRow spot="grid" title={t('All services')} subtitle={t('Everything in AskMiraa, with search')} onPress={() => go('Services')} />
          <ListRow icon={LogOut} title={t('Sign out')} subtitle={t('Or sign in as someone else')} destructive chevron={false} onPress={() => setConfirmSignOut(true)} />
        </ListGroup>
      </Section>

      <ConfirmSheet
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title={t('Sign out?')}
        message={t('Punches saved on this phone but not yet sent stay here and send when you sign back in.')}
        confirmLabel={t('Sign out')}
        tone="danger"
        onConfirm={async () => {
          setConfirmSignOut(false);
          await signOut();
        }}
      />
    </Screen>
  );
}

function ProfileLink({ label, onPress, hidden }: { label: string; onPress: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={spacing.sm} style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}>
      <Txt variant="calloutStrong" tone="primary">
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: layout.row },
  profileText: { flex: 1, gap: spacing.xxs },
  profileLinks: { flexDirection: 'row', gap: spacing.xl, marginTop: layout.row, paddingTop: layout.row, borderTopWidth: layout.hairline },
  profileLink: { paddingVertical: spacing.xxs },
  pressed: { opacity: 0.6 },
});
