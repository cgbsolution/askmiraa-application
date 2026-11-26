/**
 * Documents & letters: my documents (add one with the camera, HR verifies
 * it), company policies (read and acknowledge) and letters issued to me
 * (open the PDF, accept with my typed name, check it is intact).
 *
 * Lists are always asked for with the person's own employee id: for HR the
 * bare endpoints return everybody's.
 */

import { useFocusEffect } from '@react-navigation/native';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ChevronRight, Eye, FileSignature, FileText, Home, Plus, Search, Share2, ShieldCheck, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { documentsApi } from '../../api/documents';
import { AttachField } from '../../components/AttachField';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button, IconButton } from '../../components/Button';
import { Fab } from '../../components/Fab';
import { Card } from '../../components/Card';
import { DateField, SelectField, SwitchRow, TextField } from '../../components/Field';
import { KeyValue, ListGroup, ListRow, type ListRowProps } from '../../components/List';
import { Screen, Section, Stack } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState, NoEmployeeRecord, Notice, QueryView } from '../../components/States';
import { useResetOnOpen } from '../../components/sheetContext';
import { Txt } from '../../components/Text';
import { addDays, formatDate, todayISO } from '../../core/dates';
import { statusLabel } from '../../core/status';
import type { CompanyDocumentRead, DocumentRead, LetterRead } from '../../core/types';
import type { UploadFile } from '../../lib/api';
import { openDownloaded, shareDownloaded, type FileRules } from '../../lib/files';
import { t } from '../../lib/i18n';
import { useSession, useUser } from '../../lib/session';
import { useAction } from '../../lib/useAction';
import { useGo, useParams } from '../../navigation/navigate';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, spacing } from '../../theme/tokens';

/** What the server accepts: PDF, PNG or JPEG, up to the workspace upload limit (checked by content, not name). */
const DOCUMENT_FILES: FileRules = { types: ['image/jpeg', 'image/png', 'application/pdf'] };

const LETTER_LABEL: Record<string, string> = {
  offer: 'Offer letter',
  appointment: 'Appointment letter',
  confirmation: 'Confirmation letter',
  transfer: 'Transfer letter',
  promotion: 'Promotion letter',
  relieving: 'Relieving letter',
  experience: 'Experience letter',
  salary_certificate: 'Salary certificate',
  warning: 'Warning letter',
  pip: 'Performance improvement plan',
  custom: 'Letter',
};

const DOCUMENT_CATEGORY: Record<string, string> = {
  id_proof: 'Identity proof',
  address_proof: 'Address proof',
  education: 'Education',
  experience: 'Previous employment',
  contract: 'Contract',
  offer_letter: 'Offer letter',
  policy_ack: 'Policy acknowledgement',
  payslip: 'Payslip',
  tax: 'Tax',
  medical: 'Medical',
  bank: 'Bank proof',
  all_documents: 'All documents (ZIP)',
  other: 'Other',
};

function categoryName(value: string): string {
  return t(DOCUMENT_CATEGORY[value] ?? statusLabel(value));
}

function useEmployeeId(): string | null {
  return useUser()?.employee_id ?? null;
}

function useOpen() {
  const [opening, setOpening] = useState<string | null>(null);
  const open = async (key: string, path: string, filename: string, mime?: string | null) => {
    if (opening) return;
    setOpening(key);
    await openDownloaded(path, filename, mime ?? undefined);
    setOpening(null);
  };
  return { opening, open };
}

function verificationTone(status: string): string {
  return status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : status === 'pending' ? 'in_review' : status;
}

type Place = { root: null } | { root: 'company' | 'personal'; folder: string | null };

/**
 * Documents, as folders — the older HRMS's "Plug Me": Company files and
 * Personal files, a folder per kind, the files inside. Search finds a file
 * by name anywhere. Hardware Back climbs one folder before it leaves.
 */
