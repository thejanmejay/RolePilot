import { useState, useEffect, useCallback } from 'react';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PolicyProvider, usePolicy } from './context/PolicyContext';
import { ToastProvider } from './context/ToastContext';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { AppLayout, type TabType } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { JobsPage } from './pages/JobsPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { AutomationPage } from './pages/AutomationPage';
import { LandingPage } from './pages/LandingPage';
import { SignupPage } from './pages/SignupPage';
import { LoginPage } from './pages/LoginPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PolicyAcceptancePage } from './pages/PolicyAcceptancePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { AboutPage } from './pages/AboutPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { GuidelinesPage } from './pages/GuidelinesPage';
import { SupportPage } from './pages/SupportPage';
import { BlogListPage } from './pages/BlogListPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { ContactPage } from './pages/ContactPage';
import { PricingPage } from './pages/PricingPage';
import { CareersPage } from './pages/CareersPage';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { SecurityPage } from './pages/SecurityPage';
import { SettingsPage } from './pages/SettingsPage';
import { ResumeCheckerPage } from './pages/ResumeCheckerPage';
import { Loader2 } from 'lucide-react';
import { resolvePostAuthRoute } from './utils/postAuthRoute';
import { getSafeInternalRedirect, normalizePath } from './utils/redirect';
export { getSafeInternalRedirect, normalizePath };

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/resume-checker',
  '/forgot-password',
  '/reset-password',
  '/about',
  '/terms',
  '/privacy',
  '/guidelines',
  '/support',
  '/blog',
  '/guides',
  '/contact',
  '/pricing',
  '/careers',
  '/accessibility',
  '/features',
  '/integrations',
  '/security',
];
const isPublicRoute = (path: string) => {
  const norm = normalizePath(path);
  return PUBLIC_ROUTES.includes(norm) || norm.startsWith('/blog/');
};

