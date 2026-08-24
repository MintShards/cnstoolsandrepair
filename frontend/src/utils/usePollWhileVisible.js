import { useEffect, useRef } from 'react';

/**
 * setInterval that skips ticks while the browser tab is hidden.
 *
 * The Workspace polls to stay in sync, but a hidden tab must not act on the
 * user's behalf — the feed poll marks messages read ("seen by"), which would
 * claim someone saw a post while their tab sat in the background overnight.
 * Skipping hidden ticks also spares the pointless Atlas round trips.
 *
 * Freshness on return is handled elsewhere: Workspace.jsx listens for
 * focus/visibilitychange and bumps focusTick, which makes every mounted
 * section refetch immediately — so a skipped tick never means stale data
 * once the user is actually looking.
 *
 * The callback rides a ref so a new identity (filter changes re-create the
 * loaders every render) doesn't reset the timer.
 */
export default function usePollWhileVisible(callback, ms) {
  const savedRef = useRef(callback);
  useEffect(() => { savedRef.current = callback; });

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      savedRef.current();
    }, ms);
    return () => clearInterval(interval);
  }, [ms]);
}
