import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface NavigationContextType {
  currentPath: string;
  currentSearch: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function normalizePathname(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean;
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    normalizePathname(window.location.pathname)
  );
  const [currentSearch, setCurrentSearch] = useState<string>(() => window.location.search);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    // Preserve query parameters, hash, and path
    const url = new URL(to, window.location.origin);
    const targetPath = normalizePathname(url.pathname);
    const fullTarget = targetPath + url.search + url.hash;
    const currentFull =
      normalizePathname(window.location.pathname) + window.location.search + window.location.hash;

    if (fullTarget !== currentFull) {
      if (options?.replace) {
        window.history.replaceState(null, '', fullTarget);
      } else {
        window.history.pushState(null, '', fullTarget);
      }
    }

    setCurrentPath(targetPath);
    setCurrentSearch(url.search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePathname(window.location.pathname));
      setCurrentSearch(window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Skip external links, modified clicks, download, or explicit targets
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#')
      ) {
        return;
      }

      // Intercept relative and absolute internal paths
      if (href.startsWith('/')) {
        e.preventDefault();
        navigate(href);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [navigate]);

  return (
    <NavigationContext.Provider value={{ currentPath, currentSearch, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigate = (): ((to: string, options?: { replace?: boolean }) => void) => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    return (to: string, options?: { replace?: boolean }) => {
      const url = new URL(to, window.location.origin);
      const fullTarget = normalizePathname(url.pathname) + url.search + url.hash;
      if (options?.replace) {
        window.history.replaceState(null, '', fullTarget);
      } else {
        window.history.pushState(null, '', fullTarget);
      }
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
  }
  return ctx.navigate;
};

export const useNavigation = (): NavigationContextType => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    return {
      currentPath: normalizePathname(window.location.pathname),
      currentSearch: window.location.search,
      navigate: (to: string, options?: { replace?: boolean }) => {
        const url = new URL(to, window.location.origin);
        const fullTarget = normalizePathname(url.pathname) + url.search + url.hash;
        if (options?.replace) {
          window.history.replaceState(null, '', fullTarget);
        } else {
          window.history.pushState(null, '', fullTarget);
        }
        window.dispatchEvent(new PopStateEvent('popstate'));
      },
    };
  }
  return ctx;
};
