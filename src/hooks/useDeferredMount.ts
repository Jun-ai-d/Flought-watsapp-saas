import { useEffect, useState } from 'react';

/** Defer mounting heavy below-the-fold UI until the browser is idle. */
export function useDeferredMount(timeoutMs = 2000) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => setReady(true), { timeout: timeoutMs });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  return ready;
}
