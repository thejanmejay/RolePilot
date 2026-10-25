import { useState, useEffect, useCallback } from 'react';
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
import { Loader2 } from 'lucide-react';
import { resolvePostAuthRoute } from './utils/postAuthRoute';

function normalizePath(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean;
}

function AppContent() {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { hasAcceptedPolicy, isCheckingPolicy } = usePolicy();
  const { isOnboardingCompleted, isLoading: isProfileLoading } = useProfile();
  const postAuthRoute = resolvePostAuthRoute({
    isAuthLoading,
    isAuthenticated,
    isPolicyLoading: isCheckingPolicy,
    hasAcceptedPolicy,
    isProfileLoading,
    onboardingCompleted: isOnboardingCompleted,
  });

  const [currentPath, setCurrentPath] = useState<string>(() =>
    normalizePath(window.location.pathname)
  );

  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    const p = normalizePath(window.location.pathname);
    if (p === '/profile') return 'profile';
    if (p === '/jobs') return 'jobs';
    if (p === '/applications') return 'applications';
    if (p === '/automation') return 'automation';
    return 'dashboard';
  });

  const [targetRunId, setTargetRunId] = useState<string | null>(null);
  const [targetApplicationId, setTargetApplicationId] = useState<string | null>(null);

  // Sync browser URL history
  const navigate = useCallback((path: string) => {
    const normalized = normalizePath(path);
    if (window.location.pathname !== normalized) {
      window.history.pushState(null, '', normalized);
    }
    setCurrentPath(normalized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const routeUserAfterAuth = useCallback(() => {
    // Leave callback/login/reset screens; the render gates below wait for the
    // restored session, policy result, and profile before choosing a destination.
    if (postAuthRoute === 'dashboard') {
      setCurrentTab('dashboard');
      navigate('/dashboard');
    } else if (postAuthRoute === 'onboarding') {
      navigate('/onboarding');
    } else {
      navigate('/');
    }
  }, [navigate, postAuthRoute]);

  useEffect(() => {
    const handlePopState = () => {
      const p = normalizePath(window.location.pathname);
      setCurrentPath(p);

      if (p === '/profile') setCurrentTab('profile');
      else if (p === '/jobs') setCurrentTab('jobs');
      else if (p === '/applications') setCurrentTab('applications');
      else if (p === '/automation') setCurrentTab('automation');
      else if (p === '/dashboard') setCurrentTab('dashboard');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Enforce onboarding flow transitions for authenticated users
  useEffect(() => {
    if (postAuthRoute === 'onboarding' && currentPath !== '/onboarding') {
      navigate('/onboarding');
    } else if (
      postAuthRoute === 'dashboard' &&
      ['/login', '/signup', '/verify-email', '/auth/callback', '/onboarding', '/'].includes(currentPath)
    ) {
      setCurrentTab('dashboard');
      navigate('/dashboard');
    }
  }, [
    postAuthRoute,
    currentPath,
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

  // 1. Initial auth restoration loader
  if (postAuthRoute === 'auth-loading') {
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
      />
    );
  }

  // 4. Explicit /forgot-password route
  if (currentPath === '/forgot-password') {
    return (
      <ForgotPasswordPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
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
      />
    );
  }

  // 6. Unauthenticated handling
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
        />
      );
    }

    if (currentPath === '/signup') {
      return (
        <SignupPage
          onSuccess={routeUserAfterAuth}
          onNavigateLogin={() => navigate('/login')}
          onNavigateHome={() => navigate('/')}
          onNavigateVerifyEmail={(email) => {
            navigate(`/verify-email?email=${encodeURIComponent(email)}`);
          }}
        />
      );
    }

    if (currentPath === '/') {
      return (
        <LandingPage
          onNavigateSignup={() => navigate('/signup')}
          onNavigateLogin={() => navigate('/login')}
        />
      );
    }

    // Default to Login for protected routes when logged out
    return (
      <LoginPage
        onSuccess={routeUserAfterAuth}
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
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
        onSuccess={routeUserAfterAuth}
        onSignOut={() => navigate('/login')}
      />
    );
  }

  // 10. Main Application Dashboard & Management Tabs
  return (
    <AppLayout currentTab={currentTab} onTabChange={handleTabChange}>
      {currentTab === 'dashboard' && (
        <DashboardPage
          onNavigateTab={handleTabChange}
          onNavigateToRun={handleNavigateToRun}
          onNavigateToApplication={handleNavigateToApplication}
        />
      )}
      {currentTab === 'profile' && <ProfilePage onNavigateTab={handleTabChange} />}
      {currentTab === 'jobs' && (
        <JobsPage
          onNavigateToApplications={handleNavigateToApplication}
          onNavigateToRun={handleNavigateToRun}
        />
      )}
      {currentTab === 'applications' && (
        <ApplicationsPage
          initialApplicationId={targetApplicationId}
          onClearInitialApplication={() => setTargetApplicationId(null)}
          onNavigateToJobs={() => handleTabChange('jobs')}
          onNavigateToRun={handleNavigateToRun}
        />
      )}
      {currentTab === 'automation' && (
        <AutomationPage
          initialRunId={targetRunId}
          onClearInitialRun={() => setTargetRunId(null)}
          onNavigateToApplication={handleNavigateToApplication}
          onNavigateTab={handleTabChange}
        />
      )}
    </AppLayout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <PolicyProvider>
        <ToastProvider>
          <ProfileProvider>
            <AppContent />
          </ProfileProvider>
        </ToastProvider>
      </PolicyProvider>
    </AuthProvider>
  );
}

export default App;
