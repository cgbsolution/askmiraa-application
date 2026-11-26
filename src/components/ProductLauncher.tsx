/**
 * A section a linked product has taken over (ExpenseGenie, CGB Helpdesk,
 * AnytimeHire). The records live there, so the app says so plainly and
 * opens the product in the system browser, signed in.
 */

import { ExternalLink } from 'lucide-react-native';
import { useState } from 'react';

import { PRODUCT_NAMES, productsApi } from '../api/products';
import type { ProductKey } from '../core/types';
import { t } from '../lib/i18n';
import { openInBrowser } from '../lib/links';
import { Button } from './Button';
import { Card } from './Card';
import { Stack } from './Screen';
import { describeError } from './States';
import { Txt } from './Text';
import { toast } from './Toast';

export function ProductLauncher({ product, what, to }: { product: ProductKey; what: string; to?: string }) {
  const [opening, setOpening] = useState(false);
  const name = PRODUCT_NAMES[product];
  return (
    <Card>
      <Stack gap="row">
        <Txt variant="headline">{t('Your company uses {name}', { name })}</Txt>
        <Txt variant="callout" tone="muted">
          {t('{what} are kept in {name}. It opens in your browser, already signed in.', { what, name })}
        </Txt>
        <Button
          label={t('Open {name}', { name })}
          icon={ExternalLink}
          variant="primary"
          loading={opening}
          onPress={async () => {
            if (opening) return;
            setOpening(true);
            try {
              const { url } = await productsApi.launch(product, to);
              await openInBrowser(url);
            } catch (error) {
              toast.error(describeError(error).message);
            } finally {
              setOpening(false);
            }
          }}
        />
      </Stack>
    </Card>
  );
}
