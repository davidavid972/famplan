import { useEffect } from 'react';
import { useToast } from '../context/ToastProvider';

export function DriveErrorListener() {
  const { showToast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ message: string }>;
      const msg = ev.detail?.message ?? 'Drive error';
      showToast(msg, 'error');
    };
    window.addEventListener('famplan-drive-write-error', handler);
    return () => window.removeEventListener('famplan-drive-write-error', handler);
  }, [showToast]);

  return null;
}
