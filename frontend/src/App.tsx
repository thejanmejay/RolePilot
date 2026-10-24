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

function normalizePath(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean;
}

function AppContent() {
  const { isAuthenticated } = useAuth();
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

  // Route Dispatching:
  // 1. Explicit /signup route
  if (currentPath === '/signup') {
    return (
      <SignupPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  // 2. Explicit /login route
  if (currentPath === '/login') {
    return (
      <LoginPage
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  // 3. Pre-signup Landing Page (Route '/' when not authenticated)
  if (currentPath === '/' && !isAuthenticated) {
    return (
      <LandingPage
        onNavigateSignup={() => navigate('/signup')}
        onNavigateLogin={() => navigate('/login')}
      />
    );
  }

  // 4. Authenticated Application Pages (or redirected to login if unauthenticated on private routes)
  if (!isAuthenticated && currentPath !== '/') {
    return (
      <LoginPage
        onNavigateSignup={() => navigate('/signup')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={() => {
          navigate('/dashboard');
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  // Authenticated state on '/' or '/dashboard', '/profile', etc.
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
