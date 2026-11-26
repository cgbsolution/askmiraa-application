/**
 * My profile.
 *
 * Some sections the person edits directly (education, family, emergency
 * contacts…); others change something HR must check (bank account, PAN,
 * address…), so the edit becomes a change request with a reason, and the
 * record changes only when HR approves. The backend says which is which for
 * this person (`direct_sections` / `request_sections`), so an admin editing
 * their own record is not made to ask.
 */

import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  AtSign,
  BadgeCheck,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Cake,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Camera,
  Droplet,
  Fingerprint,
  FolderKanban,
  Hash,
  Heart,
  HeartPulse,
  Home,
  IdCard,
  Image as ImageIcon,
  Landmark,
  Mail,
  MapPinned,
  Network,
  Phone,
  Plus,
  Smartphone,
  Star,
  Trash2,
  User,
  UserCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { peopleApi } from '../../api/people';
import { timesheetsApi } from '../../api/timesheets';
import { Avatar } from '../../components/Avatar';
import { Pill, StatusBadge } from '../../components/Badge';
import { InfoGroup, InfoRow } from '../../components/InfoList';
import { Button, IconButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField, SelectField, SwitchRow, TextField } from '../../components/Field';
import { FormScreen } from '../../components/FormScreen';
import { KeyValue, ListGroup, ListRow } from '../../components/List';
import { Screen, Section, Stack } from '../../components/Screen';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import type { SpotName } from '../../components/Spot';
import { EmptyState, ErrorState, Notice, QueryView } from '../../components/States';
import { Txt } from '../../components/Text';
import { toast } from '../../components/Toast';
import { changeDiff } from '../../core/changes';
import { formatDate, formatDateTime } from '../../core/dates';
import { personName, statusLabel } from '../../core/status';
import type { ProfileSection } from '../../core/types';
import { normaliseId, sharesProblem, validateField, type CheckName } from '../../core/validators';
import { choosePhoto, takePhoto } from '../../lib/files';
import { t, tn } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { layout, radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

// ── Section definitions ──────────────────────────────────────────────────────

type FieldKind = 'text' | 'select' | 'date' | 'year' | 'switch' | 'number';

interface FieldSpec {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: { value: string; label: string }[];
  required?: boolean;
  check?: CheckName;
  maxLength?: number;
  keyboard?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  capitalise?: boolean;
}

type EditableSection = ProfileSection | 'contact';

interface SectionSpec {
  section: EditableSection;
  title: string;
  icon: LucideIcon;
  shape: 'object' | 'list' | 'addresses';
  fields: FieldSpec[];
  /** A sentence for an empty list, and the label for one item. */
  itemName?: string;
  /** The picture for an empty list: the same as the section's row in "More about me". */
  spot?: SpotName;
}

const RELATIONSHIPS = ['spouse', 'child', 'father', 'mother', 'sibling', 'father_in_law', 'mother_in_law', 'grandparent', 'friend', 'other'].map(
  (value) => ({ value, label: statusLabel(value) }),
);

export const INDIAN_STATES: { value: string; label: string }[] = [
  ['AN', 'Andaman and Nicobar Islands'], ['AP', 'Andhra Pradesh'], ['AR', 'Arunachal Pradesh'], ['AS', 'Assam'], ['BR', 'Bihar'],
  ['CH', 'Chandigarh'], ['CT', 'Chhattisgarh'], ['DN', 'Dadra and Nagar Haveli and Daman and Diu'], ['DL', 'Delhi'], ['GA', 'Goa'],
  ['GJ', 'Gujarat'], ['HR', 'Haryana'], ['HP', 'Himachal Pradesh'], ['JK', 'Jammu and Kashmir'], ['JH', 'Jharkhand'], ['KA', 'Karnataka'],
  ['KL', 'Kerala'], ['LA', 'Ladakh'], ['LD', 'Lakshadweep'], ['MP', 'Madhya Pradesh'], ['MH', 'Maharashtra'], ['MN', 'Manipur'],
  ['ML', 'Meghalaya'], ['MZ', 'Mizoram'], ['NL', 'Nagaland'], ['OR', 'Odisha'], ['PY', 'Puducherry'], ['PB', 'Punjab'], ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'], ['TN', 'Tamil Nadu'], ['TG', 'Telangana'], ['TR', 'Tripura'], ['UP', 'Uttar Pradesh'], ['UT', 'Uttarakhand'], ['WB', 'West Bengal'],
].map(([value, label]) => ({ value: value!, label: label! }));

const ADDRESS_FIELDS: FieldSpec[] = [
  { key: 'line1', label: 'Address line 1', required: true, maxLength: 255 },
  { key: 'line2', label: 'Address line 2', maxLength: 255 },
  { key: 'city', label: 'City', required: true, maxLength: 100 },
  { key: 'district', label: 'District', maxLength: 100 },
  { key: 'state_code', label: 'State', kind: 'select', options: INDIAN_STATES, required: true },
  { key: 'pincode', label: 'PIN code', required: true, check: 'pincode', keyboard: 'number-pad' },
];

export const SECTIONS: SectionSpec[] = [
  {
    section: 'contact',
    title: 'Contact',
    icon: Phone,
    shape: 'object',
    fields: [
      { key: 'display_name', label: 'Name you go by', maxLength: 255 },
      { key: 'phone', label: 'Mobile number', check: 'phone', keyboard: 'phone-pad' },
      { key: 'personal_email', label: 'Personal email', check: 'email', keyboard: 'email-address' },
    ],
  },
  {
    section: 'identity',
    title: 'Name and date of birth',
    icon: IdCard,
    shape: 'object',
    fields: [
      { key: 'first_name', label: 'First name', required: true, maxLength: 100 },
      { key: 'last_name', label: 'Last name', maxLength: 100 },
      { key: 'date_of_birth', label: 'Date of birth', kind: 'date' },
    ],
  },
  {
    section: 'personal',
    title: 'Personal details',
    icon: User,
    shape: 'object',
    fields: [
      { key: 'father_name', label: "Father's name", maxLength: 255 },
      { key: 'spouse_name', label: "Spouse's name", maxLength: 255 },
      {
        key: 'marital_status',
        label: 'Marital status',
        kind: 'select',
        options: ['single', 'married', 'separated', 'divorced', 'widowed', 'undisclosed'].map((value) => ({ value, label: statusLabel(value) })),
      },
      {
        key: 'blood_group',
        label: 'Blood group',
        kind: 'select',
        options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => ({ value, label: value })),
      },
      { key: 'nationality', label: 'Nationality', maxLength: 64 },
      { key: 'alternate_phone', label: 'Alternate phone', check: 'phone', keyboard: 'phone-pad' },
    ],
  },
  { section: 'addresses', title: 'Addresses', icon: Home, shape: 'addresses', fields: ADDRESS_FIELDS },
  {
    section: 'emergency_contacts',
    title: 'Emergency contacts',
    icon: HeartPulse,
    shape: 'list',
    itemName: 'contact',
    spot: 'phone',
    fields: [
      { key: 'name', label: 'Name', required: true, maxLength: 255 },
      { key: 'relationship', label: 'Relationship', kind: 'select', options: RELATIONSHIPS, required: true },
      { key: 'phone', label: 'Phone', required: true, check: 'phone', keyboard: 'phone-pad' },
      { key: 'alternate_phone', label: 'Alternate phone', check: 'phone', keyboard: 'phone-pad' },
      { key: 'email', label: 'Email', check: 'email', keyboard: 'email-address' },
      { key: 'is_primary', label: 'Call this person first', kind: 'switch' },
    ],
  },
  {
    section: 'family_members',
    title: 'Family',
    icon: Users,
    shape: 'list',
    itemName: 'family member',
    spot: 'team',
    fields: [
      { key: 'name', label: 'Name', required: true, maxLength: 255 },
      { key: 'relationship', label: 'Relationship', kind: 'select', options: RELATIONSHIPS, required: true },
      { key: 'date_of_birth', label: 'Date of birth', kind: 'date' },
      {
        key: 'gender',
        label: 'Gender',
        kind: 'select',
        options: ['female', 'male', 'non_binary', 'undisclosed'].map((value) => ({ value, label: statusLabel(value) })),
      },
      { key: 'occupation', label: 'Occupation', maxLength: 128 },
      { key: 'is_dependent', label: 'Depends on me', kind: 'switch' },
    ],
  },
  {
    section: 'nominees',
    title: 'Nominees',
    icon: UsersRound,
    shape: 'list',
    itemName: 'nominee',
    spot: 'shield',
    fields: [
      { key: 'name', label: 'Name', required: true, maxLength: 255 },
      { key: 'relationship', label: 'Relationship', kind: 'select', options: RELATIONSHIPS, required: true },
      {
        key: 'purpose',
        label: 'For',
        kind: 'select',
        options: [
          { value: 'pf', label: 'Provident fund' },
          { value: 'eps', label: 'Pension (EPS)' },
          { value: 'gratuity', label: 'Gratuity' },
          { value: 'insurance', label: 'Insurance' },
        ],
        required: true,
      },
      { key: 'share_percent', label: 'Share (%)', kind: 'number', check: 'percent', required: true, keyboard: 'number-pad' },
      { key: 'date_of_birth', label: 'Date of birth', kind: 'date' },
      { key: 'address', label: 'Address', maxLength: 500 },
      { key: 'guardian_name', label: 'Guardian (for a minor)', maxLength: 255 },
    ],
  },
  {
    section: 'education',
    title: 'Education',
    icon: BookOpen,
    shape: 'list',
    itemName: 'qualification',
    spot: 'cap',
    fields: [
      {
        key: 'level',
        label: 'Level',
        kind: 'select',
        required: true,
        options: ['secondary', 'higher_secondary', 'diploma', 'graduate', 'postgraduate', 'doctorate', 'certification', 'other'].map((value) => ({
          value,
          label: statusLabel(value),
        })),
      },
      { key: 'qualification', label: 'Qualification', required: true, maxLength: 128 },
      { key: 'specialisation', label: 'Specialisation', maxLength: 128 },
      { key: 'institution', label: 'Institution', required: true, maxLength: 255 },
      { key: 'board_or_university', label: 'Board or university', maxLength: 255 },
      { key: 'start_year', label: 'Started', kind: 'year', check: 'year', keyboard: 'number-pad' },
      { key: 'end_year', label: 'Finished', kind: 'year', check: 'year', keyboard: 'number-pad' },
      { key: 'grade', label: 'Grade', maxLength: 32 },
    ],
  },
  {
    section: 'previous_employment',
    title: 'Previous jobs',
    icon: BriefcaseBusiness,
    shape: 'list',
    itemName: 'job',
    spot: 'buildings',
    fields: [
      { key: 'employer', label: 'Employer', required: true, maxLength: 255 },
      { key: 'designation', label: 'Role', maxLength: 128 },
      { key: 'from_date', label: 'From', kind: 'date', required: true },
      { key: 'to_date', label: 'To', kind: 'date', required: true },
      { key: 'location', label: 'Location', maxLength: 128 },
      { key: 'reason_for_leaving', label: 'Why you left', maxLength: 500 },
    ],
  },
  {
    section: 'statutory',
    title: 'Statutory IDs',
    icon: Fingerprint,
    shape: 'object',
    fields: [
      { key: 'pan', label: 'PAN', check: 'pan', capitalise: true },
      { key: 'aadhaar', label: 'Aadhaar', check: 'aadhaar', keyboard: 'number-pad' },
      { key: 'uan', label: 'UAN', check: 'uan', keyboard: 'number-pad' },
      { key: 'pf_number', label: 'PF number', maxLength: 32 },
      { key: 'esi_number', label: 'ESI number', maxLength: 32 },
    ],
  },
  {
    section: 'bank_account',
    title: 'Bank account',
    icon: Banknote,
    shape: 'object',
    fields: [
      { key: 'account_holder_name', label: 'Account holder', required: true, maxLength: 255 },
      { key: 'account_number', label: 'Account number', required: true, check: 'accountNumber', keyboard: 'number-pad' },
      { key: 'ifsc', label: 'IFSC', required: true, check: 'ifsc', capitalise: true },
      { key: 'bank_name', label: 'Bank name', maxLength: 128 },
    ],
  },
];

