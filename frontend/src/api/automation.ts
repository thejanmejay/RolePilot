import { apiClient } from './client';
import type { AutomationRun, AutomationLog, AutomationRunCreate } from '../types/automation';
import type { Application } from '../types/application';

export const automationApi = {
  /**
   * List all automation runs for authenticated user
   */
  async getRuns(skip = 0, limit = 50): Promise<AutomationRun[]> {
    return apiClient.get<AutomationRun[]>(`/api/v1/automation/runs?skip=${skip}&limit=${limit}`);
  },

  /**
   * Get single automation run by ID
   */
  async getRunById(runId: string): Promise<AutomationRun> {
    return apiClient.get<AutomationRun>(`/api/v1/automation/runs/${runId}`);
  },

  /**
   * Get structured event logs for a specific run
   */
  async getRunLogs(runId: string): Promise<AutomationLog[]> {
    return apiClient.get<AutomationLog[]>(`/api/v1/automation/runs/${runId}/logs`);
  },

  /**
   * Trigger a new automation run in background
   */
  async createRun(data: AutomationRunCreate): Promise<AutomationRun> {
    return apiClient.post<AutomationRun>('/api/v1/automation/runs', data);
  },

  /**
   * Cancel an in-progress or queued run
   */
  async cancelRun(runId: string): Promise<AutomationRun> {
    return apiClient.post<AutomationRun>(`/api/v1/automation/runs/${runId}/cancel`, {});
  },

  /**
   * Fetch applications associated with a specific automation run
   */
  async getRunApplications(runId: string): Promise<Application[]> {
    return apiClient.get<Application[]>(`/api/v1/applications?run_id=${encodeURIComponent(runId)}`);
  },
};
