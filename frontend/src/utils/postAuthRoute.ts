export type PostAuthRoute =
  | 'auth-loading'
  | 'unauthenticated'
  | 'policy-loading'
  | 'policy'
  | 'profile-loading'
  | 'onboarding'
  | 'dashboard';

export interface PostAuthState {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  isPolicyLoading: boolean;
  hasAcceptedPolicy: boolean | null;
  isProfileLoading: boolean;
  onboardingCompleted: boolean;
}

/** Resolve the next screen only from completed auth, policy, and profile state. */
export function resolvePostAuthRoute(state: PostAuthState): PostAuthRoute {
  if (state.isAuthLoading) return 'auth-loading';
  if (!state.isAuthenticated) return 'unauthenticated';
  if (state.isPolicyLoading || state.hasAcceptedPolicy === null) return 'policy-loading';
  if (!state.hasAcceptedPolicy) return 'policy';
  if (state.isProfileLoading) return 'profile-loading';
  return state.onboardingCompleted ? 'dashboard' : 'onboarding';
}
