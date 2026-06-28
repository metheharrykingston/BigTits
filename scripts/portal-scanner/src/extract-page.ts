import type { Page } from 'playwright';
import { detectPauseTriggers } from './pause-keywords.js';
import type { ExtractedButton, ExtractedField, ExtractedUpload, PagePhase, PageSnapshot } from './types.js';

const EXTRACT_SCRIPT = `
(() => {
  function norm(s) {
    return (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
  }

  function labelFor(el) {
    if (el.id) {
      const lab = document.querySelector('label[for="' + el.id + '"]');
      if (lab) return (lab.textContent || '').trim();
    }
    const aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();
    const parent = el.closest('div, td, tr, li, fieldset, label, .form-group, .form-row');
    if (!parent) return '';
    const clone = parent.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, button').forEach((n) => n.remove());
    return (clone.textContent || '').trim().slice(0, 200);
  }

  function selectorFor(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
    return el.tagName.toLowerCase();
  }

  function classifyButton(text) {
    const t = norm(text);
    if (/pay|fee|amount/.test(t)) return 'pay';
    if (/final|submit/.test(t)) return 'submit';
    if (/save|continue|next|proceed/.test(t)) return 'next';
    return 'unknown';
  }

  const fields = [];
  const inputs = document.querySelectorAll('input, textarea, select');
  for (const el of inputs) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || tag).toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'file') continue;
    if (el.disabled || el.readOnly) continue;

    const label = labelFor(el);
    const options = [];
    if (tag === 'select') {
      for (const opt of el.options) {
        const txt = (opt.textContent || '').trim();
        if (txt) options.push(txt);
      }
    }

    fields.push({
      selector: selectorFor(el),
      tag,
      input_type: type,
      id: el.id || '',
      name: el.name || '',
      placeholder: el.placeholder || '',
      label,
      required: el.required || el.getAttribute('aria-required') === 'true',
      options,
    });
  }

  const uploads = [];
  const fileInputs = document.querySelectorAll('input[type="file"]');
  for (const el of fileInputs) {
    uploads.push({
      selector: selectorFor(el),
      label: labelFor(el),
      accept: el.accept || '',
    });
  }

  const buttons = [];
  const clickables = document.querySelectorAll('button, input[type="submit"], a.btn, a.button, [role="button"]');
  for (const el of clickables) {
    const text = (el.textContent || el.value || '').trim().slice(0, 120);
    if (!text || text.length < 2) continue;
    buttons.push({
      label: text,
      selector: selectorFor(el),
      action: classifyButton(text),
    });
  }

  const headings = [];
  for (const h of document.querySelectorAll('h1, h2, h3')) {
    const t = (h.textContent || '').trim();
    if (t) headings.push(t);
  }

  const bodyText = norm(document.body ? document.body.innerText.slice(0, 4000) : '');

  return {
    url: location.href,
    title: document.title,
    headings,
    body_text_sample: bodyText,
    fields,
    uploads,
    buttons,
    iframe_count: document.querySelectorAll('iframe').length,
    body_text_full: document.body ? document.body.innerText.slice(0, 8000) : '',
  };
})();
`;

function classifyPhase(url: string, headings: string[], body: string, uploads: ExtractedUpload[]): PagePhase {
  const text = `${url} ${headings.join(' ')} ${body}`.toLowerCase();

  // Upload pages often mention OTP in footer — detect uploads first.
  if (uploads.length > 0 || /\bupload document\b|\battach document\b|\bdocument upload\b/.test(text)) {
    return 'documents';
  }

  if (/\bcaptcha\b/.test(text)) return 'captcha';
  if (/\botp\b|aadhaar|uidai|verify mobile|one time password/.test(text)) return 'otp_aadhaar';
  if (/\bpayment\b|pay now|fee payment|make payment/.test(text)) return 'payment';
  if (/\bdeclaration\b|i hereby|affidavit|undertaking/.test(text)) return 'declaration';
  if (/\bfinal submit\b|submit application|confirm submit/.test(text)) return 'submit';
  if (/\btrack\b|application status|acknowledgement|download certificate/.test(text)) return 'track';
  if (/\blogin\b|sign in|register\b|password/.test(text) && !/\bapplicant\b/.test(text)) return 'auth';
  if (/\bapplicant\b|\bpersonal detail\b|\bprofile\b/.test(text)) return 'profile';
  if (/\bincome\b|\bvehicle class\b|\bpurpose\b|\bservice detail\b/.test(text)) return 'service_fields';

  return 'unknown';
}

export async function extractPage(page: Page, index: number): Promise<PageSnapshot> {
  const raw = await page.evaluate(EXTRACT_SCRIPT);
  const bodyFull: string = raw.body_text_full ?? raw.body_text_sample;
  const pauseTriggers = detectPauseTriggers(bodyFull);
  const uploads: ExtractedUpload[] = raw.uploads ?? [];
  const headings: string[] = raw.headings ?? [];

  return {
    index,
    url: raw.url,
    title: raw.title,
    headings,
    body_text_sample: raw.body_text_sample,
    fields: raw.fields ?? [],
    uploads,
    buttons: raw.buttons ?? [],
    iframe_count: raw.iframe_count ?? 0,
    pause_triggers: pauseTriggers,
    phase: classifyPhase(raw.url, headings, bodyFull, uploads),
  };
}