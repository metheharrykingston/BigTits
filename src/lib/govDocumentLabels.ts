export interface GovDocLabel {
  question: string
  hint: string
  examples: string
}

const LABELS: Record<string, Record<string, GovDocLabel>> = {
  en: {
    address_proof: {
      question: 'Do you have Aadhaar card?',
      hint: 'Most people use Aadhaar for address proof on Sarathi.',
      examples: 'Aadhaar PDF or photo on your phone',
    },
    identity_proof: {
      question: 'Do you have Aadhaar or PAN card?',
      hint: 'Either works for identity on e-District.',
      examples: 'Aadhaar or PAN photo/PDF',
    },
    age_proof: {
      question: 'Do you have birth certificate or 10th marksheet?',
      hint: 'Proves your date of birth for the RTO.',
      examples: 'School TC, birth certificate, or passport',
    },
    photo: {
      question: 'Do you have a passport-size photo?',
      hint: 'White background, recent photo.',
      examples: 'JPEG/PNG on your gallery',
    },
    signature: {
      question: 'Do you have your signature scan?',
      hint: 'Clear photo or scan on white paper.',
      examples: 'Photo of signature on paper',
    },
    income_proof: {
      question: 'Do you have salary slip or bank statement?',
      hint: 'For income certificate only.',
      examples: 'Last 3 months salary slip or ITR',
    },
  },
  hinglish: {
    address_proof: {
      question: 'Kya aapke paas Aadhaar card hai?',
      hint: 'Sarathi par address proof ke liye zyada log Aadhaar use karte hain.',
      examples: 'Phone par Aadhaar PDF ya photo',
    },
    identity_proof: {
      question: 'Kya aapke paas Aadhaar ya PAN card hai?',
      hint: 'Dono mein se koi bhi chalega.',
      examples: 'Aadhaar ya PAN ki photo/PDF',
    },
    age_proof: {
      question: 'Kya aapke paas birth certificate ya 10th marksheet hai?',
      hint: 'RTO ko date of birth prove karni hoti hai.',
      examples: 'School TC, janam praman, ya passport',
    },
    photo: {
      question: 'Passport size photo ready hai?',
      hint: 'Safed background, recent photo.',
      examples: 'Gallery se JPEG/PNG',
    },
    signature: {
      question: 'Signature ki photo ya scan hai?',
      hint: 'Safed kagaz par clear signature.',
      examples: 'Signature ki photo',
    },
    income_proof: {
      question: 'Salary slip ya bank statement hai?',
      hint: 'Sirf income certificate ke liye.',
      examples: '3 mahine ki salary slip ya ITR',
    },
  },
  hi: {
    address_proof: {
      question: 'क्या आपके पास आधार कार्ड है?',
      hint: 'सारथी पर पते के प्रमाण के लिए ज़्यादातर लोग आधार का उपयोग करते हैं।',
      examples: 'फ़ोन पर आधार PDF या फ़ोटो',
    },
    identity_proof: {
      question: 'क्या आपके पास आधार या PAN कार्ड है?',
      hint: 'दोनों में से कोई भी चलेगा।',
      examples: 'आधार या PAN की फ़ोटो/PDF',
    },
    age_proof: {
      question: 'क्या आपके पास जन्म प्रमाण या 10वीं अंकपत्र है?',
      hint: 'RTO के लिए जन्म तिथि का प्रमाण।',
      examples: 'स्कूल TC, जन्म प्रमाण, या पासपोर्ट',
    },
    photo: {
      question: 'पासपोर्ट साइज़ फ़ोटो तैयार है?',
      hint: 'सफ़ेद पृष्ठभूमि, हाल की फ़ोटो।',
      examples: 'गैलरी से JPEG/PNG',
    },
    signature: {
      question: 'हस्ताक्षर की फ़ोटो या स्कैन है?',
      hint: 'सफ़ेद कागज़ पर स्पष्ट हस्ताक्षर।',
      examples: 'हस्ताक्षर की फ़ोटो',
    },
    income_proof: {
      question: 'वेतन पर्ची या बैंक स्टेटमेंट है?',
      hint: 'केवल आय प्रमाण पत्र के लिए।',
      examples: '3 महीने की salary slip या ITR',
    },
  },
}

export function govDocLabel(docKey: string, languageCode: string): GovDocLabel {
  const lang = LABELS[languageCode] || LABELS.hinglish || LABELS.en
  return (
    lang[docKey] || {
      question: `Do you have ${docKey.replaceAll('_', ' ')}?`,
      hint: 'Keep it on your phone — we never upload to our servers.',
      examples: 'Photo or PDF on your device',
    }
  )
}

export function friendlyChecklistIntro(languageCode: string, state?: string): string {
  const place = state || 'your state'
  if (languageCode === 'hi') {
    return `आपको ${place} के लिए ये दस्तावेज़ चाहिए होंगे। जो आपके पास हैं उन्हें चुनें — हम कभी भी आपकी फ़ाइलें सर्वर पर नहीं रखते।`
  }
  if (languageCode === 'hinglish') {
    return `${place} ke learner licence ke liye yeh documents chahiye. Jo aapke paas hain unhe tick karo — hum aapki files server par save nahi karte.`
  }
  return `For ${place}, you'll need these documents. Tick what you already have on your phone — we never store your files on our servers.`
}

export function nextStepHint(languageCode: string, ready: number, total: number): string {
  if (ready < total) {
    if (languageCode === 'hi') return `अगला: अपने पास मौजूद दस्तावेज़ चुनें (${ready}/${total})`
    if (languageCode === 'hinglish') return `Agla step: jo documents hain unhe tick karo (${ready}/${total})`
    return `Next: tick documents you have (${ready}/${total})`
  }
  if (languageCode === 'hi') return 'सब तैयार — अब सरकारी पोर्टल खोलें और वहीं अपलोड करें।'
  if (languageCode === 'hinglish') return 'Sab ready — ab official portal kholo aur wahi upload karo.'
  return 'All set — open the official portal and upload there.'
}