function AppContent() {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { hasAcceptedPolicy, isCheckingPolicy } = usePolicy();
  const { isOnboardingCompleted, isLoading: isProfileLoading, profile } = useProfile();
  const postAuthRoute = resolvePostAuthRoute({
    isAuthLoading,
    isAuthenticated,
    isPolicyLoading: isCheckingPolicy,
    hasAcceptedPolicy,
    isProfileLoading,
    onboardingCompleted: isOnboardingCompleted || Boolean(profile?.onboarding_completed),
  });

  const { currentPath, navigate } = useNavigation();

  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    const p = normalizePath(window.location.pathname);
    if (p === '/profile') return 'profile';
    if (p === '/jobs') return 'jobs';
    if (p === '/applications') return 'applications';
    if (p === '/automation') return 'automation';
    if (p === '/settings') return 'settings';
    return 'dashboard';
  });

  const [targetRunId, setTargetRunId] = useState<string | null>(null);
  const [targetApplicationId, setTargetApplicationId] = useState<string | null>(null);

  // Preserve mounted tab instances to eliminate unmounting, filter loss, and re-fetching spinners
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set([currentTab]));

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(currentTab)) return prev;
      const next = new Set(prev);
      next.add(currentTab);
      return next;
    });
  }, [currentTab]);

  useEffect(() => {
    const handleAuthCleanup = () => {
      setVisitedTabs(new Set(['dashboard']));
      setTargetRunId(null);
      setTargetApplicationId(null);
    };
    window.addEventListener('auth:logout', handleAuthCleanup);
    window.addEventListener('auth:cleared', handleAuthCleanup);
    return () => {
      window.removeEventListener('auth:logout', handleAuthCleanup);
      window.removeEventListener('auth:cleared', handleAuthCleanup);
    };
  }, []);

  // Synchronize active tab when router currentPath updates
  useEffect(() => {
    if (currentPath === '/profile') setCurrentTab('profile');
    else if (currentPath === '/jobs') setCurrentTab('jobs');
    else if (currentPath === '/applications') setCurrentTab('applications');
    else if (currentPath === '/automation') setCurrentTab('automation');
    else if (currentPath === '/settings') setCurrentTab('settings');
    else if (currentPath === '/dashboard') setCurrentTab('dashboard');
  }, [currentPath]);




  const routeUserAfterAuth = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = getSafeInternalRedirect(
      params.get('redirect') || params.get('returnTo') || params.get('next')
    );

    if (postAuthRoute === 'dashboard') {
      const dest = redirectParam || '/dashboard';
      if (dest === '/dashboard') setCurrentTab('dashboard');
      navigate(dest);
    } else if (postAuthRoute === 'onboarding') {
      navigate('/onboarding');
    }
    // Note: If still resolving (auth-loading, policy-loading, profile-loading),
    // NEVER navigate to '/'! The authenticated render gates or the postAuthRoute
    // resolution effect below will route the user to their destination as soon as ready.
  }, [navigate, postAuthRoute]);

  // Enforce onboarding flow transitions and authenticated / unauthenticated guards
  useEffect(() => {
    const authEntryPaths = ['/login', '/signup', '/verify-email', '/auth/callback'];
    const isAuthEntryPath = authEntryPaths.includes(currentPath);

    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const redirectParam = getSafeInternalRedirect(
        params.get('redirect') || params.get('returnTo') || params.get('next')
      );

      if (
        (isAuthEntryPath && postAuthRoute === 'onboarding') ||
        (postAuthRoute === 'onboarding' && currentPath !== '/onboarding' && !isPublicRoute(currentPath))
      ) {
        navigate('/onboarding');
      } else if (
        postAuthRoute === 'dashboard' &&
        ['/login', '/signup', '/verify-email', '/auth/callback', '/onboarding'].includes(currentPath)
      ) {
        const dest = (['/login', '/signup', '/auth/callback'].includes(currentPath) && redirectParam)
          ? redirectParam
          : '/dashboard';
        if (dest === '/dashboard') setCurrentTab('dashboard');
        navigate(dest);
      }
    } else if (
      !isAuthenticated &&
      !isAuthLoading &&
      !isPublicRoute(currentPath) &&
      currentPath !== '/verify-email' &&
      currentPath !== '/auth/callback'
    ) {
      // Unauthenticated visitor attempting to access a protected route (e.g. after storage clear)
      navigate('/');
    }
  }, [
    postAuthRoute,
    currentPath,
    isAuthenticated,
    isAuthLoading,
    navigate,
  ]);

  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    navigate(`/${tab}`);
  };

  const handleNavigateToRun = (runId: string) => {
    setTargetRunId(runId);
    setCurrentTab('automation');
    navigate('/automation');
  };

  const handleNavigateToApplication = (applicationId?: string) => {
    if (applicationId) setTargetApplicationId(applicationId);
    setCurrentTab('applications');
    navigate('/applications');
  };

  const publicNavProps = {
    onNavigateHome: () => navigate('/'),
    onNavigateLogin: () => navigate('/login'),
    onNavigateSignup: () => navigate('/signup'),
    onNavigateAbout: () => navigate('/about'),
    onNavigateTerms: () => navigate('/terms'),
    onNavigatePrivacy: () => navigate('/privacy'),
    onNavigateGuidelines: () => navigate('/guidelines'),
    onNavigateSupport: () => navigate('/support'),
    onNavigateBlog: (path?: string) => navigate(path || '/blog'),
    onNavigateFeatures: () => navigate('/features'),
    onNavigatePricing: () => navigate('/pricing'),
    onNavigateCareers: () => navigate('/careers'),
    onNavigateAccessibility: () => navigate('/accessibility'),
    onNavigateSecurity: () => navigate('/security'),
    onNavigateIntegrations: () => navigate('/integrations'),
    onNavigateContact: (path?: string) => navigate(path || '/contact'),
    isAuthenticated,
    onNavigateDashboard: () => {
      setCurrentTab('dashboard');
      navigate('/dashboard');
    },
  };

  // 1. Initial auth restoration loader - ONLY on protected routes while restoring session!
  // Public routes (/, /login, /signup, /forgot-password, /reset-password) must never be blocked by auth loading!
  if (postAuthRoute === 'auth-loading' && !isPublicRoute(currentPath)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          backgroundColor: '#F8FAFC',
          color: '#64748B',
        }}
      >
        <Loader2 size={32} className="spin-animation" style={{ color: '#1769E8' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Connecting to RolePilot...</span>
      </div>
    );
  }

  // 2. Explicit /auth/callback route (OAuth & Email link redirects)
  if (currentPath === '/auth/callback') {
    return (
      <AuthCallbackPage
        onSuccess={routeUserAfterAuth}
        onNavigateLogin={() => navigate('/login')}
        onNavigateVerifyEmail={(em) => navigate(`/verify-email?email=${encodeURIComponent(em)}`)}
      />
    );
  }

  // 3. Explicit /verify-email route (Link-based email verification check screen)
  if (currentPath === '/verify-email') {
    return (
      <VerifyEmailPage
        initialEmail={user?.email || undefined}
        onSuccess={routeUserAfterAuth}
        onNavigateLogin={() => navigate('/login')}
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
        onNavigateTerms={() => navigate('/terms')}
        onNavigatePrivacy={() => navigate('/privacy')}
      />
    );
  }

  // 4. Explicit /forgot-password route
  if (currentPath === '/forgot-password') {
    return (
      <ForgotPasswordPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
        onNavigateTerms={() => navigate('/terms')}
        onNavigatePrivacy={() => navigate('/privacy')}
      />
    );
  }

  // 5. Explicit /reset-password route
  if (currentPath === '/reset-password') {
    return (
      <ResetPasswordPage
        onSuccess={routeUserAfterAuth}
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
        onNavigateForgotPassword={() => navigate('/forgot-password')}
        onNavigateTerms={() => navigate('/terms')}
        onNavigatePrivacy={() => navigate('/privacy')}
      />
    );
  }

  // 6. Informational, Legal, Support & Product Routes
  if (currentPath === '/about') {
    return <AboutPage {...publicNavProps} />;
  }

  if (currentPath === '/terms') {
    return <TermsPage {...publicNavProps} />;
  }

  if (currentPath === '/privacy') {
    return <PrivacyPage {...publicNavProps} />;
  }

  if (currentPath === '/guidelines') {
    return <GuidelinesPage {...publicNavProps} />;
  }

  if (currentPath === '/support') {
    return <SupportPage {...publicNavProps} />;
  }

  if (currentPath === '/contact') {
    return <ContactPage {...publicNavProps} />;
  }

  if (currentPath === '/pricing') {
    return <PricingPage {...publicNavProps} />;
  }

  if (currentPath === '/careers') {
    return <CareersPage {...publicNavProps} />;
  }

  if (currentPath === '/accessibility') {
    return <AccessibilityPage {...publicNavProps} />;
  }

  if (currentPath === '/features') {
    return <FeaturesPage {...publicNavProps} />;
  }

  if (currentPath === '/integrations') {
    return <IntegrationsPage {...publicNavProps} />;
  }

  if (currentPath === '/security') {
    return <SecurityPage {...publicNavProps} />;
  }

  if (currentPath === '/resume-checker') {
    return <ResumeCheckerPage />;
  }

  // 7. Public Blog Listing at '/blog' or alias '/guides'
  if (currentPath === '/blog' || currentPath === '/guides') {
    return (
      <BlogListPage
        {...publicNavProps}
        onNavigateBlogPost={(slug) => navigate(`/blog/${slug}`)}
      />
    );
  }

  // 8. Individual Blog Article at '/blog/:slug'
  if (currentPath.startsWith('/blog/')) {
    const slug = currentPath.slice('/blog/'.length);
    return (
      <BlogPostPage
        slug={slug}
        {...publicNavProps}
        onNavigateBlogPost={(targetSlug) => navigate(`/blog/${targetSlug}`)}
      />
    );
  }

  // 9. Public Landing Page at '/'
  if (currentPath === '/') {
    return <LandingPage {...publicNavProps} />;
  }

  // 10. Unauthenticated handling for login / signup pages
  if (!isAuthenticated) {
    // If user has an unverified session, ensure they remain in verification flow
    if (user && !user.email_confirmed_at) {
      return (
        <VerifyEmailPage
          initialEmail={user.email || undefined}
          onSuccess={routeUserAfterAuth}
          onNavigateLogin={() => navigate('/login')}
          onNavigateSignup={() => navigate('/signup')}
          onNavigateHome={() => navigate('/')}
          onNavigateTerms={() => navigate('/terms')}
          onNavigatePrivacy={() => navigate('/privacy')}
        />
      );
    }

    if (currentPath === '/signup') {
      return (
        <SignupPage
          onSuccess={routeUserAfterAuth}
          onNavigateLogin={() => navigate('/login')}
          onNavigateHome={() => navigate('/')}
          onNavigateTerms={() => navigate('/terms')}
          onNavigatePrivacy={() => navigate('/privacy')}
          onNavigateSupport={() => navigate('/support')}
          onNavigateVerifyEmail={(email) => {
            navigate(`/verify-email?email=${encodeURIComponent(email)}`);
          }}
        />
      );
    }


    if (currentPath === '/') {
      return <LandingPage {...publicNavProps} />;
    }

    // Default to Login for other routes when logged out
    return (
      <LoginPage
        onSuccess={routeUserAfterAuth}
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
        onNavigateTerms={() => navigate('/terms')}
        onNavigatePrivacy={() => navigate('/privacy')}
        onNavigateForgotPassword={() => navigate('/forgot-password')}
        onNavigateVerifyEmail={(email) => {
          navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        }}
      />
    );
  }

  // 7. Authenticated user: Check mandatory platform policy acceptance
  if (postAuthRoute === 'policy-loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          backgroundColor: '#F8FAFC',
          color: '#64748B',
        }}
      >
        <Loader2 size={32} className="spin-animation" style={{ color: '#1769E8' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Verifying platform permissions...</span>
      </div>
    );
  }

  if (postAuthRoute === 'policy') {
    return <PolicyAcceptancePage onContinue={routeUserAfterAuth} />;
  }

  // 8. Authenticated user: Candidate Profile Onboarding & Loading Check
  if (postAuthRoute === 'profile-loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          backgroundColor: '#F8FAFC',
          color: '#64748B',
        }}
      >
        <Loader2 size={32} className="spin-animation" style={{ color: '#1769E8' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Loading profile status...</span>
      </div>
    );
  }

  // 9. Authenticated user: Mandatory initial profile onboarding
  if (postAuthRoute === 'onboarding' || currentPath === '/onboarding') {
    return (
      <OnboardingPage
        onSuccess={() => {
          const params = new URLSearchParams(window.location.search);
          const redirectParam = getSafeInternalRedirect(
            params.get('redirect') || params.get('returnTo') || params.get('next')
          );
          const dest = redirectParam || '/dashboard';
          setCurrentTab('dashboard');
          navigate(dest);
        }}
        onSignOut={() => navigate('/login')}
      />
    );
  }

  // 10. Main Application Dashboard & Management Tabs (Persistent Tab Instances)
  return (
    <AppLayout currentTab={currentTab} onTabChange={handleTabChange} onNavigate={navigate}>
      {visitedTabs.has('dashboard') && (
        <div style={{ display: currentTab === 'dashboard' ? 'block' : 'none', minHeight: '100%' }}>
          <DashboardPage
            onNavigateTab={handleTabChange}
            onNavigateToRun={handleNavigateToRun}
            onNavigateToApplication={handleNavigateToApplication}
            isActive={currentTab === 'dashboard'}
          />
        </div>
      )}
      {visitedTabs.has('profile') && (
        <div style={{ display: currentTab === 'profile' ? 'block' : 'none', minHeight: '100%' }}>
          <ProfilePage onNavigateTab={handleTabChange} isActive={currentTab === 'profile'} />
        </div>
      )}
      {visitedTabs.has('jobs') && (
        <div style={{ display: currentTab === 'jobs' ? 'block' : 'none', minHeight: '100%' }}>
          <JobsPage
            onNavigateToApplications={handleNavigateToApplication}
            onNavigateToRun={handleNavigateToRun}
            isActive={currentTab === 'jobs'}
          />
        </div>
      )}
      {visitedTabs.has('applications') && (
        <div style={{ display: currentTab === 'applications' ? 'block' : 'none', minHeight: '100%' }}>
          <ApplicationsPage
            initialApplicationId={targetApplicationId}
            onClearInitialApplication={() => setTargetApplicationId(null)}
            onNavigateToJobs={() => handleTabChange('jobs')}
            onNavigateToRun={handleNavigateToRun}
            isActive={currentTab === 'applications'}
          />
        </div>
      )}
      {visitedTabs.has('automation') && (
        <div style={{ display: currentTab === 'automation' ? 'block' : 'none', minHeight: '100%' }}>
          <AutomationPage
            initialRunId={targetRunId}
            onClearInitialRun={() => setTargetRunId(null)}
            onNavigateToApplication={handleNavigateToApplication}
            onNavigateTab={handleTabChange}
            isActive={currentTab === 'automation'}
          />
        </div>
      )}
      {visitedTabs.has('settings') && (
        <div style={{ display: currentTab === 'settings' ? 'block' : 'none', minHeight: '100%' }}>
          <SettingsPage
            onNavigateProfile={() => handleTabChange('profile')}
            onNavigateSupport={() => navigate('/support')}
            onNavigateTerms={() => navigate('/terms')}
            onNavigatePrivacy={() => navigate('/privacy')}
            onNavigateGuidelines={() => navigate('/guidelines')}
            onNavigateTab={handleTabChange}
          />
        </div>
      )}
    </AppLayout>
  );
}


export function App() {
  return (
    <NavigationProvider>
      <AuthProvider>
        <PolicyProvider>
          <ToastProvider>
            <ProfileProvider>
              <AppContent />
            </ProfileProvider>
          </ToastProvider>
        </PolicyProvider>
      </AuthProvider>
    </NavigationProvider>
  );
}

export default App;
