export interface ScanTarget {
  id: string;
  portal_id: string;
  service_id: string;
  adapter_version: string;
  start_url: string;
  allowed_hosts: string[];
  navigation_hints?: string[];
  /** Additional URLs to scan in one run (fixtures, deep links). */
  extra_urls?: string[];
}

export interface ExtractedField {
  selector: string;
  tag: string;
  input_type: string;
  id: string;
  name: string;
  placeholder: string;
  label: string;
  required: boolean;
  options: string[];
}

export interface ExtractedUpload {
  selector: string;
  label: string;
  accept: string;
}

export interface ExtractedButton {
  label: string;
  selector: string;
  action: 'next' | 'save' | 'pay' | 'submit' | 'unknown';
}

export interface PageSnapshot {
  index: number;
  url: string;
  title: string;
  headings: string[];
  body_text_sample: string;
  fields: ExtractedField[];
  uploads: ExtractedUpload[];
  buttons: ExtractedButton[];
  iframe_count: number;
  pause_triggers: string[];
  phase: PagePhase;
}

export type PagePhase =
  | 'auth'
  | 'discover'
  | 'profile'
  | 'service_fields'
  | 'documents'
  | 'declaration'
  | 'payment'
  | 'otp_aadhaar'
  | 'captcha'
  | 'submit'
  | 'track'
  | 'unknown';

export interface AdapterField {
  label_variants: string[];
  profile_key: string;
  type: 'text' | 'textarea' | 'date' | 'tel' | 'email' | 'select';
}

export interface AdapterUpload {
  label_variants: string[];
  document_key: string;
}

export interface AdapterStep {
  step_id: string;
  detect_by: {
    text_contains: string[];
    url_contains: string[];
  };
  fields?: AdapterField[];
  uploads?: AdapterUpload[];
  requires_user_approval_before_upload?: boolean;
  next_instruction: string;
}

export interface DraftAdapter {
  portal_id: string;
  service_id: string;
  adapter_version: string;
  start_url: string;
  allowed_hosts: string[];
  pause_at: string[];
  steps: AdapterStep[];
  _meta: {
    generated_at: string;
    scanner_version: string;
    target_id: string;
    page_count: number;
    unmapped_fields: string[];
    unmapped_uploads: string[];
  };
}

export interface ScanReport {
  target: ScanTarget;
  scanned_at: string;
  pages: PageSnapshot[];
  blockers: Array<{ type: string; detail: string }>;
  stability_hints: string[];
  severity: SeverityScore;
  draft_adapter: DraftAdapter;
}

export interface SeverityScore {
  automation_difficulty: number;
  blocker_density: number;
  compliance_risk: number;
  portal_stability: number;
  user_value: number;
  total: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}