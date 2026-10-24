import { apiClient } from './client';
import type { Job, JobFilterParams, SearchConfig, SearchConfigCreate } from '../types/job';

export const jobsApi = {
  /**
   * List global/shared LinkedIn jobs from backend
   */
  async getJobs(params?: JobFilterParams): Promise<Job[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.company) query.append('company', params.company);
    if (params?.location) query.append('location', params.location);
    if (params?.skip !== undefined) query.append('skip', String(params.skip));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));

    const queryString = query.toString();
    const endpoint = queryString ? `/api/v1/jobs?${queryString}` : '/api/v1/jobs';
    return apiClient.get<Job[]>(endpoint);
  },

  /**
   * Get single job details by ID
   */
  async getJobById(jobId: string): Promise<Job> {
    return apiClient.get<Job>(`/api/v1/jobs/${jobId}`);
  },

  /**
   * List user search configs
   */
  async getSearchConfigs(): Promise<SearchConfig[]> {
    return apiClient.get<SearchConfig[]>('/api/v1/search-configs');
  },

  /**
   * Create a new search config
   */
  async createSearchConfig(data: SearchConfigCreate): Promise<SearchConfig> {
    return apiClient.post<SearchConfig>('/api/v1/search-configs', data);
  },

  /**
   * Delete a search config
   */
  async deleteSearchConfig(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/search-configs/${id}`);
  },

  /**
   * Trigger automation run
   */
  async triggerAutomationRun(data: {
    search_config_id?: string;
    max_jobs?: number;
    dry_run?: boolean;
    auto_apply?: boolean;
  }) {
    return apiClient.post('/api/v1/automation/runs', data);
  },
};
