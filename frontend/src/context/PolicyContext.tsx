import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { policyService, type PolicyStatus } from '../services/policyService';
import { formatErrorMessage } from '../api/client';
import { ACTIVE_POLICY } from '../components/policy/policyContent';

export interface PolicyContextType {
  hasAcceptedPolicy: boolean | null;
  policyStatus: PolicyStatus | null;
  isCheckingPolicy: boolean;
  hasDeclined: boolean;
  setHasDeclined: (declined: boolean) => void;
  acceptPolicy: () => Promise<{ success: boolean; error?: string }>;
  checkPolicyStatus: () => Promise<void>;
}

const PolicyContext = createContext<PolicyContextType | undefined>(undefined);

export const PolicyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, token } = useAuth();
  const [hasAcceptedPolicy, setHasAcceptedPolicy] = useState<boolean | null>(null);
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus | null>(null);
  const [isCheckingPolicy, setIsCheckingPolicy] = useState<boolean>(false);
  const [hasDeclined, setHasDeclined] = useState<boolean>(false);

  const checkPolicyStatus = useCallback(async () => {
    // Only check if user is authenticated and email is verified
    if (!isAuthenticated || !token || (user && !user.email_confirmed_at)) {
      setHasAcceptedPolicy(null);
      setPolicyStatus(null);
      setIsCheckingPolicy(false);
      return;
    }

    setIsCheckingPolicy(true);
    try {
      const status = await policyService.getStatus();
      setPolicyStatus(status);
      setHasAcceptedPolicy(status.has_accepted);
    } catch (err) {
      console.warn('Failed to retrieve policy acceptance status:', err);
      // If error (e.g. network/server), default to unaccepted to protect features
      setHasAcceptedPolicy(false);
    } finally {
      setIsCheckingPolicy(false);
    }
  }, [isAuthenticated, token, user]);

  useEffect(() => {
    if (isAuthenticated) {
      checkPolicyStatus();
    } else {
      setHasAcceptedPolicy(null);
      setPolicyStatus(null);
      setHasDeclined(false);
      setIsCheckingPolicy(false);
    }
  }, [isAuthenticated, checkPolicyStatus]);

  useEffect(() => {
    const handleAuthCleanup = () => {
      setHasAcceptedPolicy(null);
      setPolicyStatus(null);
      setHasDeclined(false);
      setIsCheckingPolicy(false);
    };

    window.addEventListener('auth:logout', handleAuthCleanup);
    window.addEventListener('auth:cleared', handleAuthCleanup);
    return () => {
      window.removeEventListener('auth:logout', handleAuthCleanup);
      window.removeEventListener('auth:cleared', handleAuthCleanup);
    };
  }, []);

  const acceptPolicy = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await policyService.acceptActivePolicy(ACTIVE_POLICY.version);
      if (res.success) {
        setHasAcceptedPolicy(true);
        setHasDeclined(false);
        await checkPolicyStatus();
        return { success: true };
      }
      return { success: false, error: res.message || "We couldn't save your policy acceptance. Please try again." };
    } catch (err: any) {
      const errMsg = formatErrorMessage(err);
      return { success: false, error: errMsg };
    }
  }, [checkPolicyStatus]);

  return (
    <PolicyContext.Provider
      value={{
        hasAcceptedPolicy,
        policyStatus,
        isCheckingPolicy,
        hasDeclined,
        setHasDeclined,
        acceptPolicy,
        checkPolicyStatus,
      }}
    >
      {children}
    </PolicyContext.Provider>
  );
};

export const usePolicy = (): PolicyContextType => {
  const context = useContext(PolicyContext);
  if (!context) {
    throw new Error('usePolicy must be used within a PolicyProvider');
  }
  return context;
};
