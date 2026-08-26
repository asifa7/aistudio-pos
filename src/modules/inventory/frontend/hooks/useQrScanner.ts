import { useEffect, useRef } from 'react';

/**
 * Custom hook to listen to HID Keyboard QR code scanners.
 * Detects rapid sequential keystrokes ending in Enter.
 */
export function useQrScanner(onScan: (scannedCode: string) => void, enabled = true) {
  const bufferRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // If user is actively typing in a non-search text input, ignore global scan unless rapid
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Real hardware QR scanner sends characters with <30ms delay
      if (delta > 80) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          const code = bufferRef.current.trim();
          bufferRef.current = '';
          if (code) {
            onScan(code);
            if (isInput) (target as HTMLElement).blur();
          }
        }
        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled]);
}
