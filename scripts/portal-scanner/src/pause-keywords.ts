export const DEFAULT_PAUSE_AT = [
  'otp',
  'captcha',
  'password',
  'declaration',
  'payment',
  'submit',
  'aadhaar authentication',
  'face authentication',
  'biometric',
  'e-sign',
  'digital signature',
  'learner test',
];

export const PAUSE_PATTERNS = [
  { keyword: 'otp', pattern: /\botp\b|one.?time.?password|verify.?mobile/i },
  { keyword: 'captcha', pattern: /\bcaptcha\b|security.?code|enter.?characters/i },
  { keyword: 'password', pattern: /\bpassword\b|enter.?pin/i },
  { keyword: 'declaration', pattern: /\bdeclaration\b|i.?hereby|affidavit|undertaking/i },
  { keyword: 'payment', pattern: /\bpayment\b|pay.?now|fee.?payment|make.?payment/i },
  { keyword: 'submit', pattern: /\bfinal.?submit\b|submit.?application|confirm.?submit/i },
  { keyword: 'aadhaar authentication', pattern: /aadhaar|uidai|aadhar/i },
  { keyword: 'biometric', pattern: /biometric|fingerprint|iris/i },
  { keyword: 'e-sign', pattern: /e-?sign|digital.?signature/i },
];

export function detectPauseTriggers(text: string): string[] {
  const found = new Set<string>();
  for (const { keyword, pattern } of PAUSE_PATTERNS) {
    if (pattern.test(text)) found.add(keyword);
  }
  return [...found];
}