export function DocumentsScreen() {
  const go = useGo();
  const { colors } = useTheme();
  const { can } = useSession();
  const employeeId = useEmployeeId();
  const mine = useQuery({ queryKey: ['documents', 'mine', employeeId], queryFn: () => documentsApi.mine(employeeId!), enabled: Boolean(employeeId) });
  const company = useQuery({ queryKey: ['documents', 'company'], queryFn: documentsApi.company, enabled: can('policies') });
  const letters = useLetters();
  const [place, setPlace] = useState<Place>({ root: null });
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const { opening, open } = useOpen();

  // Back climbs a folder before leaving the screen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (place.root === null) return false;
        setPlace(place.folder ? { root: place.root, folder: null } : { root: null });
        return true;
      });
      return () => sub.remove();
    }, [place]),
  );

  const personalFolders = useMemo(() => groupBy(mine.data ?? [], (d) => categoryName(d.category)), [mine.data]);
  const companyFolders = useMemo(() => groupBy(company.data ?? [], (d) => t(statusLabel(d.document_type))), [company.data]);
  const visibleLetters = (letters.data ?? []).filter(letterVisible);

  const q = query.trim().toLowerCase();
  const found = q
    ? [
        ...(mine.data ?? []).filter((d) => d.title.toLowerCase().includes(q) || categoryName(d.category).toLowerCase().includes(q)).map((d) => ({ kind: 'personal' as const, doc: d })),
        ...(company.data ?? []).filter((d) => d.title.toLowerCase().includes(q) || statusLabel(d.document_type).toLowerCase().includes(q)).map((d) => ({ kind: 'company' as const, doc: d })),
      ]
    : [];

  const openPersonal = (doc: DocumentRead) => void open(doc.id, documentsApi.downloadPath(doc.id), doc.title, doc.mime_type);
  const openCompany = (doc: CompanyDocumentRead) => void open(doc.id, documentsApi.companyPath(doc.id), doc.title, doc.mime_type);

  const crumbs = [
    { label: t('Documents'), onPress: () => setPlace({ root: null }) },
    ...(place.root ? [{ label: place.root === 'company' ? t('Company files') : t('Personal files'), onPress: () => setPlace({ root: place.root, folder: null }) }] : []),
    ...(place.root && place.folder ? [{ label: place.folder, onPress: () => {} }] : []),
  ];

  return (
    <Screen
      onRefresh={() => Promise.all([mine.refetch(), company.refetch(), letters.refetch()])}
      overlay={employeeId ? <Fab icon={Plus} label={t('Add a document')} onPress={() => setAdding(true)} /> : undefined}
    >
      <TextField
        label={t('Search files')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('Aadhaar, PAN, leave policy…')}
        autoCorrect={false}
        right={query ? <IconButton icon={X} label={t('Clear search')} onPress={() => setQuery('')} /> : <Search size={layout.icon} color={colors.textSubtle} />}
      />

      {q ? (
        found.length === 0 ? (
          <EmptyState spot="search" title={t('No file called that')} message={t('Try part of the name, or the kind of document.')} />
        ) : (
          <ListGroup>
            {found.map((hit) =>
              hit.kind === 'personal' ? (
                <FileRow key={`p-${hit.doc.id}`} title={hit.doc.title} meta={`${t('Personal files')} › ${categoryName(hit.doc.category)}`} busy={opening === hit.doc.id} onOpen={() => openPersonal(hit.doc)} sharePath={documentsApi.downloadPath(hit.doc.id)} mime={hit.doc.mime_type} />
              ) : (
                <FileRow key={`c-${hit.doc.id}`} title={hit.doc.title} meta={`${t('Company files')} › ${t(statusLabel(hit.doc.document_type))}`} busy={opening === hit.doc.id} onOpen={() => openCompany(hit.doc)} sharePath={documentsApi.companyPath(hit.doc.id)} mime={hit.doc.mime_type} />
              ),
            )}
          </ListGroup>
        )
      ) : (
        <>
          <View style={styles.crumbs} accessibilityRole="header">
            <Home size={layout.iconSm + 2} color={colors.primaryText} />
            {crumbs.map((crumb, index) => (
              <View key={crumb.label} style={styles.crumb}>
                {index > 0 ? <ChevronRight size={layout.iconSm} color={colors.textSubtle} /> : null}
                <Txt
                  variant={index === crumbs.length - 1 ? 'calloutStrong' : 'callout'}
                  tone={index === crumbs.length - 1 ? 'default' : 'primary'}
                  onPress={index === crumbs.length - 1 ? undefined : crumb.onPress}
                  suppressHighlighting
                  numberOfLines={1}
                >
                  {crumb.label}
                </Txt>
              </View>
            ))}
          </View>

          {place.root === null ? (
            <>
              <ListGroup>
                {can('policies') ? (
                  <FolderRow name={t('Company files')} detail={t('Policies and handbooks for everyone')} count={company.data?.length} onPress={() => setPlace({ root: 'company', folder: null })} />
                ) : null}
                {employeeId ? (
                  <FolderRow name={t('Personal files')} detail={t('Your ID, certificates and proofs')} count={mine.data?.length} onPress={() => setPlace({ root: 'personal', folder: null })} />
                ) : null}
                {can('letters') ? <FolderRow name={t('Letters')} spot="mail" detail={t('Letters HR has issued to you')} count={visibleLetters.length} onPress={() => go('Letters')} /> : null}
              </ListGroup>
              {can('policies') ? (
                <ListGroup>
                  <ListRow spot="book" title={t('Policies to acknowledge')} subtitle={t('Read and confirm company policies')} onPress={() => go('CompanyPolicies')} />
                </ListGroup>
              ) : null}
              {!employeeId ? <NoEmployeeRecord what={t('Documents')} /> : null}
            </>
          ) : place.folder === null ? (
            <QueryView
              query={(place.root === 'company' ? company : mine) as unknown as UseQueryResult<unknown[]>}
              skeleton={<SkeletonList rows={4} />}
              isEmpty={(d) => d.length === 0}
              empty={
                <EmptyState
                  inline
                  spot="folder"
                  title={place.root === 'company' ? t('No company files yet') : t('No personal files yet')}
                  message={place.root === 'company' ? t('Policies HR shares with everyone show here.') : t('Add your ID, certificates or bank proof. HR checks each one.')}
                  action={place.root === 'personal' ? { label: t('Add a document'), onPress: () => setAdding(true) } : undefined}
                />
              }
            >
              {() => (
                <ListGroup>
                  {[...(place.root === 'company' ? companyFolders : personalFolders).entries()].map(([name, items]) => (
                    <FolderRow key={name} name={name} count={items.length} onPress={() => setPlace({ root: place.root, folder: name })} />
                  ))}
                </ListGroup>
              )}
            </QueryView>
          ) : place.root === 'company' ? (
            <ListGroup>
              {(companyFolders.get(place.folder) ?? []).map((doc) => (
                <FileRow
                  key={doc.id}
                  title={doc.title}
                  meta={[doc.issued_on ? formatDate(doc.issued_on) : null, doc.requires_acknowledgement ? (doc.acknowledged_by_me ? t('Acknowledged') : t('To acknowledge')) : null].filter(Boolean).join(' · ') || undefined}
                  busy={opening === doc.id}
                  onOpen={() => openCompany(doc)}
                  sharePath={documentsApi.companyPath(doc.id)}
                  mime={doc.mime_type}
                />
              ))}
            </ListGroup>
          ) : (
            <ListGroup>
              {(personalFolders.get(place.folder) ?? []).map((doc) => (
                <FileRow
                  key={doc.id}
                  title={doc.title}
                  meta={[doc.is_expired ? t('Expired') : t(statusLabel(verificationTone(doc.verification_status))), doc.valid_until ? t('valid until {date}', { date: formatDate(doc.valid_until) }) : null].filter(Boolean).join(' · ')}
                  note={doc.verification_note ?? undefined}
                  busy={opening === doc.id}
                  onOpen={() => openPersonal(doc)}
                  sharePath={documentsApi.downloadPath(doc.id)}
                  mime={doc.mime_type}
                />
              ))}
            </ListGroup>
          )}
        </>
      )}
      <AddDocumentSheet open={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function FolderRow({ name, detail, count, spot = 'folder', onPress }: { name: string; detail?: string; count?: number; spot?: ListRowProps['spot']; onPress: () => void }) {
  return (
    <ListRow
      spot={spot}
      title={name}
      subtitle={detail}
      value={count !== undefined ? String(count) : undefined}
      valueTone="muted"
      onPress={onPress}
    />
  );
}

/** A file: tap to open it; the share button sends it on (WhatsApp, email…). */
function FileRow({
  title,
  meta,
  note,
  busy,
  onOpen,
  sharePath,
  mime,
}: {
  title: string;
  meta?: string;
  note?: string;
  busy: boolean;
  onOpen: () => void;
  sharePath: string;
  mime?: string | null;
}) {
  const [sharing, setSharing] = useState(false);
  return (
    <ListRow
      icon={FileText}
      title={title}
      subtitle={meta}
      meta={note}
      chevron={false}
      onPress={onOpen}
      trailing={
        <View style={styles.fileActions}>
          {busy ? <Badge label={t('Opening…')} tone="neutral" /> : <IconButton icon={Eye} label={t('View {title}', { title })} onPress={onOpen} />}
          <IconButton
            icon={Share2}
            label={t('Share {title}', { title })}
            disabled={sharing}
            onPress={async () => {
              setSharing(true);
              await shareDownloaded(sharePath, title, mime ?? 'application/pdf');
              setSharing(false);
            }}
          />
        </View>
      }
    />
  );
}

function AddDocumentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useQuery({ queryKey: ['documents', 'self-upload'], queryFn: documentsApi.selfUploadCategories, enabled: open, staleTime: 30 * 60_000 });
  const today = todayISO();
  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [file, setFile] = useState<UploadFile | null>(null);
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setCategory(null);
    setTitle('');
    setNumber('');
    setIssued(null);
    setValidUntil(null);
    setFile(null);
    setTouched(false);
  });
  const errors = {
    category: !category ? t('Choose what kind of document it is.') : null,
    title: !title.trim() ? t('Give it a name, like “PAN card”.') : null,
    file: !file ? t('Attach the document.') : null,
    valid: issued && validUntil && validUntil < issued ? t('It cannot expire before it was issued.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const save = useAction(
    () =>
      documentsApi.uploadMine(
        {
          category: category!,
          title: title.trim(),
          document_number: number.trim() || undefined,
          issued_on: issued ?? undefined,
          valid_until: validUntil ?? undefined,
        },
        file!,
      ),
    {
      success: t('Added. HR will verify it.'),
      invalidate: [['documents']],
      onSuccess: () => {
        setCategory(null);
        setTitle('');
        setNumber('');
        setIssued(null);
        setValidUntil(null);
        setFile(null);
        setTouched(false);
        onClose();
      },
    },
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Add a document')}
      scrollable
      dirty={Boolean(category || title || number || issued || validUntil || file)}
      footer={
        <Button
          label={t('Add document')}
          variant="accent"
          loading={save.pending}
          onPress={() => {
            setTouched(true);
            if (!invalid) void save.run(undefined);
          }}
          fullWidth
        />
      }
    >
      {categories.error ? <ErrorState error={categories.error} onRetry={() => void categories.refetch()} /> : null}
      <SelectField
        label={t('Kind of document')}
        required
        value={category}
        options={(categories.data ?? []).map((c) => ({ value: c.value, label: c.label }))}
        onChange={(value) => {
          setCategory(value);
          if (!title.trim()) setTitle((categories.data ?? []).find((c) => c.value === value)?.label ?? '');
        }}
        error={touched ? errors.category : null}
      />
      <TextField label={t('Name')} required value={title} onChangeText={setTitle} maxLength={255} error={touched ? errors.title : null} />
      <TextField label={t('Document number')} value={number} onChangeText={setNumber} maxLength={64} autoCapitalize="characters" placeholder={t('Optional')} />
      <DateField label={t('Issued on')} value={issued} onChange={setIssued} maximumDate={today} placeholder={t('Optional')} />
      <DateField label={t('Valid until')} value={validUntil} onChange={setValidUntil} minimumDate={issued ?? addDays(today, -3650)} placeholder={t('Optional')} error={errors.valid} />
      <AttachField label={t('File')} required value={file} onChange={setFile} rules={DOCUMENT_FILES} error={touched ? errors.file : null} />
    </Sheet>
  );
}

