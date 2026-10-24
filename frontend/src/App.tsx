import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProfileProvider } from './context/ProfileContext';
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
import { Loader2 } from 'lucide-react';

function normalizePath(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean;
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
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
  const navigate = (path: string) => {
    const normalized = normalizePath(path);
    if (window.location.pathname !== normalized) {
      window.history.pushState(null, '', normalized);
    }
    setCurrentPath(normalized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  // Avoid flashing while restoring Supabase session on initial load
  if (isLoading) {
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
        <Loader2 size={32} className="spin-animation" style={{ color: '#0A66C2' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Connecting to LinkedIn Hunter...</span>
      </div>
    );
  }

  // 1. Explicit /auth/callback route (OAuth & Email link redirects)
  if (currentPath === '/auth/callback') {
    return (
      <AuthCallbackPage
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
        onNavigateLogin={() => navigate('/login')}
      />
    );
  }

  // 2. Explicit /verify-email route (Email OTP confirmation)
  if (currentPath === '/verify-email') {
    return (
      <VerifyEmailPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  // 3. Explicit /forgot-password route
  if (currentPath === '/forgot-password') {
    return (
      <ForgotPasswordPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // 4. Explicit /reset-password route
  if (currentPath === '/reset-password') {
    return (
      <ResetPasswordPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // 5. Explicit /signup route
  if (currentPath === '/signup') {
    return (
      <SignupPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
        onNavigateVerifyEmail={(email) => {
          navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        }}
      />
    );
  }

  // 6. Explicit /login route
  if (currentPath === '/login') {
    return (
      <LoginPage
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
        onNavigateForgotPassword={() => navigate('/forgot-password')}
        onNavigateVerifyEmail={(email) => {
          navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        }}
      />
    );
  }

  // 7. Pre-signup Landing Page (Route '/' when not authenticated)
  if (currentPath === '/' && !isAuthenticated) {
    return (
      <LandingPage
        onNavigateSignup={() => navigate('/signup')}
        onNavigateLogin={() => navigate('/login')}
      />
    );
  }

  // 8. Unauthenticated access to protected routes -> Redirect to Login
  if (!isAuthenticated && currentPath !== '/') {
    return (
      <LoginPage
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
        onNavigateForgotPassword={() => navigate('/forgot-password')}
        onNavigateVerifyEmail={(email) => {
          navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        }}
      />
    );
  }

  // 9. Authenticated state on '/' or '/dashboard', '/profile', etc.
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
      <ToastProvider>
        <ProfileProvider>
          <AppContent />
        </ProfileProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