type Row = Record<string, string | boolean | null>;

// ── Profile ──────────────────────────────────────────────────────────────────

/** "B-451, Rajiv Gandhi Colony, Kalkaji, New Delhi, Delhi 110019". */
function addressText(address: { line1: string; line2?: string | null; city: string; district?: string | null; state_code: string; pincode: string } | null | undefined): string | null {
  if (!address) return null;
  const state = INDIAN_STATES.find((s) => s.value === address.state_code)?.label ?? address.state_code;
  const parts = [address.line1, address.line2, address.district && address.district !== address.city ? address.district : null, address.city];
  return `${parts.filter(Boolean).join(', ')}, ${state} ${address.pincode}`.trim();
}

export function ProfileScreen() {
  const go = useGo();
  const { colors } = useTheme();
  const { can } = useSession();
  const me = useQuery({ queryKey: ['profile-basics'], queryFn: peopleApi.me });
  const profile = useQuery({ queryKey: ['profile'], queryFn: peopleApi.profile });
  const manager = useQuery({
    queryKey: ['people', 'employee', me.data?.manager_id],
    queryFn: () => peopleApi.employee(me.data!.manager_id!),
    enabled: Boolean(me.data?.manager_id),
  });
  const dotted = useQuery({
    queryKey: ['people', 'employee', me.data?.dotted_line_manager_id],
    queryFn: () => peopleApi.employee(me.data!.dotted_line_manager_id!),
    enabled: Boolean(me.data?.dotted_line_manager_id),
  });
  const departments = useQuery({ queryKey: ['org', 'departments'], queryFn: peopleApi.departments, staleTime: 60 * 60_000 });
  const locations = useQuery({ queryKey: ['org', 'locations'], queryFn: peopleApi.locations, staleTime: 60 * 60_000 });
  // Where they work: a client's project, or Internal.
  const projects = useQuery({ queryKey: ['org', 'projects'], queryFn: timesheetsApi.projects, staleTime: 60 * 60_000 });
  const [photoSheet, setPhotoSheet] = useState(false);
  const setPhoto = useAction((file: import('../../lib/api').UploadFile) => peopleApi.uploadPhoto(file), {
    success: t('Photo updated'),
    invalidate: [['profile-basics']],
  });
  const removePhoto = useAction(() => peopleApi.removePhoto(), { success: t('Photo removed'), invalidate: [['profile-basics']] });
  const name = personName(me.data);
  const pending = profile.data?.pending_requests ?? [];
  const viaHr = (section: string) => Boolean(profile.data?.request_sections.includes(section as ProfileSection));
  const edit = (section: string) => ({ label: viaHr(section) ? t('Request a change') : t('Edit'), onPress: () => go('ProfileEdit', { section }) });

  const department = departments.data?.find((d) => d.id === me.data?.department_id)?.name;
  const project = projects.data?.find((p) => p.id === me.data?.project_id)?.name;
  const location = locations.data?.find((l) => l.id === me.data?.location_id);
  const personal = profile.data?.personal;
  const addresses = profile.data?.addresses;
  const statutory = profile.data?.statutory;
  const bank = profile.data?.bank_account;
  const listCount = (key: 'emergency_contacts' | 'family_members' | 'nominees' | 'education' | 'previous_employment') => {
    const items = profile.data?.[key] ?? [];
    return items.length ? t('{count} added', { count: items.length }) : t('None added');
  };

  return (
    <Screen tier="tier2" onRefresh={() => Promise.all([me.refetch(), profile.refetch()])}>
      {me.isPending ? (
        <SkeletonCard lines={3} />
      ) : me.data ? (
        <Card variant="soft">
          <View style={styles.hero}>
            <View>
              <Avatar name={name} url={me.data.photo_url} size={layout.avatarXl} strong />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Change photo')}
                onPress={() => setPhotoSheet(true)}
                hitSlop={spacing.md}
                style={[styles.cameraBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Camera size={layout.iconSm} color={colors.primary} />
              </Pressable>
            </View>
            <Txt variant="displayMedium" tone="primary" align="center">
              {name}
            </Txt>
            <Txt variant="callout" tone="muted" align="center">
              {t('Employee code {code}', { code: me.data.employee_code })}
            </Txt>
            <View style={styles.heroPills}>
              {me.data.designation ? <Pill icon={BriefcaseBusiness} label={me.data.designation} /> : null}
              {department ? <Pill icon={Building2} label={department} /> : null}
            </View>
          </View>
        </Card>
      ) : (
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      )}

      {pending.length ? (
        <Notice
          tone="info"
          title={tn(pending.length, '{count} change waiting for HR', '{count} changes waiting for HR')}
          message={t('Your record changes once HR approves it.')}
          action={{ label: t('See changes'), onPress: () => go('ChangeRequests') }}
        />
      ) : null}

      {me.data ? (
        <QueryView query={profile} skeleton={<SkeletonList rows={6} />}>
          {(data) => (
            <>
              <InfoGroup title={t('Contact')} action={edit('contact')}>
                <InfoRow icon={Smartphone} label={t('Mobile number')} value={me.data.phone} />
                <InfoRow icon={Mail} label={t('Work email')} value={me.data.work_email} />
                <InfoRow icon={AtSign} label={t('Personal email')} value={me.data.personal_email} />
              </InfoGroup>

              <InfoGroup title={t('Addresses')} action={edit('addresses')} note={viaHr('addresses') ? t('HR checks') : undefined}>
                <InfoRow icon={MapPinned} label={t('Current address')} value={addressText(addresses?.current)} />
                <InfoRow
                  icon={Home}
                  label={t('Permanent address')}
                  value={addresses?.permanent_same_as_current ? t('Same as current address') : addressText(addresses?.permanent)}
                />
              </InfoGroup>

              <InfoGroup title={t('Personal')} action={edit('personal')} note={viaHr('personal') ? t('HR checks') : undefined}>
                <InfoRow icon={Cake} label={t('Date of birth')} value={me.data.date_of_birth ? formatDate(me.data.date_of_birth) : null} />
                <InfoRow icon={User} label={t('Gender')} value={me.data.gender ? t(statusLabel(me.data.gender)) : null} />
                <InfoRow icon={Heart} label={t('Marital status')} value={personal?.marital_status ? t(statusLabel(personal.marital_status)) : null} />
                <InfoRow icon={Droplet} label={t('Blood group')} value={personal?.blood_group ?? null} />
                <InfoRow icon={Users} label={t("Father's name")} value={personal?.father_name ?? null} />
              </InfoGroup>

              <InfoGroup title={t('Job')} note={t('Kept by HR')}>
                <InfoRow icon={BriefcaseBusiness} label={t('Designation')} value={me.data.designation} />
                <InfoRow icon={Building2} label={t('Department')} value={department ?? null} />
                <InfoRow icon={FolderKanban} label={t('Project')} value={project ?? null} />
                <InfoRow icon={Network} label={t('Branch')} value={location ? [location.name, location.city].filter(Boolean).join(', ') : null} />
                <InfoRow icon={Star} label={t('Grade')} value={me.data.grade} />
                <InfoRow icon={BadgeCheck} label={t('Employment')} value={t(statusLabel(me.data.employment_type ?? me.data.status))} />
              </InfoGroup>

              <InfoGroup title={t('Statutory IDs')} action={edit('statutory')} note={viaHr('statutory') ? t('HR checks') : undefined}>
                <InfoRow icon={IdCard} label={t('PAN')} value={statutory?.pan ?? null} />
                <InfoRow icon={Fingerprint} label={t('Aadhaar')} value={statutory?.aadhaar ?? null} />
                <InfoRow icon={Hash} label={t('UAN')} value={statutory?.uan ?? null} />
                <InfoRow icon={Hash} label={t('PF number')} value={statutory?.pf_number ?? null} />
                <InfoRow icon={Hash} label={t('ESI number')} value={statutory?.esi_number ?? null} />
              </InfoGroup>

              <InfoGroup title={t('Bank')} action={edit('bank_account')} note={viaHr('bank_account') ? t('HR checks') : undefined}>
                <InfoRow icon={Landmark} label={t('Bank name')} value={bank?.bank_name ?? null} />
                <InfoRow icon={Hash} label={t('Account number')} value={bank ? (bank.account_number ?? bank.account_number_masked) : null} />
                <InfoRow icon={Banknote} label={t('IFSC')} value={bank?.ifsc ?? null} />
              </InfoGroup>

              <InfoGroup title={t('Dates')}>
                <InfoRow icon={CalendarCheck2} label={t('Date of joining')} value={me.data.date_of_joining ? formatDate(me.data.date_of_joining) : null} />
                <InfoRow icon={CalendarClock} label={t('Probation ends')} value={me.data.probation_end_date ? formatDate(me.data.probation_end_date) : null} />
                {me.data.notice_period_days ? (
                  <InfoRow icon={CalendarDays} label={t('Notice period')} value={tn(me.data.notice_period_days, '{count} day', '{count} days')} />
                ) : null}
              </InfoGroup>

              <InfoGroup title={t('Managers')}>
                <InfoRow
                  icon={UserCheck}
                  label={t('Reporting manager')}
                  value={manager.data ? personName(manager.data) : me.data.manager_id ? '…' : null}
                  onPress={me.data.manager_id ? () => go('Colleague', { id: me.data.manager_id! }) : undefined}
                />
                {me.data.dotted_line_manager_id ? (
                  <InfoRow
                    icon={UsersRound}
                    label={t('Dotted-line manager')}
                    value={dotted.data ? personName(dotted.data) : '…'}
                    onPress={() => go('Colleague', { id: me.data.dotted_line_manager_id! })}
                  />
                ) : null}
              </InfoGroup>

              <Section title={t('More about me')}>
                <ListGroup>
                  <ListRow spot="phone" title={t('Emergency contacts')} subtitle={listCount('emergency_contacts')} onPress={() => go('ProfileEdit', { section: 'emergency_contacts' })} />
                  <ListRow spot="team" title={t('Family')} subtitle={listCount('family_members')} onPress={() => go('ProfileEdit', { section: 'family_members' })} />
                  <ListRow spot="shield" title={t('Nominees')} subtitle={listCount('nominees')} onPress={() => go('ProfileEdit', { section: 'nominees' })} />
                  <ListRow spot="cap" title={t('Education')} subtitle={listCount('education')} onPress={() => go('ProfileEdit', { section: 'education' })} />
                  <ListRow spot="buildings" title={t('Previous jobs')} subtitle={listCount('previous_employment')} onPress={() => go('ProfileEdit', { section: 'previous_employment' })} />
                  <ListRow spot="idCard" title={t('Name and date of birth')} subtitle={t('As on your ID')} onPress={() => go('ProfileEdit', { section: 'identity' })} />
                </ListGroup>
                {data.missing.length ? (
                  <Notice tone="warning" message={t('Still to add: {list}', { list: data.missing.map((m) => t(statusLabel(m))).join(', ') })} />
                ) : null}
              </Section>
            </>
          )}
        </QueryView>
      ) : null}

      <ListGroup>
        <ListRow spot="sign" title={t('My change requests')} onPress={() => go('ChangeRequests')} />
        <ListRow spot="org" title={t('My manager & team')} onPress={() => go('OrgChart')} />
        {can('exit') ? <ListRow spot="door" title={t('Separation')} subtitle={t('Resign, or see your exit')} onPress={() => go('Exit')} /> : null}
      </ListGroup>

      <Sheet open={photoSheet} onClose={() => setPhotoSheet(false)} title={t('Profile photo')}>
        <ListGroup>
          <ListRow
            icon={Camera}
            title={t('Take a photo')}
            onPress={async () => {
              setPhotoSheet(false);
              const file = await takePhoto({ types: ['image/*'] }, { front: true });
              if (file) await setPhoto.run(file);
            }}
          />
          <ListRow
            icon={ImageIcon}
            title={t('Choose from photos')}
            onPress={async () => {
              setPhotoSheet(false);
              const file = await choosePhoto({ types: ['image/*'] });
              if (file) await setPhoto.run(file);
            }}
          />
          {me.data?.photo_url ? (
            <ListRow
              icon={Trash2}
              title={t('Remove photo')}
              destructive
              onPress={async () => {
                setPhotoSheet(false);
                await removePhoto.run(undefined);
              }}
            />
          ) : null}
        </ListGroup>
      </Sheet>
    </Screen>
  );
}

// ── Editing a section ────────────────────────────────────────────────────────

function emptyRow(spec: SectionSpec): Row {
  return Object.fromEntries(spec.fields.map((f) => [f.key, f.kind === 'switch' ? false : null]));
}

function toRow(spec: SectionSpec, source: Record<string, unknown> | null | undefined): Row {
  const row = emptyRow(spec);
  for (const f of spec.fields) {
    const value = source?.[f.key];
    if (value === undefined || value === null) continue;
    row[f.key] = typeof value === 'boolean' ? value : String(value);
  }
  return row;
}

function rowErrors(spec: SectionSpec, row: Row): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of spec.fields) {
    if (f.kind === 'switch') continue;
    const message = validateField((row[f.key] as string | null) ?? '', { required: f.required, check: f.check, maxLength: f.maxLength });
    if (message) errors[f.key] = message;
  }
  return errors;
}

