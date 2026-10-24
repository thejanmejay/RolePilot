import { apiClient } from './client';
import type {
  Application,
  ApplicationAnswer,
  ApplicationCreate,
  ApplicationUpdate,
  ApplicationLifecycleStatus,
} from '../types/application';

export type {
  Application,
  ApplicationAnswer,
  ApplicationCreate,
  ApplicationUpdate,
  ApplicationLifecycleStatus,
};

export const applicationsApi = {
  /**
   * List all user applications, optionally filtered by status
   */
  async getApplications(status?: string): Promise<Application[]> {
    const endpoint = status ? `/api/v1/applications?status=${encodeURIComponent(status)}` : '/api/v1/applications';
    return apiClient.get<Application[]>(endpoint);
  },

  /**
   * Get single application details with answers
   */
  async getApplicationById(id: string): Promise<Application> {
    return apiClient.get<Application>(`/api/v1/applications/${id}`);
  },

  /**
   * Save a job or record an application in PostgreSQL
   */
  async saveOrTrackApplication(data: {
    job_id: string;
    status?: string;
    application_url?: string;
    error_message?: string;
  }): Promise<Application> {
    return apiClient.post<Application>('/api/v1/applications', {
      status: 'saved',
      ...data,
    });
  },

  async createApplication(data: {
    job_id: string;
    status?: string;
    application_url?: string;
    error_message?: string;
  }): Promise<Application> {
    return this.saveOrTrackApplication(data);
  },

  /**
   * Update application status (e.g. applied, interviewing, rejected, offer, withdrawn)
   */
  async updateStatus(id: string, status: string, applicationUrl?: string): Promise<Application> {
    return apiClient.patch<Application>(`/api/v1/applications/${id}`, {
      status,
      application_url: applicationUrl,
    });
  },

  async updateApplicationStatus(id: string, status: string, applicationUrl?: string): Promise<Application> {
    return this.updateStatus(id, status, applicationUrl);
  },

  /**
   * Delete application or remove saved job
   */
  async deleteApplication(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/applications/${id}`);
  },
};
