type StringKey =
  | 'gov_licence_type_question'
  | 'gov_state_question'
  | 'gov_researching'
  | 'gov_checklist_research'
  | 'gov_checklist_fallback'
  | 'gov_opt_learner'
  | 'gov_opt_permanent'
  | 'gov_opt_explain'
  | 'gov_licence_explain'
  | 'gov_composer_state'
  | 'gov_composer_answer'
  | 'welcome_chat'
  | 'composer_placeholder'
  | 'disclaimer'

const STRINGS: Record<string, Partial<Record<StringKey, string>>> = {
  en: {
    gov_licence_type_question: 'Which type of {service} do you need?',
    gov_state_question: 'Which Indian state RTO will you apply through?',
    gov_researching: 'Checking official web sources for {state} {licenceType} licence requirements…',
    gov_checklist_research: '{message} Gather these on your phone (we never store them):',
    gov_checklist_fallback:
      'Standard requirements for {state} — gather these on your phone (we never store them):',
    gov_opt_learner: 'Learner licence (first step)',
    gov_opt_permanent: 'Permanent driving licence',
    gov_opt_explain: 'Explain learner vs permanent first',
    gov_licence_explain:
      'In India you normally apply through Parivahan (Sarathi). A learner licence is the first step — practice with an L sign, then after the waiting period and driving test you apply for a permanent licence. Rules vary by state and vehicle class (MCWG, LMV, etc.). We confirm requirements from official sources before opening the portal — never guess on forms.',
    gov_composer_state: 'Type your state (e.g. Maharashtra)…',
    gov_composer_answer: 'Type your answer…',
    welcome_chat: 'What should we build?',
    composer_placeholder: 'Build a site, make a meta ad, or apply for a licence…',
    disclaimer: 'I am not always Perfect',
  },
  hinglish: {
    gov_licence_type_question: 'Aapko kaun sa {service} chahiye?',
    gov_state_question: 'Aap kis Indian state ke RTO se apply karenge?',
    gov_researching:
      '{state} ke {licenceType} licence ki official requirements check ho rahi hain…',
    gov_checklist_research:
      '{message} Ye documents apne phone par ready rakho (hum store nahi karte):',
    gov_checklist_fallback:
      '{state} ke standard documents — apne phone par ready rakho (hum store nahi karte):',
    gov_opt_learner: 'Learner licence (pehla step)',
    gov_opt_permanent: 'Permanent driving licence',
    gov_opt_explain: 'Pehle learner vs permanent samjha do',
    gov_licence_explain:
      'India mein usually Parivahan (Sarathi) se apply karte hain. Learner licence pehla step hai — L sign ke saath practice, phir waiting period aur driving test ke baad permanent licence. Rules state aur vehicle class (MCWG, LMV, etc.) ke hisaab se alag hote hain. Portal kholne se pehle hum official sources se requirements confirm karte hain — forms par guess nahi karte.',
    gov_composer_state: 'Apna state likho (jaise Maharashtra)…',
    gov_composer_answer: 'Apna jawab likho…',
    welcome_chat: 'Hum kya banayein?',
    composer_placeholder: 'Site banao, meta ad, ya licence ke liye help…',
    disclaimer: 'Main hamesha perfect nahi hota',
  },
  hi: {
    gov_licence_type_question: 'आपको किस प्रकार का {service} चाहिए?',
    gov_state_question: 'आप किस भारतीय राज्य के RTO से आवेदन करेंगे?',
    gov_researching:
      '{state} के {licenceType} लाइसेंस की आधिकारिक आवश्यकताएँ जाँची जा रही हैं…',
    gov_checklist_research: '{message} ये दस्तावेज़ अपने फ़ोन पर तैयार रखें (हम इन्हें सेव नहीं करते):',
    gov_checklist_fallback:
      '{state} के मानक दस्तावेज़ — अपने फ़ोन पर तैयार रखें (हम इन्हें सेव नहीं करते):',
    gov_opt_learner: 'लर्नर लाइसेंस (पहला कदम)',
    gov_opt_permanent: 'स्थायी ड्राइविंग लाइसेंस',
    gov_opt_explain: 'पहले लर्नर और स्थायी में अंतर समझाएँ',
    gov_licence_explain:
      'भारत में आमतौर पर Parivahan (Sarathi) से आवेदन होता है। लर्नर लाइसेंस पहला कदम है — L चिह्न के साथ अभ्यास, फिर प्रतीक्षा अवधि और ड्राइविंग टेस्ट के बाद स्थायी लाइसेंस। नियम राज्य और वाहन वर्ग के अनुसार अलग होते हैं। पोर्टल खोलने से पहले हम आधिकारिक स्रोतों से आवश्यकताएँ पुष्टि करते हैं।',
    gov_composer_state: 'अपना राज्य लिखें (जैसे महाराष्ट्र)…',
    gov_composer_answer: 'अपना उत्तर लिखें…',
    welcome_chat: 'हम क्या बनाएँ?',
    composer_placeholder: 'वेबसाइट, विज्ञापन, या लाइसेंस के लिए मदद लें…',
    disclaimer: 'मैं हमेशा सही नहीं होता',
  },
  ta: {
    gov_licence_type_question: 'உங்களுக்கு எந்த வகை {service} தேவை?',
    gov_state_question: 'எந்த இந்திய மாநில RTO வழியாக விண்ணப்பிப்பீர்கள்?',
    gov_researching: '{state} {licenceType} உரிமத் தேவைகள் அதிகாரப்பூர்வ மூலங்களில் சரிபார்க்கப்படுகின்றன…',
    welcome_chat: 'நாம் என்ன உருவாக்குவது?',
    disclaimer: 'நான் எப்போதும் சரியாக இருக்க மாட்டேன்',
  },
}

export function t(
  languageCode: string,
  key: StringKey,
  vars?: Record<string, string>,
): string {
  const lang =
    STRINGS[languageCode] ||
    (languageCode === 'hinglish' ? STRINGS.hinglish : null) ||
    STRINGS.en
  const fallback = STRINGS.en[key] || key
  let text = lang[key] || STRINGS.hinglish[key] || fallback
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v)
    }
  }
  return text
}