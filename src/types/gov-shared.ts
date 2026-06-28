/** Shared types for gov-copilot mobile + API */

export type ServiceId = 'income_certificate' | 'learner_licence';

export type PortalId = 'edistrict_delhi' | 'sarathi_parivahan';

export interface ServiceRequirement {
  service_id: ServiceId;
  portal_id: PortalId;
  display_name: string;
  official_url: string;
  allowed_hosts: string[];
  required_fields: string[];
  required_documents: string[];
  conditional_documents: { when: string; documents: string[] }[];
  sensitive_steps: string[];
  clarifying_questions: string[];
}

export interface CaseProfile {
  full_name?: string;
  father_name?: string;
  dob?: string;
  mobile?: string;
  email?: string;
  aadhaar_last4?: string;
  address_line1?: string;
  address_line2?: string;
  district?: string;
  state?: string;
  pincode?: string;
  purpose?: string;
  annual_income?: string;
  [key: string]: string | undefined;
}

export interface PreparedDocument {
  document_key: string;
  filename: string;
  url: string;
  mime_type: string;
  size_bytes: number;
}

export interface PortalAdapterField {
  label_variants: string[];
  profile_key: string;
  type: 'text' | 'date' | 'tel' | 'email' | 'select' | 'textarea';
  selector_hints?: string[];
}

export interface PortalAdapterUpload {
  label_variants: string[];
  document_key: string;
}

export interface PortalAdapterStep {
  step_id: string;
  detect_by: { text_contains?: string[]; url_contains?: string[] };
  fields?: PortalAdapterField[];
  uploads?: PortalAdapterUpload[];
  requires_user_approval_before_upload?: boolean;
  next_instruction?: string;
}

export interface PortalAdapter {
  portal_id: PortalId;
  service_id: ServiceId;
  adapter_version: string;
  start_url: string;
  allowed_hosts: string[];
  steps: PortalAdapterStep[];
  pause_at: string[];
}

export interface AutomationBundle {
  bundle_id: string;
  case_id: string;
  service_id: ServiceId;
  portal_id: PortalId;
  start_url: string;
  allowed_hosts: string[];
  profile: CaseProfile;
  documents: Record<string, { url: string; filename: string; mime_type?: string }>;
  adapter_version: string;
  issued_at: string;
  expires_at: string;
  signature: string;
}

export type PortalEventType =
  | 'portal_opened'
  | 'step_detected'
  | 'field_filled'
  | 'field_failed'
  | 'upload_attempted'
  | 'upload_success'
  | 'upload_failure'
  | 'pause_triggered'
  | 'receipt_captured'
  | 'session_ended'
  | 'navigation_blocked'
  | 'error';

export interface PortalEvent {
  session_id: string;
  case_id: string;
  event_type: PortalEventType;
  step_id?: string;
  field_key?: string;
  message?: string;
  timestamp: string;
}

export interface CreateCaseRequest {
  intent: string;
  service_id?: ServiceId;
  answers?: Record<string, string>;
}

export interface CaseResponse {
  case_id: string;
  service_id: ServiceId;
  portal_id: PortalId;
  status: 'draft' | 'documents_pending' | 'profile_pending' | 'confirmed' | 'completed';
  requirements: ServiceRequirement;
  profile: CaseProfile;
  documents: PreparedDocument[];
}

export interface ConfirmProfileRequest {
  profile: CaseProfile;
}

export interface FillPageResult {
  filled: number;
  failed: number;
  paused: boolean;
  step_id?: string;
  message?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  status: 'checked' | 'found' | 'unreachable';
  snippet?: string | null;
}

export interface ResearchRequirementsRequest {
  service_id: ServiceId;
  state?: string | null;
  licence_type?: string | null;
  intent?: string | null;
}

export interface ResearchRequirementsResponse {
  service_id: ServiceId;
  state?: string | null;
  licence_type?: string | null;
  message: string;
  sources: ResearchSource[];
  required_documents: string[];
  notes?: string | null;
  researched_at: string;
}