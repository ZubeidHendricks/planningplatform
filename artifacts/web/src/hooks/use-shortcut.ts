import { useEffect, useCallback } from 'react';
import { useShortcutStore } from '@/lib/shortcuts';

export function useShortcut(
  id: string,
  keys: string,
  description: string,
  category: string,
  handler: () => void,
  deps: React.DependencyList = [],
) {
  const register = useShortcutStore((s) => s.registerShortcut);
  const unregister = useShortcutStore((s) => s.unregisterShortcut);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableHandler = useCallback(handler, deps);

  useEffect(() => {
    register({ id, keys, description, category, handler: stableHandler });
    return () => unregister(id);
  }, [id, keys, description, category, stableHandler, register, unregister]);
}