/** A row as the API takes it: trimmed, identifiers normalised, empty as null, years as numbers. */
function toPayload(spec: SectionSpec, row: Row, { dropEmpty = false } = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) {
    const value = row[f.key];
    if (f.kind === 'switch') {
      out[f.key] = Boolean(value);
      continue;
    }
    const text = typeof value === 'string' ? normaliseId(f.check, value) : '';
    if (!text) {
      if (!dropEmpty) out[f.key] = null;
      continue;
    }
    out[f.key] = f.kind === 'year' ? Number(text) : text;
  }
  return out;
}

function FieldInput({ field, value, onChange, error }: { field: FieldSpec; value: string | boolean | null; onChange: (v: string | boolean) => void; error?: string }) {
  const label = t(field.label);
  if (field.kind === 'switch') return <SwitchRow label={label} value={Boolean(value)} onChange={onChange} />;
  if (field.kind === 'select') {
    return (
      <SelectField
        label={label}
        required={field.required}
        value={(value as string | null) ?? null}
        options={field.options!.map((o) => ({ ...o, label: t(o.label) }))}
        onChange={onChange}
        error={error}
      />
    );
  }
  if (field.kind === 'date') {
    return <DateField label={label} required={field.required} value={(value as string | null) ?? null} onChange={onChange} error={error} />;
  }
  return (
    <TextField
      label={label}
      required={field.required}
      value={(value as string | null) ?? ''}
      onChangeText={(text) => onChange(field.capitalise ? text.toUpperCase() : field.keyboard === 'number-pad' ? text.replace(/[^0-9 ]/g, '') : text)}
      keyboardType={field.keyboard ?? 'default'}
      autoCapitalize={field.capitalise ? 'characters' : field.keyboard === 'email-address' ? 'none' : 'sentences'}
      maxLength={field.maxLength ?? (field.check === 'aadhaar' ? 14 : field.check === 'pan' ? 10 : field.check === 'ifsc' ? 11 : undefined)}
      countFrom={20}
      error={error}
    />
  );
}

