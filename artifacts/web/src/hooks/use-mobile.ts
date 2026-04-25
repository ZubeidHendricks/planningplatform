import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport width is below the given breakpoint.
 * Defaults to 768 (Tailwind's `md` breakpoint) for mobile detection.
 *
 * NOTE: For most layout work prefer Tailwind responsive prefixes (`md:`, `lg:`).
 * Use this hook only when you need JS-level awareness (e.g. toggling overlay sidebar).
 */
export function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Set initial value
    handleChange(mql);

    mql.addEventListener('change', handleChange as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handleChange as (e: MediaQueryListEvent) => void);
  }, [breakpoint]);

  return isMobile;
}
