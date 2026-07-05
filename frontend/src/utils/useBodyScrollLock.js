import { useEffect } from 'react';

// Locks page scroll while a modal is open. Modals scroll their own content;
// without this the page behind keeps scrolling (and Windows shows two
// scrollbars), so closing a modal can strand the user somewhere else.
export default function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}