export function ProfileEditScreen() {
  const navigation = useNavigation();
  const { section } = useParams<{ section: EditableSection }>();
  const spec = SECTIONS.find((s) => s.section === section) ?? SECTIONS[0]!;
  const me = useQuery({ queryKey: ['profile-basics'], queryFn: peopleApi.me });
  const profile = useQuery({ queryKey: ['profile'], queryFn: peopleApi.profile });
  const viaHr = Boolean(profile.data?.request_sections.includes(spec.section as ProfileSection));
  const current = profile.data ? (profile.data as unknown as Record<string, unknown>)[spec.section] : undefined;

  const [row, setRow] = useState<Row | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [addresses, setAddresses] = useState<{ current: Row; permanent: Row; same: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  /** A field changed (typing only the reason does not count). */
  const [edited, setEdited] = useState(false);

  // Seed the form once the record is in. Identifiers (PAN, bank) are not
  // seeded: they are shown as "on record" and typed afresh to change.
  useEffect(() => {
    // Contact and name/date of birth live on the employee record itself, not
    // in the profile document: wait for it, or the form opens empty.
    const fromRecord = spec.section === 'contact' || spec.section === 'identity';
    if (!profile.data || (fromRecord && !me.data) || row || rows || addresses) return;
    if (fromRecord) setRow(toRow(spec, me.data as unknown as Record<string, unknown>));
    else if (spec.shape === 'list') setRows(((current as Record<string, unknown>[] | undefined) ?? []).map((item) => toRow(spec, item)));
    else if (spec.shape === 'addresses') {
      const a = (current ?? {}) as { current?: Record<string, unknown>; permanent?: Record<string, unknown>; permanent_same_as_current?: boolean };
      setAddresses({ current: toRow(spec, a.current), permanent: toRow(spec, a.permanent), same: a.permanent_same_as_current ?? true });
    } else if (spec.section === 'statutory' || spec.section === 'bank_account') setRow(emptyRow(spec));
    else setRow(toRow(spec, current as Record<string, unknown>));
  }, [profile.data, me.data, spec, current, row, rows, addresses]);

  const change = (update: () => void) => {
    update();
    setDirty(true);
    setEdited(true);
  };

  const errors = useMemo(() => {
    if (row) return [rowErrors(spec, row)];
    if (rows) return rows.map((r) => rowErrors(spec, r));
    if (addresses) return [rowErrors(spec, addresses.current), addresses.same ? {} : rowErrors(spec, addresses.permanent)];
    return [];
  }, [row, rows, addresses, spec]);
  const statutoryEmpty = spec.section === 'statutory' && row ? Object.values(toPayload(spec, row, { dropEmpty: true })).length === 0 : false;
  const shareError = spec.section === 'nominees' && rows ? sharesProblem(rows.map((r) => ({ purpose: String(r.purpose ?? ''), share_percent: String(r.share_percent ?? '0') }))) : null;
  const reasonError = viaHr && !reason.trim() ? t('Say why, so HR can check it.') : null;
  const invalid = errors.some((e) => Object.keys(e).length) || Boolean(shareError) || Boolean(reasonError) || statutoryEmpty;

  const data = () => {
    if (spec.shape === 'list') return rows!.map((r) => toPayload(spec, r));
    if (spec.shape === 'addresses') {
      return {
        current: toPayload(spec, addresses!.current),
        permanent: addresses!.same ? null : toPayload(spec, addresses!.permanent),
        permanent_same_as_current: addresses!.same,
      };
    }
    return toPayload(spec, row!, { dropEmpty: spec.section === 'statutory' });
  };

  const save = useAction(
    async () => {
      if (spec.section === 'contact') return peopleApi.updateMe(data() as never);
      const changePayload = { section: spec.section, data: data() } as never;
      if (viaHr) return peopleApi.requestChange({ change: changePayload, reason: reason.trim() });
      return peopleApi.updateProfile({ change: changePayload });
    },
    {
      success: viaHr ? t('Sent to HR. Your record changes once they approve it.') : t('Saved'),
      invalidate: [['profile'], ['profile-basics'], ['change-requests']],
    },
  );

  if (profile.isPending || (spec.section === 'contact' && me.isPending)) return <Screen><SkeletonCard lines={5} /></Screen>;
  if (!profile.data) return <Screen><ErrorState error={profile.error} onRetry={() => void profile.refetch()} /></Screen>;

  const onRecord = (key: string) => {
    if (spec.section === 'statutory') return (current as Record<string, string | null> | undefined)?.[key] ?? null;
    if (spec.section === 'bank_account') {
      const bank = current as Record<string, string | null> | null;
      return key === 'account_number' ? bank?.account_number ?? bank?.account_number_masked ?? null : bank?.[key] ?? null;
    }
    return null;
  };

  return (
    <FormScreen
      tier="tier2"
      submitLabel={viaHr ? t('Send to HR') : t('Save')}
      dirty={dirty}
      onSubmit={async () => {
        setTouched(true);
        if (!edited) {
          // Nothing to send: HR would get a request that changes nothing.
          toast.info(t('Nothing has changed yet.'));
          return;
        }
        if (invalid) return;
        if (await save.run(undefined)) {
          setDirty(false);
          navigation.goBack();
        }
      }}
    >
      <Txt variant="displaySmall">{t(spec.title)}</Txt>
      {viaHr ? (
        <Notice tone="info" message={t('HR checks changes to this section. Your record changes once they approve it.')} />
      ) : null}

      {row ? (
        <Stack gap="row">
          {spec.fields.map((field) => (
            <View key={field.key} style={styles.field}>
              <FieldInput
                field={field}
                value={row[field.key] ?? null}
                onChange={(v) => change(() => setRow({ ...row, [field.key]: v }))}
                error={touched ? errors[0]?.[field.key] : undefined}
              />
              {onRecord(field.key) ? (
                <Txt variant="caption" tone="subtle">
                  {t('On record: {value}. Type a new one only to change it.', { value: onRecord(field.key)! })}
                </Txt>
              ) : null}
            </View>
          ))}
          {statutoryEmpty && touched ? <Notice tone="warning" message={t('Fill in at least one ID to change.')} /> : null}
        </Stack>
      ) : null}

      {addresses ? (
        <Stack gap="section">
          <Section title={t('Where you live now')}>
            {spec.fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={addresses.current[field.key] ?? null}
                onChange={(v) => change(() => setAddresses({ ...addresses, current: { ...addresses.current, [field.key]: v } }))}
                error={touched ? errors[0]?.[field.key] : undefined}
              />
            ))}
          </Section>
          <SwitchRow label={t('Permanent address is the same')} value={addresses.same} onChange={(same) => change(() => setAddresses({ ...addresses, same }))} />
          {!addresses.same ? (
            <Section title={t('Permanent address')}>
              {spec.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={addresses.permanent[field.key] ?? null}
                  onChange={(v) => change(() => setAddresses({ ...addresses, permanent: { ...addresses.permanent, [field.key]: v } }))}
                  error={touched ? errors[1]?.[field.key] : undefined}
                />
              ))}
            </Section>
          ) : null}
        </Stack>
      ) : null}

      {rows ? (
        <Stack gap="section">
          {rows.length === 0 ? <EmptyState inline spot={spec.spot} title={t('No {item} added yet', { item: t(spec.itemName ?? 'item') })} /> : null}
          {rows.map((item, index) => (
            <Card key={index}>
              <Stack gap="row">
                <View style={styles.itemHead}>
                  <Txt variant="headline" style={styles.flex}>
                    {String(item.name ?? item.qualification ?? item.employer ?? '') || t('New {item}', { item: t(spec.itemName ?? 'item') })}
                  </Txt>
                  <IconButton icon={Trash2} label={t('Remove')} onPress={() => change(() => setRows(rows.filter((_, i) => i !== index)))} />
                </View>
                {spec.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={item[field.key] ?? null}
                    onChange={(v) => change(() => setRows(rows.map((r, i) => (i === index ? { ...r, [field.key]: v } : r))))}
                    error={touched ? errors[index]?.[field.key] : undefined}
                  />
                ))}
              </Stack>
            </Card>
          ))}
          {shareError && touched ? <Notice tone="danger" message={t(shareError)} /> : null}
          <Button label={t('Add a {item}', { item: t(spec.itemName ?? 'item') })} icon={Plus} variant="secondary" onPress={() => change(() => setRows([...rows, emptyRow(spec)]))} fullWidth />
        </Stack>
      ) : null}

      {viaHr ? (
        <TextField
          label={t('Why the change?')}
          required
          value={reason}
          onChangeText={(v) => {
            setReason(v);
            setDirty(true);
          }}
          multiline
          maxLength={1000}
          error={touched ? reasonError : null}
        />
      ) : null}
    </FormScreen>
  );
}

