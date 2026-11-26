/**
 * A write to the server from a screen: one place for the success toast, the
 * error message, the haptic tick and refreshing what changed.
 *
 * `run()` returns the result, or undefined when it failed (the error is
 * already shown). A second call while one is in flight is ignored, so a
 * double tap cannot send twice.
 */

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';

import { describeError } from '../components/States';
import { toast } from '../components/Toast';
import { OfflineError } from './api';
import { t } from './i18n';

export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  options: {
    success?: string | ((result: TResult, args: TArgs) => string);
    invalidate?: QueryKey[];
    onSuccess?: (result: TResult) => void;
    /** Show errors inline instead of as a toast. */
    quietErrors?: boolean;
  } = {},
) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const message = typeof options.success === 'function' ? options.success(result, args) : options.success;
      if (message) toast.success(message);
      for (const key of options.invalidate ?? []) void queryClient.invalidateQueries({ queryKey: key });
      options.onSuccess?.(result);
    },
    onError: (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (options.quietErrors) return;
      // Pulling down does not resend a form: say what happened to the action.
      if (error instanceof OfflineError) toast.error(t('You are offline, so nothing was sent. Try again when you have signal — what you entered is kept.'));
      else toast.error(describeError(error).message);
    },
  });
  return {
    run: async (args: TArgs): Promise<TResult | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      try {
        return await mutation.mutateAsync(args);
      } catch {
        return undefined;
      } finally {
        inFlight.current = false;
      }
    },
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