export function CompanyPoliciesScreen() {
  const docs = useQuery({ queryKey: ['documents', 'company'], queryFn: documentsApi.company });
  const [acknowledging, setAcknowledging] = useState<CompanyDocumentRead | null>(null);
  const { opening, open } = useOpen();
  return (
    <Screen onRefresh={() => docs.refetch()}>
      <QueryView
        query={docs}
        skeleton={<SkeletonList rows={5} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState spot="book" title={t('No company documents')} message={t('Policies HR shares with everyone show here.')} />}
      >
        {(data) => {
          const toAck = data.filter((d) => d.requires_acknowledgement && !d.acknowledged_by_me);
          return (
            <>
              {toAck.length ? <Notice tone="warning" message={t('{count} to read and acknowledge.', { count: toAck.length })} /> : null}
              <Stack gap="row">
                {data.map((doc) => (
                  <Card key={doc.id}>
                    <Stack gap="tight">
                      <View style={styles.titleRow}>
                        <Txt variant="headline" style={styles.flex}>
                          {doc.title}
                        </Txt>
                        {doc.requires_acknowledgement ? (
                          doc.acknowledged_by_me ? <Badge label={t('Acknowledged')} tone="success" /> : <Badge label={t('To acknowledge')} tone="warning" />
                        ) : null}
                      </View>
                      <Txt variant="caption" tone="muted">
                        {[statusLabel(doc.document_type), doc.issued_on ? formatDate(doc.issued_on) : null].filter(Boolean).join(' · ')}
                      </Txt>
                      {doc.remark ? (
                        <Txt variant="callout" tone="muted">
                          {doc.remark}
                        </Txt>
                      ) : null}
                      <View style={styles.actions}>
                        <Button
                          label={t('Read')}
                          size="sm"
                          variant="secondary"
                          loading={opening === doc.id}
                          onPress={() => void open(doc.id, documentsApi.companyPath(doc.id), doc.title, doc.mime_type)}
                        />
                        {doc.requires_acknowledgement && !doc.acknowledged_by_me ? (
                          <Button label={t('Acknowledge')} size="sm" variant="primary" onPress={() => setAcknowledging(doc)} />
                        ) : null}
                      </View>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </>
          );
        }}
      </QueryView>
      <TypedNameSheet
        open={acknowledging !== null}
        onClose={() => setAcknowledging(null)}
        title={t('Acknowledge {title}', { title: acknowledging?.title ?? '' })}
        statement={t('I have read and understood this document.')}
        confirmLabel={t('Acknowledge')}
        onConfirm={(name) => documentsApi.acknowledgeCompany(acknowledging!.id, name)}
        success={t('Acknowledged')}
      />
    </Screen>
  );
}

/** Sign by typing your name, as the record has it, and ticking a statement. */
function TypedNameSheet({
  open,
  onClose,
  title,
  statement,
  confirmLabel,
  onConfirm,
  success,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  statement: string;
  confirmLabel: string;
  onConfirm: (typedName: string) => Promise<unknown>;
  success: string;
}) {
  const user = useUser();
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState(false);
  useResetOnOpen(open, () => {
    setName('');
    setAgreed(false);
    setTouched(false);
  });
  const errors = {
    name: !name.trim() ? t('Type your full name.') : null,
    agreed: !agreed ? t('Tick to confirm.') : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const act = useAction((typed: string) => onConfirm(typed), {
    success,
    invalidate: [['documents'], ['letters']],
    onSuccess: () => {
      setName('');
      setAgreed(false);
      setTouched(false);
      onClose();
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      scrollable
      dirty={Boolean(name || agreed)}
      footer={
        <Button
          label={confirmLabel}
          variant="primary"
          loading={act.pending}
          onPress={() => {
            setTouched(true);
            if (!invalid) void act.run(name.trim());
          }}
          fullWidth
        />
      }
    >
      <TextField
        label={t('Your full name')}
        required
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={255}
        helper={user?.full_name ? t('As it is on your record: {name}', { name: user.full_name }) : undefined}
        error={touched ? errors.name : null}
      />
      <SwitchRow label={statement} value={agreed} onChange={setAgreed} />
      {touched && errors.agreed ? (
        <Txt variant="caption" tone="danger">
          {errors.agreed}
        </Txt>
      ) : null}
    </Sheet>
  );
}

function useLetters() {
  const employeeId = useEmployeeId();
  return useQuery({ queryKey: ['letters', employeeId], queryFn: () => documentsApi.letters(employeeId!), enabled: Boolean(employeeId) });
}

/** Issued to the person: HR approved it (that issues it), emailed it, or it was signed. Drafts stay with HR. */
function letterVisible(letter: LetterRead): boolean {
  return ['approved', 'sent', 'signed', 'revoked'].includes(letter.status);
}

export function LettersScreen() {
  const go = useGo();
  const employeeId = useEmployeeId();
  const letters = useLetters();
  if (!employeeId) {
    return (
      <Screen>
        <NoEmployeeRecord what={t('Letters')} />
      </Screen>
    );
  }
  return (
    <Screen onRefresh={() => letters.refetch()}>
      <QueryView
        query={letters}
        skeleton={<SkeletonList rows={4} />}
        isEmpty={(d) => d.filter(letterVisible).length === 0}
        empty={<EmptyState spot="mail" title={t('No letters yet')} message={t('Appointment, confirmation and other letters HR issues to you show here.')} />}
      >
        {(data) => (
          <ListGroup>
            {data.filter(letterVisible).map((letter) => (
              <ListRow
                key={letter.id}
                icon={FileSignature}
                title={t(LETTER_LABEL[letter.category] ?? 'Letter')}
                subtitle={[letter.reference_number, letter.issued_at ? formatDate(letter.issued_at) : null].filter(Boolean).join(' · ')}
                trailing={
                  letter.status === 'revoked' ? (
                    <Badge label={t('Withdrawn')} tone="neutral" />
                  ) : letter.can_acknowledge ? (
                    <Badge label={t('To accept')} tone="warning" />
                  ) : letter.acknowledged_at ? (
                    <Badge label={t('Accepted')} tone="success" />
                  ) : null
                }
                onPress={() => go('LetterDetail', { id: letter.id })}
              />
            ))}
          </ListGroup>
        )}
      </QueryView>
    </Screen>
  );
}

export function LetterDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const letters = useLetters();
  const [accepting, setAccepting] = useState(false);
  const { opening, open } = useOpen();
  const verify = useQuery({ queryKey: ['letters', 'verify', id], queryFn: () => documentsApi.verifyLetter(id!), enabled: false, retry: false });

  if (letters.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={5} />
      </Screen>
    );
  }
  if (!letters.data) {
    return (
      <Screen>
        <ErrorState error={letters.error} onRetry={() => void letters.refetch()} />
      </Screen>
    );
  }
  const letter = letters.data.find((l) => l.id === id);
  if (!letter) {
    return (
      <Screen>
        <EmptyState spot="mail" title={t('Letter not found')} message={t('It may have been withdrawn, or it was issued to someone else.')} />
      </Screen>
    );
  }
  const name = t(LETTER_LABEL[letter.category] ?? 'Letter');
  const file = `${letter.reference_number.replace(/\W+/g, '-')}.pdf`;

  return (
    <Screen onRefresh={() => letters.refetch()}>
      <Card>
        <Stack gap="row">
          <View style={styles.titleRow}>
            <Txt variant="title" style={styles.flex}>
              {name}
            </Txt>
            {letter.status === 'revoked' ? <Badge label={t('Withdrawn')} tone="neutral" /> : <StatusBadge status={letter.status === 'approved' || letter.status === 'sent' ? 'issued' : letter.status} />}
          </View>
          <KeyValue label={t('Reference')} value={letter.reference_number} />
          {letter.issued_at ? <KeyValue label={t('Issued')} value={formatDate(letter.issued_at)} /> : null}
          {letter.signed_at ? <KeyValue label={t('Signed')} value={formatDate(letter.signed_at)} /> : null}
          {letter.acknowledged_at ? <KeyValue label={t('You accepted it')} value={formatDate(letter.acknowledged_at)} /> : null}
          {letter.revoked_reason ? <Notice tone="info" message={t('Withdrawn: {reason}', { reason: letter.revoked_reason })} /> : null}
        </Stack>
      </Card>

      {letter.has_pdf ? (
        <Stack gap="inline">
          <Button
            label={letter.has_signed_pdf ? t('Open signed copy') : t('Open letter')}
            icon={FileText}
            variant="primary"
            loading={opening === 'pdf'}
            onPress={() => void open('pdf', `${documentsApi.letterPdfPath(letter.id)}${letter.has_signed_pdf ? '?signed=true' : ''}`, file, 'application/pdf')}
            fullWidth
          />
        </Stack>
      ) : (
        <Notice tone="info" message={t('The PDF is not ready yet.')} />
      )}

      {letter.can_acknowledge ? (
        <Card variant="soft">
          <Stack gap="inline">
            <Txt variant="headline">{t('HR has asked you to accept this letter')}</Txt>
            <Txt variant="callout" tone="muted">
              {t('Read it first. Accepting records your typed name and the exact version you read.')}
            </Txt>
            <Button label={t('Accept letter')} variant="accent" onPress={() => setAccepting(true)} />
          </Stack>
        </Card>
      ) : null}

      <Section title={t('Is this copy genuine?')}>
        <Card variant="sunken">
          <Stack gap="inline">
            <Txt variant="callout" tone="muted">
              {t('Checks the letter on file still matches the one that was issued.')}
            </Txt>
            {verify.data ? (
              <Badge label={verify.data.intact ? t('Intact — unchanged since issue') : t('Does not match — contact HR')} tone={verify.data.intact ? 'success' : 'danger'} />
            ) : null}
            {verify.error ? <ErrorState error={verify.error} /> : null}
            <Button label={t('Check')} icon={ShieldCheck} size="sm" variant="secondary" loading={verify.isFetching} onPress={() => void verify.refetch()} />
          </Stack>
        </Card>
      </Section>

      <TypedNameSheet
        open={accepting}
        onClose={() => setAccepting(false)}
        title={t('Accept {name}', { name })}
        statement={t('I have read this letter and accept it.')}
        confirmLabel={t('Accept')}
        onConfirm={(typed) => documentsApi.acknowledgeLetter(letter.id, typed, true)}
        success={t('Letter accepted')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  crumbs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '70%' },
  fileActions: { flexDirection: 'row', alignItems: 'center' },
});

