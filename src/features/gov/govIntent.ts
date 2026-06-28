/** Gov module intent — same pattern as Meta ads in main chat, not a separate app entry. */

export interface GovServiceMatch {
  service_id: string
  display_name: string
  clarifying_questions: string[]
}

const GOV_INTENTS: Array<GovServiceMatch & { keywords: string[] }> = [
  {
    service_id: 'learner_licence',
    display_name: 'Driving Licence (Sarathi Parivahan)',
    keywords: [
      'driving licence',
      'driving license',
      'learner licence',
      'learner license',
      'dl application',
      'driving permit',
      'sarathi',
      'parivahan',
    ],
    clarifying_questions: [
      'Do you need a learner licence or a permanent driving licence?',
      'Which vehicle class do you want (e.g. MCWG, LMV)?',
      'Which Indian state RTO will you apply through?',
    ],
  },
  {
    service_id: 'income_certificate',
    display_name: 'Income Certificate (e-District)',
    keywords: [
      'income certificate',
      'income proof certificate',
      'e-district income',
    ],
    clarifying_questions: [
      'Which state e-District portal do you need?',
      'Is this for school admission, loan, or another purpose?',
    ],
  },
]

const GOV_TOPIC_RE =
  /\b(passport|visa|pan card|aadhaar|driv\w*|learner licen|licen[cs]e|income certificate|government form|govt form|rti|foia|birth certificate|death certificate|voter id|ration card|sarathi|parivahan|rto)\b/i

const DRIVING_LICENCE_HINT_RE =
  /\b(driving|driv|learner|permanent|motor|sarathi|parivahan|rto|dl)\b.*\blicen|\blicen\w*\b.*\b(driving|driv|learner|motor|sarathi|parivahan|rto|dl|make|apply|get|need)\b|\bmake\s+(my\s+)?(a\s+)?driv/i

const INCOME_CERT_HINT_RE = /\bincom\w*\s+(cert|proof)|e[\s-]?district\s+incom/i

/** Devanagari / Hindi phrases for driving licence and gov paperwork */
const HINDI_DRIVING_RE =
  /ड्राइविंग|ड्राइव|लाइसेंस|लाइसेन्स|लर्नर|सारथी|परिवहन|डी[\s-]?एल|आर[\s-]?टी[\s-]?ओ|गाड़ी|वाहन|चालक/i

const HINDI_INCOME_RE = /आय\s*प्रमाण|इनकम|आय\s*प्रमाण\s*पत्र|e[\s-]?district/i

const HINDI_GOV_TOPIC_RE =
  /पासपोर्ट|वीज़ा|आधार|पैन|जन्म\s*प्रमाण|मृत्यु\s*प्रमाण|मतदाता|राशन|सरकारी\s*फॉर्म|सरकारी\s*फार्म/i

function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text)
}

function matchesHindiDrivingLicenceIntent(prompt: string): boolean {
  return HINDI_DRIVING_RE.test(prompt)
}

function matchesHindiIncomeCertificateIntent(prompt: string): boolean {
  return HINDI_INCOME_RE.test(prompt)
}

function matchesHindiGovTopic(prompt: string): boolean {
  return (
    matchesHindiDrivingLicenceIntent(prompt) ||
    matchesHindiIncomeCertificateIntent(prompt) ||
    HINDI_GOV_TOPIC_RE.test(prompt)
  )
}

/** Strip punctuation and fix common thumb-typo patterns before keyword match. */
export function normalizeGovPrompt(prompt: string): string {
  let text = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  text = text
    .replace(/\bdri{2,}i?v?ing\b/g, 'driving')
    .replace(/\bdrivng\b/g, 'driving')
    .replace(/\bdrivin\b/g, 'driving')
    .replace(/\bdriv\b/g, 'driving')
    .replace(/\blisc{1,2}en[cs]e\b/g, 'licence')
    .replace(/\blisence\b/g, 'licence')
    .replace(/\blicen[cs]e\b/g, 'licence')
    .replace(/\blearner\s+licen\w*/g, 'learner licence')
    .replace(/\bincom\s+cert\w*/g, 'income certificate')

  return text
}

function searchTexts(prompt: string): string[] {
  const raw = prompt.toLowerCase().trim()
  const normalized = normalizeGovPrompt(prompt)
  return raw === normalized ? [raw] : [raw, normalized]
}

export function matchesDrivingLicenceIntent(prompt: string): boolean {
  const texts = searchTexts(prompt)
  return texts.some((t) => DRIVING_LICENCE_HINT_RE.test(t))
}

export function matchesIncomeCertificateIntent(prompt: string): boolean {
  const texts = searchTexts(prompt)
  return texts.some((t) => INCOME_CERT_HINT_RE.test(t) || t.includes('income certificate'))
}

export function matchesGovTopic(prompt: string): boolean {
  return searchTexts(prompt).some((t) => GOV_TOPIC_RE.test(t))
}

export function resolveGovIntent(prompt: string): GovServiceMatch | null {
  if (containsDevanagari(prompt)) {
    if (matchesHindiDrivingLicenceIntent(prompt)) {
      const driving = GOV_INTENTS.find((e) => e.service_id === 'learner_licence')!
      return {
        service_id: driving.service_id,
        display_name: driving.display_name,
        clarifying_questions: driving.clarifying_questions,
      }
    }
    if (matchesHindiIncomeCertificateIntent(prompt)) {
      const income = GOV_INTENTS.find((e) => e.service_id === 'income_certificate')!
      return {
        service_id: income.service_id,
        display_name: income.display_name,
        clarifying_questions: income.clarifying_questions,
      }
    }
    if (matchesHindiGovTopic(prompt)) {
      return {
        service_id: 'learner_licence',
        display_name: 'Government paperwork',
        clarifying_questions: [
          'Which document or service do you need (passport, licence, certificate, visa)?',
          'Which country or state applies to you?',
        ],
      }
    }
  }

  const texts = searchTexts(prompt)

  for (const entry of GOV_INTENTS) {
    if (entry.keywords.some((k) => texts.some((t) => t.includes(k)))) {
      return {
        service_id: entry.service_id,
        display_name: entry.display_name,
        clarifying_questions: entry.clarifying_questions,
      }
    }
  }

  if (matchesDrivingLicenceIntent(prompt)) {
    const driving = GOV_INTENTS.find((e) => e.service_id === 'learner_licence')!
    return {
      service_id: driving.service_id,
      display_name: driving.display_name,
      clarifying_questions: driving.clarifying_questions,
    }
  }

  if (matchesIncomeCertificateIntent(prompt)) {
    const income = GOV_INTENTS.find((e) => e.service_id === 'income_certificate')!
    return {
      service_id: income.service_id,
      display_name: income.display_name,
      clarifying_questions: income.clarifying_questions,
    }
  }

  if (matchesGovTopic(prompt)) {
    return {
      service_id: 'learner_licence',
      display_name: 'Government paperwork',
      clarifying_questions: [
        'Which document or service do you need (passport, licence, certificate, visa)?',
        'Which country or state applies to you?',
      ],
    }
  }

  return null
}

export function clarifyingOptions(match: GovServiceMatch): Array<{
  id: string
  label: string
  prompt: string
  recommended?: boolean
}> {
  return match.clarifying_questions.map((q, i) => ({
    id: `gov-q-${i}`,
    label: q,
    prompt: q,
    recommended: i === 0,
  }))
}