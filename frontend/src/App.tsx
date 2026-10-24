import { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProfileProvider } from './context/ProfileContext';
import { AppLayout, type TabType } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { JobsPage } from './pages/JobsPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { AutomationPage } from './pages/AutomationPage';

export function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [targetRunId, setTargetRunId] = useState<string | null>(null);
  const [targetApplicationId, setTargetApplicationId] = useState<string | null>(null);

  const handleNavigateToRun = (runId: string) => {
    setTargetRunId(runId);
    setCurrentTab('automation');
  };

  const handleNavigateToApplication = (applicationId?: string) => {
    if (applicationId) setTargetApplicationId(applicationId);
    setCurrentTab('applications');
  };

  return (
    <AuthProvider>
      <ToastProvider>
        <ProfileProvider>
          <AppLayout currentTab={currentTab} onTabChange={setCurrentTab}>
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigateTab={setCurrentTab}
              onNavigateToRun={handleNavigateToRun}
              onNavigateToApplication={handleNavigateToApplication}
            />
          )}
          {currentTab === 'profile' && <ProfilePage onNavigateTab={setCurrentTab} />}
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
              onNavigateToJobs={() => setCurrentTab('jobs')}
              onNavigateToRun={handleNavigateToRun}
            />
          )}
          {currentTab === 'automation' && (
            <AutomationPage
              initialRunId={targetRunId}
              onClearInitialRun={() => setTargetRunId(null)}
              onNavigateToApplication={handleNavigateToApplication}
              onNavigateTab={setCurrentTab}
            />
          )}
        </AppLayout>
        </ProfileProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
