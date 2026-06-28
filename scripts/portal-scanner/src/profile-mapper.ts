import type { AdapterField, AdapterUpload, ExtractedField, ExtractedUpload } from './types.js';

/** Label fragments → profile_key. Longer matches win. */
const PROFILE_RULES: Array<{ key: string; variants: string[]; type: AdapterField['type'] }> = [
  { key: 'full_name', variants: ['applicant name', 'name of applicant', 'full name', 'name in full'], type: 'text' },
  { key: 'father_name', variants: ["father's name", 'father name', 'father/husband', 'husband name'], type: 'text' },
  { key: 'dob', variants: ['date of birth', 'dob', 'birth date', 'born on'], type: 'date' },
  { key: 'mobile', variants: ['mobile number', 'mobile no', 'contact number', 'phone number', 'mobile'], type: 'tel' },
  { key: 'email', variants: ['email id', 'e-mail', 'email address', 'email'], type: 'email' },
  { key: 'address_line1', variants: ['residential address', 'current address', 'permanent address', 'address line', 'address'], type: 'textarea' },
  { key: 'district', variants: ['district', 'tehsil', 'taluka'], type: 'text' },
  { key: 'state', variants: ['state/ut', 'state name', 'state'], type: 'text' },
  { key: 'pincode', variants: ['pin code', 'pincode', 'postal code', 'zip code'], type: 'text' },
  { key: 'purpose', variants: ['purpose of certificate', 'purpose', 'reason for application'], type: 'text' },
  { key: 'annual_income', variants: ['annual income', 'income per annum', 'yearly income', 'total income'], type: 'text' },
  { key: 'vehicle_class', variants: ['vehicle class', 'class of vehicle', 'cov', 'category of vehicle'], type: 'select' },
  { key: 'aadhaar_last4', variants: ['aadhaar last', 'last 4 digit', 'uid last'], type: 'text' },
];

const DOCUMENT_RULES: Array<{ key: string; variants: string[] }> = [
  { key: 'identity_proof', variants: ['identity proof', 'id proof', 'aadhaar', 'voter id', 'pan card'] },
  { key: 'address_proof', variants: ['address proof', 'residence proof', 'domicile proof'] },
  { key: 'income_proof', variants: ['income proof', 'salary slip', 'income document', 'itr'] },
  { key: 'age_proof', variants: ['age proof', 'birth certificate', 'school certificate'] },
  { key: 'photo', variants: ['photograph', 'passport size', 'photo', 'applicant photo'] },
  { key: 'signature', variants: ['signature', 'sign scan'] },
];

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function bestMatch(label: string, rules: Array<{ key: string; variants: string[] }>): string | null {
  const n = norm(label);
  if (!n) return null;
  let best: { key: string; len: number } | null = null;
  for (const rule of rules) {
    for (const variant of rule.variants) {
      const v = norm(variant);
      if (n.includes(v) || v.includes(n)) {
        if (!best || v.length > best.len) best = { key: rule.key, len: v.length };
      }
    }
  }
  return best?.key ?? null;
}

function inferInputType(field: ExtractedField): AdapterField['type'] {
  if (field.tag === 'textarea') return 'textarea';
  if (field.tag === 'select') return 'select';
  const t = field.input_type.toLowerCase();
  if (t === 'email') return 'email';
  if (t === 'tel') return 'tel';
  if (t === 'date') return 'date';
  return 'text';
}

function labelVariants(label: string, name: string, placeholder: string): string[] {
  const raw = [label, name, placeholder].map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const n = norm(r);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(r);
  }
  if (out.length === 0 && label) out.push(label);
  return out;
}

export function mapField(field: ExtractedField): { adapter: AdapterField | null; unmapped: string } {
  const combined = [field.label, field.name, field.placeholder, field.id].join(' ');
  const profileKey = bestMatch(combined, PROFILE_RULES);
  const variants = labelVariants(field.label, field.name, field.placeholder);
  const display = variants[0] || field.selector;

  if (!profileKey) {
    return { adapter: null, unmapped: display };
  }

  const rule = PROFILE_RULES.find((r) => r.key === profileKey)!;
  return {
    adapter: {
      label_variants: variants.length ? variants : [display],
      profile_key: profileKey,
      type: field.tag === 'select' ? 'select' : rule.type === 'text' ? inferInputType(field) : rule.type,
    },
    unmapped: '',
  };
}

export function mapUpload(upload: ExtractedUpload): { adapter: AdapterUpload | null; unmapped: string } {
  const docKey = bestMatch(upload.label, DOCUMENT_RULES);
  const variants = labelVariants(upload.label, '', '');
  const display = variants[0] || upload.selector;

  if (!docKey) {
    return { adapter: null, unmapped: display };
  }

  return {
    adapter: {
      label_variants: variants.length ? variants : [display],
      document_key: docKey,
    },
    unmapped: '',
  };
}

export function dedupeFields(fields: AdapterField[]): AdapterField[] {
  const byKey = new Map<string, AdapterField>();
  for (const f of fields) {
    const existing = byKey.get(f.profile_key);
    if (!existing) {
      byKey.set(f.profile_key, { ...f, label_variants: [...f.label_variants] });
      continue;
    }
    for (const v of f.label_variants) {
      if (!existing.label_variants.includes(v)) existing.label_variants.push(v);
    }
  }
  return [...byKey.values()];
}

export function dedupeUploads(uploads: AdapterUpload[]): AdapterUpload[] {
  const byKey = new Map<string, AdapterUpload>();
  for (const u of uploads) {
    const existing = byKey.get(u.document_key);
    if (!existing) {
      byKey.set(u.document_key, { ...u, label_variants: [...u.label_variants] });
      continue;
    }
    for (const v of u.label_variants) {
      if (!existing.label_variants.includes(v)) existing.label_variants.push(v);
    }
  }
  return [...byKey.values()];
}