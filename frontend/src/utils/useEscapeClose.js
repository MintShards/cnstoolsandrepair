import { useEffect } from 'react';

// Escape dismisses the dialog — same handler as the close/cancel button.
// Every modal in the sales area uses this so keyboard users aren't trapped.
export default function useEscapeClose(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
