export interface CallbackSession {
  access_token: string;
  refresh_token?: string;
  user?: {
    email?: string;
    email_confirmed_at?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface CallbackUser {
  email?: string;
  email_confirmed_at?: string | null;
  [key: string]: unknown;
}

export interface CallbackAuthClient {
  getSession: () => Promise<{ data?: { session?: CallbackSession | null }; error?: { message?: string } | null }>;
  exchangeCodeForSession: (code: string) => Promise<{
    data?: { session?: CallbackSession | null };
    error?: { message?: string } | null;
  }>;
  verifyOtp: (params: Record<string, string>) => Promise<{
    data?: { session?: CallbackSession | null; user?: CallbackUser | null };
    error?: { message?: string } | null;
  }>;
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{
    data?: { session?: CallbackSession | null; user?: CallbackUser | null };
    error?: { message?: string } | null;
  }>;
  getUser: () => Promise<{
    data?: { user?: CallbackUser | null };
    error?: { message?: string } | null;
  }>;
}

export interface AuthCallbackResult {
  session?: CallbackSession;
  user?: CallbackUser;
  error?: string;
  unverifiedEmail?: string;
}

export interface AuthCallbackParams {
  error?: string;
  code?: string;
  tokenHash?: string;
  token?: string;
  type?: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
}

export function parseAuthCallbackParams(href: string): AuthCallbackParams {
  const url = new URL(href);
  const query = url.searchParams;
  const rawFragment = url.hash.replace(/^#/, '');
  const fragmentQuery = rawFragment.includes('?')
    ? rawFragment.slice(rawFragment.indexOf('?') + 1)
    : rawFragment;
  const fragment = new URLSearchParams(fragmentQuery);
  const value = (key: string) => query.get(key) || fragment.get(key) || undefined;

  return {
    error: value('error_description') || value('error') || value('error_code'),
    code: query.get('code') || undefined,
    tokenHash: value('token_hash'),
    token: value('token'),
    type: value('type'),
    email: value('email'),
    accessToken: value('access_token'),
    refreshToken: value('refresh_token'),
  };
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Authentication callback timed out. Please try again or request a fresh verification email.')),
      timeoutMs,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

async function resolveAuthCallback(
  params: AuthCallbackParams,
  auth: CallbackAuthClient,
  timeoutMs: number,
): Promise<AuthCallbackResult> {
  try {
    return await withDeadline((async () => {
      if (params.error) return { error: params.error };

      let session: CallbackSession | null | undefined;
      let user: CallbackUser | null | undefined;

      if (params.tokenHash && params.type) {
        const verified = await auth.verifyOtp({ token_hash: params.tokenHash, type: params.type });
        if (verified.error) return { error: verified.error.message || 'The verification link could not be confirmed.' };
        session = verified.data?.session;
        user = verified.data?.user;
      } else if (params.token && params.type && params.email) {
        const verified = await auth.verifyOtp({
          email: params.email,
          token: params.token,
          type: params.type,
        });
        if (verified.error) return { error: verified.error.message || 'The verification link could not be confirmed.' };
        session = verified.data?.session;
        user = verified.data?.user;
      } else {
        // With detectSessionInUrl enabled, supabase-js consumes the normal
        // confirmation/OAuth redirect (implicit fragment or PKCE code) during
        // client initialization. getSession waits for that initialization.
        const restored = await auth.getSession();
        session = restored.data?.session;
        if (restored.error && !params.code && !(params.accessToken && params.refreshToken)) {
          return { error: restored.error.message || 'The authentication session could not be restored.' };
        }

        if (!session && params.code) {
          const exchanged = await auth.exchangeCodeForSession(params.code);
          if (exchanged.error) return { error: exchanged.error.message || 'The sign-in code is invalid or expired.' };
          session = exchanged.data?.session;
        }

        if (!session && params.accessToken && params.refreshToken) {
          const restoredTokens = await auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          if (restoredTokens.error) {
            return { error: restoredTokens.error.message || 'The sign-in tokens are invalid or expired.' };
          }
          session = restoredTokens.data?.session;
          user = restoredTokens.data?.user;
        }
      }

      if (!session?.access_token) {
        const hasCallbackCredential = Boolean(
          params.code || params.tokenHash || params.token || (params.accessToken && params.refreshToken),
        );
        return {
          error: hasCallbackCredential
            ? 'Authentication completed, but no session was returned. The link may have expired; request a fresh verification email.'
            : 'The authentication callback is missing its verification credentials. Return to login or request a fresh verification email.',
        };
      }

      // Prefer the authoritative user endpoint, while retaining the verified
      // user returned by token verification if the lookup itself is unavailable.
      const currentUser = await auth.getUser();
      if (!currentUser.error && currentUser.data?.user) user = currentUser.data.user;
      user = user || session.user || undefined;

      if (!user?.email_confirmed_at) {
        return {
          error: 'Your email address has not been confirmed yet. Please verify it using the link sent to your inbox.',
          unverifiedEmail: user?.email,
        };
      }

      return { session, user };
    })(), timeoutMs);
  } catch (error) {
    return {
      error: error instanceof Error
        ? error.message
        : 'An error occurred while completing authentication. Please try again.',
    };
  }
}

let activeCallback: { key: string; promise: Promise<AuthCallbackResult> } | null = null;

/** Share in-flight processing across React StrictMode's repeated effect setup. */
export function processAuthCallbackOnce(
  href: string,
  auth: CallbackAuthClient,
  timeoutMs = 12000,
): Promise<AuthCallbackResult> {
  const key = href;
  if (activeCallback?.key === key) return activeCallback.promise;

  const promise = resolveAuthCallback(parseAuthCallbackParams(href), auth, timeoutMs);
  activeCallback = { key, promise };
  void promise.finally(() => {
    if (activeCallback?.promise === promise) activeCallback = null;
  }).catch(() => {});
  return promise;
}