// ── Change requests ──────────────────────────────────────────────────────────

/** "legal name and date of birth" -> "Legal name and date of birth". */
function sentence(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function ChangeRequestsScreen() {
  const requests = useQuery({ queryKey: ['change-requests'], queryFn: peopleApi.changeRequests });
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const withdraw = useAction((id: string) => peopleApi.withdrawChange(id), { success: t('Withdrawn'), invalidate: [['change-requests'], ['profile']] });
  return (
    <Screen onRefresh={() => requests.refetch()}>
      <QueryView
        query={requests}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState spot="sign" title={t('No change requests')} message={t('Changes to your bank, ID or address details are sent to HR and tracked here.')} />}
      >
        {(data) => (
          <Stack gap="row">
            {data.map((request) => {
              const changes = changeDiff(request.proposed, request.current_snapshot);
              return (
                <Card key={request.id}>
                  <Stack gap="tight">
                    <View style={styles.titleRow}>
                      <Txt variant="headline" style={styles.flex}>
                        {sentence(request.section_label)}
                      </Txt>
                      <StatusBadge status={request.status} />
                    </View>
                    <Txt variant="caption" tone="muted">
                      {formatDateTime(request.requested_at)}
                    </Txt>
                    {changes.map((c) => (
                      <KeyValue key={c.key} label={t(c.label)} value={`${c.from} → ${c.to}`} />
                    ))}
                    <Txt variant="callout" tone="muted">
                      {t('Your reason: “{reason}”', { reason: request.reason })}
                    </Txt>
                    {request.decision_note ? (
                      <Txt variant="callout">{t('HR: {note}', { note: request.decision_note })}</Txt>
                    ) : null}
                    {request.can_withdraw ? (
                      <View style={styles.actionsEnd}>
                        <Button label={t('Withdraw')} size="sm" variant="ghost" onPress={() => setWithdrawing(request.id)} />
                      </View>
                    ) : null}
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </QueryView>
      <ConfirmSheet
        open={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        title={t('Withdraw this change?')}
        message={t('HR will no longer see it. Your record stays as it is.')}
        confirmLabel={t('Withdraw')}
        tone="danger"
        onConfirm={async () => {
          const id = withdrawing;
          setWithdrawing(null);
          if (id) await withdraw.run(id);
        }}
      />
    </Screen>
  );
}

// ── Manager and team ─────────────────────────────────────────────────────────

export function OrgChartScreen() {
  const go = useGo();
  const { session } = useSession();
  const me = useQuery({ queryKey: ['profile-basics'], queryFn: peopleApi.me });
  const manager = useQuery({
    queryKey: ['people', 'employee', me.data?.manager_id],
    queryFn: () => peopleApi.employee(me.data!.manager_id!),
    enabled: Boolean(me.data?.manager_id),
  });
  const peers = useQuery({
    queryKey: ['people', 'reports', me.data?.manager_id],
    queryFn: () => peopleApi.list({ manager_id: me.data!.manager_id! }),
    enabled: Boolean(me.data?.manager_id),
  });
  const reports = useQuery({
    queryKey: ['people', 'reports', me.data?.id],
    queryFn: () => peopleApi.list({ manager_id: me.data!.id }),
    enabled: Boolean(me.data?.id && session?.user.is_manager),
  });

  return (
    <Screen tier="tier2" onRefresh={() => Promise.all([me.refetch(), manager.refetch(), peers.refetch(), reports.refetch()])}>
      <Section title={t('My manager')}>
        {me.isPending || (me.data?.manager_id && manager.isPending) ? (
          <SkeletonList rows={1} />
        ) : manager.data ? (
          <ListGroup>
            <ListRow
              leading={<Avatar name={personName(manager.data)} url={manager.data.photo_url} />}
              title={personName(manager.data)}
              subtitle={manager.data.designation ?? undefined}
              meta={manager.data.work_email}
              onPress={() => go('Colleague', { id: manager.data!.id })}
            />
          </ListGroup>
        ) : (
          <EmptyState inline spot="org" title={t('No manager is recorded for you')} />
        )}
      </Section>

      {reports.data?.items.length ? (
        <Section title={t('People who report to me')}>
          <ListGroup>
            {reports.data.items.map((p) => (
              <ListRow key={p.id} leading={<Avatar name={personName(p)} url={p.photo_url} />} title={personName(p)} subtitle={p.designation ?? undefined} onPress={() => go('Colleague', { id: p.id })} />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {peers.data ? (
        <Section title={t('My team')} description={t('Others who report to the same manager.')}>
          <ListGroup>
            {peers.data.items
              .filter((p) => p.id !== me.data?.id)
              .map((p) => (
                <ListRow key={p.id} leading={<Avatar name={personName(p)} url={p.photo_url} />} title={personName(p)} subtitle={p.designation ?? undefined} onPress={() => go('Colleague', { id: p.id })} />
              ))}
          </ListGroup>
        </Section>
      ) : null}
    </Screen>
  );
}

export function ColleagueScreen() {
  const { id } = useParams<{ id: string }>();
  const person = useQuery({ queryKey: ['people', 'employee', id], queryFn: () => peopleApi.employee(id!), enabled: Boolean(id) });
  return (
    <Screen tier="tier2" onRefresh={() => person.refetch()}>
      <QueryView query={person} skeleton={<SkeletonCard lines={4} />}>
        {(p) => (
          <Card variant="soft">
            <View style={styles.hero}>
              <Avatar name={personName(p)} url={p.photo_url} size={layout.avatarLg} />
              <Txt variant="displayMedium" align="center">
                {personName(p)}
              </Txt>
              <Txt variant="callout" tone="muted" align="center">
                {p.designation ?? ''}
              </Txt>
            </View>
            <Stack gap="tight">
              <KeyValue label={t('Work email')} value={p.work_email} />
              {p.phone ? <KeyValue label={t('Phone')} value={p.phone} /> : null}
              {p.date_of_joining ? <KeyValue label={t('Joined')} value={formatDate(p.date_of_joining)} /> : null}
            </Stack>
          </Card>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionsEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', gap: spacing.xs },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  cameraBadge: {
    position: 'absolute',
    right: -spacing.xs,
    bottom: -spacing.xs,
    width: layout.controlSmall - spacing.sm,
    height: layout.controlSmall - spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: spacing.xxs },
  itemHead: { flexDirection: 'row', alignItems: 'center' },
});
