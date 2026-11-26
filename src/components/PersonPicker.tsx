/**
 * Pick a colleague: a field that opens a sheet with a search box.
 * Searches colleagues in the person's company as they type (from two letters),
 * by name, and never offers the person themselves.
 */

import { useQuery } from '@tanstack/react-query';
import { Search, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { peopleApi } from '../api/people';
import { personName } from '../core/status';
import { t } from '../lib/i18n';
import { useUser } from '../lib/session';
import { useTheme } from '../theme/ThemeProvider';
import { layout, spacing } from '../theme/tokens';
import { Avatar } from './Avatar';
import { TextField } from './Field';
import { ListGroup, ListRow } from './List';
import { Sheet } from './Sheet';
import { useResetOnOpen } from './sheetContext';
import { SkeletonList } from './Skeleton';
import { Txt } from './Text';
import { Button } from './Button';

export interface PickedPerson {
  id: string;
  name: string;
  designation: string | null;
  photo_url: string | null;
}

function useDebounced(value: string, ms = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function PersonPicker({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  value: PickedPerson | null;
  onChange: (person: PickedPerson) => void;
  required?: boolean;
  error?: string | null;
}) {
  const { colors } = useTheme();
  const me = useUser();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useResetOnOpen(open, () => setQuery(''));
  const search = useDebounced(query.trim());
  const results = useQuery({
    queryKey: ['people', 'colleagues', search],
    queryFn: () => peopleApi.colleagues(search),
    enabled: open && search.length >= 2,
  });
  const people = (results.data ?? []).filter((p) => p.id !== me?.employee_id);

  return (
    <View style={styles.field}>
      <Txt variant="label" tone="muted">
        {label}
        {required ? ' *' : ''}
      </Txt>
      {value ? (
        <ListGroup>
          <ListRow
            leading={<Avatar name={value.name} url={value.photo_url} />}
            title={value.name}
            subtitle={value.designation ?? undefined}
            trailing={<Button label={t('Change')} size="sm" variant="ghost" onPress={() => setOpen(true)} />}
            chevron={false}
          />
        </ListGroup>
      ) : (
        <Button label={t('Choose a colleague')} icon={UserRound} variant="secondary" onPress={() => setOpen(true)} />
      )}
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <TextField
          label={t('Search by name')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="words"
          right={<Search size={layout.iconSm} color={colors.textMuted} />}
        />
        {search.length < 2 ? (
          <Txt variant="caption" tone="muted">
            {t('Type at least two letters.')}
          </Txt>
        ) : results.isPending ? (
          <SkeletonList rows={3} />
        ) : people.length ? (
          <ListGroup>
            {people.map((p) => (
              <ListRow
                key={p.id}
                leading={<Avatar name={personName(p)} url={p.photo_url} />}
                title={personName(p)}
                subtitle={p.designation ?? undefined}
                onPress={() => {
                  onChange({ id: p.id, name: personName(p), designation: p.designation, photo_url: p.photo_url });
                  setOpen(false);
                  setQuery('');
                }}
              />
            ))}
          </ListGroup>
        ) : (
          <Txt variant="callout" tone="muted">
            {t('Nobody found called “{name}”.', { name: search })}
          </Txt>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
});
