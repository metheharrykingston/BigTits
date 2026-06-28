import type {
  AutomationBundle,
  CaseResponse,
  ConfirmProfileRequest,
  CreateCaseRequest,
  PortalEvent,
  ResearchRequirementsRequest,
  ResearchRequirementsResponse,
  ServiceRequirement,
} from '@shared';
import { govApiBaseUrl } from '../../../lib/api';

const API_BASE = govApiBaseUrl();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { detail?: string; error?: string };
      throw new Error(parsed.detail || parsed.error || text || `Request failed: ${res.status}`);
    } catch (err) {
      if (err instanceof Error && err.message !== text) throw err;
      throw new Error(text || `Request failed: ${res.status}`);
    }
  }
  return res.json() as Promise<T>;
}

export const api = {
  listServices: () =>
    request<Array<{ service_id: string; display_name: string }>>('/services'),

  createCase: (body: CreateCaseRequest) =>
    request<CaseResponse>('/cases', { method: 'POST', body: JSON.stringify(body) }),

  researchRequirements: (body: ResearchRequirementsRequest) =>
    request<ResearchRequirementsResponse>('/research/requirements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getCase: (caseId: string) => request<CaseResponse>(`/cases/${caseId}`),

  uploadDocument: async (caseId: string, documentKey: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<CaseResponse>(`/cases/${caseId}/documents/${documentKey}`, {
      method: 'POST',
      body: form,
    });
  },

  extractAll: (caseId: string) =>
    request<CaseResponse>(`/cases/${caseId}/extract`, { method: 'POST' }),

  extractDocument: (caseId: string, documentKey: string) =>
    request<CaseResponse>(`/cases/${caseId}/documents/${documentKey}/extract`, {
      method: 'POST',
    }),

  confirmProfile: (caseId: string, body: ConfirmProfileRequest) =>
    request<CaseResponse>(`/cases/${caseId}/profile/confirm`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createBundle: (caseId: string) =>
    request<AutomationBundle>(`/bundles/cases/${caseId}`, { method: 'POST' }),

  /** Portal browse only — no profile/documents required on our servers. */
  createBrowseBundle: (caseId: string) =>
    request<AutomationBundle>(`/bundles/cases/${caseId}/browse`, { method: 'POST' }),

  getAdapter: (adapterVersion: string) =>
    request<ServiceRequirement & Record<string, unknown>>(`/bundles/adapters/${adapterVersion}`),

  postAuditEvent: (event: PortalEvent) =>
    request<{ ok: boolean }>('/audit/events', {
      method: 'POST',
      body: JSON.stringify(event),
    }),
};