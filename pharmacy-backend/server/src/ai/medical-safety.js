const EDUCATIONAL_DISCLAIMER =
  'Educational pharmacy information only — not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified pharmacist or doctor for personal medical guidance.';

const EMERGENCY_PATTERNS = [
  /\b(chest\s+pain|chest\s+tightness|crushing\s+chest|heart\s+attack)\b/i,
  /\b(can'?t\s+breathe|cannot\s+breathe|difficulty\s+breathing|shortness\s+of\s+breath|struggling\s+to\s+breathe|choking)\b/i,
  /\b(anaphylaxis|severe\s+allergic|throat\s+swelling|swollen\s+tongue|swollen\s+lips|face\s+swelling)\b/i,
  /\b(stroke|face\s+drooping|slurred\s+speech|sudden\s+numbness|paralysis)\b/i,
  /\b(overdose|took\s+too\s+many\s+pills|swallowed\s+poison|poisoning)\b/i,
  /\b(unconscious|passed\s+out|not\s+waking\s+up|seizure|convulsion|fitting)\b/i,
  /\b(severe\s+bleeding|uncontrolled\s+bleeding|coughing\s+up\s+blood|vomiting\s+blood)\b/i,
  /\b(suicid(e|al)|kill\s+myself|want\s+to\s+die|self[\s-]harm|hurt\s+myself)\b/i,
];

const PHARMACIST_ESCALATION_PATTERNS = [
  /\b(dosage|dose|how\s+much\s+should\s+i\s+take|how\s+many\s+(tablets|capsules|ml|drops))\b/i,
  /\b(interact(ion|s)?|take\s+together|mix\s+with|safe\s+with|contraindicat(ed|ion))\b/i,
  /\b(pregnan(t|cy)|breastfeed(ing)?|nursing|newborn|infant|baby\s+dose|child\s+dose|pediatric)\b/i,
  /\b(diagnos(e|is)|what\s+do\s+i\s+have|prescribe|prescription\s+change|stop\s+taking|replace\s+my\s+medicine|switch\s+medication)\b/i,
  /\b(kidney\s+disease|liver\s+disease|allergic\s+to|side\s+effect|adverse\s+reaction)\b/i,
];

function detectMedicalEmergency(message) {
  const text = String(message || '');
  return EMERGENCY_PATTERNS.some((pattern) => pattern.test(text));
}

function shouldRecommendPharmacist(message) {
  const text = String(message || '');
  return PHARMACIST_ESCALATION_PATTERNS.some((pattern) => pattern.test(text));
}

function buildEmergencyResponse() {
  return {
    emergency: true,
    recommendPharmacist: true,
    reply:
      'This sounds like a potential medical emergency. Please seek immediate emergency medical attention right away — call your local emergency number (e.g., 991 / 992 in Zambia or your local emergency service) or go to the nearest hospital emergency department immediately. Do not wait for an online response.',
    disclaimer: EDUCATIONAL_DISCLAIMER,
    sources: [
      { label: 'WHO Emergency Care Guidance', url: 'https://www.who.int/health-topics/emergency-care' },
    ],
  };
}

function redactForLogs(value) {
  if (!value) return '';
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\d\s()-]{6,}\d)/g, '[redacted-phone]')
    .slice(0, 120);
}

function buildMedicalSystemPrompt({ catalogueContext, verifiedAlternatives }) {
  const catalogueJson = JSON.stringify(catalogueContext || [], null, 2);
  const alternativesJson = JSON.stringify(verifiedAlternatives || [], null, 2);

  return [
    'You are the MediQuick Smart Assistant for MediQuick Pharmacy.',
    '',
    'CORE SAFETY & CLINICAL BOUNDARIES (STRICT — NEVER VIOLATE):',
    '1. Provide general, educational pharmacy and health information ONLY. You are NOT a doctor or licensed pharmacist.',
    '2. NEVER diagnose medical conditions, NEVER prescribe medicines, and NEVER invent or calculate personal dosages, drug interactions, or contraindications.',
    '3. If a user asks for a diagnosis, personal dosing (especially for children, pregnancy, breastfeeding, or chronic conditions), drug interactions, contraindications, or prescription changes, clearly state that a qualified pharmacist or physician must review their individual case and invite them to use the "Pharmacy Support" tab to speak with a MediQuick pharmacist.',
    '4. If a user describes urgent or emergency symptoms (chest pain, breathing difficulty, severe allergic swelling, stroke signs, overdose, severe bleeding, self-harm), immediately instruct them to seek emergency hospital care.',
    '5. Never ask for or store sensitive personal identifiers, payment details, or passwords.',
    '',
    'VERIFIED MEDIQUICK CATALOGUE GROUNDING (STRICT):',
    '- ONLY mention MediQuick product names, prices (ZMW), prescription requirements, or stock availability that appear verbatim in the VERIFIED_CATALOGUE JSON below.',
    '- NEVER fabricate products, prices, strengths, active ingredients, or stock levels.',
    '- NEVER claim an item is in stock unless its "inStock" field is strictly true in VERIFIED_CATALOGUE.',
    '- If a requested item is not in VERIFIED_CATALOGUE, clearly say you could not confirm it in the live online catalogue and suggest checking the Shop page or messaging a MediQuick pharmacist via Pharmacy Support.',
    '- ONLY suggest product alternatives that appear in VERIFIED_ALTERNATIVES below (which are verified same active ingredient, strength, and dosage form). Always note that any substitution requires pharmacist confirmation. Never present different active ingredients or different strengths as equivalent substitutes.',
    '- For general clinical information, align with established public health sources (WHO, NHS, MedlinePlus, CDC) without inventing fake study citations or URLs.',
    '',
    'STYLE:',
    '- Be warm, concise, clear, and structured (short paragraphs or brief bullets).',
    '- Keep responses focused and practical (typically 2-5 short sentences unless listing verified catalogue items).',
    '',
    `VERIFIED_CATALOGUE:\n${catalogueJson}`,
    '',
    `VERIFIED_ALTERNATIVES:\n${alternativesJson}`,
  ].join('\n');
}

module.exports = {
  EDUCATIONAL_DISCLAIMER,
  buildEmergencyResponse,
  buildMedicalSystemPrompt,
  detectMedicalEmergency,
  redactForLogs,
  shouldRecommendPharmacist,
};
