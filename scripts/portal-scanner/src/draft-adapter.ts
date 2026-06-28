import { DEFAULT_PAUSE_AT } from './pause-keywords.js';
import { dedupeFields, dedupeUploads, mapField, mapUpload } from './profile-mapper.js';
import type {
  AdapterStep,
  DraftAdapter,
  PageSnapshot,
  ScanReport,
  ScanTarget,
  SeverityScore,
} from './types.js';

const SCANNER_VERSION = '0.1.0';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

function urlTokens(url: string): string[] {
  try {
    const u = new URL(url);
    return u.pathname
      .split(/[/?&#=]+/)
      .map((p) => p.toLowerCase())
      .filter((p) => p.length > 2 && !/^\d+$/.test(p));
  } catch {
    return [];
  }
}

function textTokens(snapshot: PageSnapshot): string[] {
  const tokens = new Set<string>();
  for (const h of snapshot.headings) {
    if (h.length > 2 && h.length < 80) tokens.add(h);
  }
  for (const f of snapshot.fields.slice(0, 6)) {
    if (f.label && f.label.length > 2 && f.label.length < 60) tokens.add(f.label);
  }
  return [...tokens].slice(0, 8);
}

function stepIdFor(snapshot: PageSnapshot): string {
  const phase = snapshot.phase;
  if (phase === 'profile') return 'applicant_details';
  if (phase === 'documents') return 'document_upload';
  if (phase !== 'unknown') return phase;
  const heading = snapshot.headings[0];
  if (heading) return slugify(heading);
  return `page_${snapshot.index}`;
}

function nextInstruction(phase: string): string {
  switch (phase) {
    case 'documents':
      return 'Approve each document before upload. Complete any declaration or payment steps yourself.';
    case 'profile':
    case 'service_fields':
      return 'Review the filled fields carefully, then tap Save and Continue on the portal.';
    case 'payment':
    case 'otp_aadhaar':
    case 'captcha':
    case 'declaration':
    case 'submit':
      return 'This step must be completed by you. Copilot cannot enter OTP, solve CAPTCHA, accept declarations, make payments, or submit finally.';
    default:
      return 'Navigate to the next form page, then tap Fill this page again.';
  }
}

function buildStep(snapshot: PageSnapshot): {
  step: AdapterStep;
  unmappedFields: string[];
  unmappedUploads: string[];
} {
  const unmappedFields: string[] = [];
  const unmappedUploads: string[] = [];
  const mappedFields = [];
  const mappedUploads = [];

  for (const field of snapshot.fields) {
    const { adapter, unmapped } = mapField(field);
    if (adapter) mappedFields.push(adapter);
    else if (unmapped) unmappedFields.push(unmapped);
  }

  for (const upload of snapshot.uploads) {
    const { adapter, unmapped } = mapUpload(upload);
    if (adapter) mappedUploads.push(adapter);
    else if (unmapped) unmappedUploads.push(unmapped);
  }

  const stepId = stepIdFor(snapshot);
  const step: AdapterStep = {
    step_id: stepId,
    detect_by: {
      text_contains: textTokens(snapshot),
      url_contains: urlTokens(snapshot.url),
    },
    next_instruction: nextInstruction(snapshot.phase),
  };

  if (mappedFields.length) {
    step.fields = dedupeFields(mappedFields);
  }
  if (mappedUploads.length) {
    step.uploads = dedupeUploads(mappedUploads);
    step.requires_user_approval_before_upload = true;
  }

  return { step, unmappedFields, unmappedUploads };
}

function mergeSteps(steps: AdapterStep[]): AdapterStep[] {
  const byId = new Map<string, AdapterStep>();
  for (const step of steps) {
    const existing = byId.get(step.step_id);
    if (!existing) {
      byId.set(step.step_id, JSON.parse(JSON.stringify(step)));
      continue;
    }
    for (const t of step.detect_by.text_contains) {
      if (!existing.detect_by.text_contains.includes(t)) existing.detect_by.text_contains.push(t);
    }
    for (const u of step.detect_by.url_contains) {
      if (!existing.detect_by.url_contains.includes(u)) existing.detect_by.url_contains.push(u);
    }
    if (step.fields) {
      existing.fields = dedupeFields([...(existing.fields ?? []), ...step.fields]);
    }
    if (step.uploads) {
      existing.uploads = dedupeUploads([...(existing.uploads ?? []), ...step.uploads]);
      existing.requires_user_approval_before_upload = true;
    }
  }
  return [...byId.values()];
}

function scoreSeverity(target: ScanTarget, pages: PageSnapshot[]): SeverityScore {
  const iframePages = pages.filter((p) => p.iframe_count > 0).length;
  const selectHeavy = pages.some((p) => p.fields.filter((f) => f.tag === 'select').length > 5);
  const pauseCount = new Set(pages.flatMap((p) => p.pause_triggers)).size;

  let automation = 2;
  if (pages.length > 4) automation += 1;
  if (iframePages > 0) automation += 1;
  if (selectHeavy) automation += 1;
  if (pages.some((p) => p.phase === 'unknown' && p.fields.length > 8)) automation += 1;

  let blockers = 1;
  if (pauseCount >= 2) blockers = 2;
  if (pauseCount >= 4) blockers = 3;
  if (pages.some((p) => p.phase === 'otp_aadhaar' || p.phase === 'captcha')) blockers += 1;
  if (pages.some((p) => p.phase === 'payment')) blockers += 1;
  blockers = Math.min(5, blockers);

  let compliance = 2;
  if (pages.some((p) => p.phase === 'auth')) compliance += 1;
  if (pages.some((p) => p.phase === 'submit')) compliance += 1;

  let stability = 2;
  if (target.portal_id.includes('edistrict')) stability = 3;
  if (iframePages > 1) stability += 1;
  stability = Math.min(5, stability);

  let userValue = 3;
  if (target.service_id === 'income_certificate') userValue = 5;
  if (target.service_id === 'learner_licence') userValue = 5;

  const total = automation + blockers + compliance + stability + userValue;
  let priority: SeverityScore['priority'] = 'P3';
  if (total <= 12) priority = 'P0';
  else if (total <= 15) priority = 'P1';
  else if (total <= 18) priority = 'P2';

  return {
    automation_difficulty: automation,
    blocker_density: blockers,
    compliance_risk: compliance,
    portal_stability: stability,
    user_value: userValue,
    total,
    priority,
  };
}

export function buildDraftAdapter(target: ScanTarget, pages: PageSnapshot[]): DraftAdapter {
  const allUnmappedFields: string[] = [];
  const allUnmappedUploads: string[] = [];
  const steps: AdapterStep[] = [];

  for (const page of pages) {
    if (page.fields.length === 0 && page.uploads.length === 0) continue;
    const { step, unmappedFields, unmappedUploads } = buildStep(page);
    if (step.fields?.length || step.uploads?.length) {
      steps.push(step);
      allUnmappedFields.push(...unmappedFields);
      allUnmappedUploads.push(...unmappedUploads);
    }
  }

  return {
    portal_id: target.portal_id,
    service_id: target.service_id,
    adapter_version: target.adapter_version,
    start_url: target.start_url,
    allowed_hosts: target.allowed_hosts,
    pause_at: [...DEFAULT_PAUSE_AT],
    steps: mergeSteps(steps),
    _meta: {
      generated_at: new Date().toISOString(),
      scanner_version: SCANNER_VERSION,
      target_id: target.id,
      page_count: pages.length,
      unmapped_fields: [...new Set(allUnmappedFields)],
      unmapped_uploads: [...new Set(allUnmappedUploads)],
    },
  };
}

export function buildScanReport(target: ScanTarget, pages: PageSnapshot[]): ScanReport {
  const draft = buildDraftAdapter(target, pages);
  const blockers: ScanReport['blockers'] = [];

  for (const page of pages) {
    if (page.iframe_count > 0) {
      blockers.push({ type: 'iframe', detail: `${page.iframe_count} iframe(s) on ${page.url}` });
    }
    for (const trigger of page.pause_triggers) {
      blockers.push({ type: 'pause', detail: `${trigger} detected on ${page.url}` });
    }
  }

  const stability_hints: string[] = [];
  if (pages.some((p) => p.iframe_count > 0)) {
    stability_hints.push('Payment or Aadhaar may load in iframes — manual pause required.');
  }
  if (draft._meta.unmapped_fields.length) {
    stability_hints.push(`${draft._meta.unmapped_fields.length} field(s) need manual profile_key mapping.`);
  }
  if (draft.steps.length === 0) {
    stability_hints.push('No autofill steps generated — scan form pages after login.');
  }

  return {
    target,
    scanned_at: new Date().toISOString(),
    pages,
    blockers,
    stability_hints,
    severity: scoreSeverity(target, pages),
    draft_adapter: draft,
  };
}