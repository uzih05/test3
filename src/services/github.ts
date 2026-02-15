import { api } from '@/lib/api';
import type { GitHubRepo, GitHubPR, GitHubPRDetail } from '@/types';

export const githubService = {
  status: () =>
    api.get<{ connected: boolean; username: string }>('/api/v1/github/status'),

  saveToken: (token: string) =>
    api.put('/api/v1/github/token', { token }),

  deleteToken: () =>
    api.delete('/api/v1/github/token'),

  repos: (page?: number, per_page?: number) =>
    api.get<{ items: GitHubRepo[] }>('/api/v1/github/repos', { page, per_page }),

  pulls: (owner: string, repo: string, state?: string) =>
    api.get<{ items: GitHubPR[] }>(
      `/api/v1/github/repos/${owner}/${repo}/pulls`, { state }
    ),

  pullDetail: (owner: string, repo: string, number: number) =>
    api.get<GitHubPRDetail>(
      `/api/v1/github/repos/${owner}/${repo}/pulls/${number}`
    ),
};
