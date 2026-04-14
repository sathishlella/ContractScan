/**
 * ContractScan AI — Agent C: Executor
 * Generates negotiation playbook + optional LLM summary
 */

import Groq from 'groq-sdk';

let _groq;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// ─── Negotiation Playbook Generator (Rule-Based) ────────────────
function generatePlaybook(analystReport) {
  const playbook = [];

  // Priority 1: Critical red flags
  for (const flag of (analystReport.redFlags || []).filter(f => f.severity === 'critical')) {
    playbook.push({
      priority: 'P0 — Must Fix',
      issue: flag.flag,
      category: flag.category,
      currentRisk: 'Critical',
      action: flag.advice,
      suggestedLanguage: getSuggestedLanguage(flag),
      walkAwayIf: 'Other party refuses to negotiate this point',
    });
  }

  // Priority 2: High red flags
  for (const flag of (analystReport.redFlags || []).filter(f => f.severity === 'high')) {
    playbook.push({
      priority: 'P1 — Strongly Recommend',
      issue: flag.flag,
      category: flag.category,
      currentRisk: 'High',
      action: flag.advice,
      suggestedLanguage: getSuggestedLanguage(flag),
      walkAwayIf: null,
    });
  }

  // Priority 3: Missing clauses
  for (const missing of (analystReport.missingClauses || []).filter(m => m.importance === 'critical')) {
    playbook.push({
      priority: 'P1 — Add Clause',
      issue: `Missing ${missing.type} clause`,
      category: 'missing-protection',
      currentRisk: 'High',
      action: missing.advice,
      suggestedLanguage: getMissingClauseTemplate(missing.type),
      walkAwayIf: null,
    });
  }

  // Priority 4: Medium flags
  for (const flag of (analystReport.redFlags || []).filter(f => f.severity === 'medium').slice(0, 5)) {
    playbook.push({
      priority: 'P2 — Nice to Have',
      issue: flag.flag,
      category: flag.category,
      currentRisk: 'Medium',
      action: flag.advice,
      suggestedLanguage: null,
      walkAwayIf: null,
    });
  }

  return playbook;
}

function getSuggestedLanguage(flag) {
  const templates = {
    'Unlimited liability exposure': '"The aggregate liability of either Party under this Agreement shall not exceed the total fees paid or payable in the twelve (12) month period preceding the claim."',
    'Immediate termination without notice': '"Either Party may terminate this Agreement upon thirty (30) days\' prior written notice to the other Party."',
    'Unilateral price increase right': '"Provider may increase fees no more than once per annual period, with at least sixty (60) days\' advance written notice, and such increase shall not exceed the greater of 5% or the Consumer Price Index change."',
    'Disclaimer of all warranties': '"Provider warrants that the Services will be performed in a professional and workmanlike manner consistent with generally accepted industry standards for a period of twelve (12) months."',
    'No refund upon termination': '"Upon termination for convenience by Provider, Client shall receive a pro-rata refund of any prepaid fees for the unused portion of the then-current Term."',
    'Unilateral termination right': '"Either Party may terminate this Agreement for convenience upon sixty (60) days\' prior written notice."',
  };
  return templates[flag.flag] || null;
}

function getMissingClauseTemplate(type) {
  const templates = {
    'liability': '"The aggregate liability of either Party shall not exceed the total fees paid under this Agreement in the twelve (12) months preceding the event giving rise to such liability."',
    'termination': '"Either Party may terminate this Agreement: (a) for material breach, upon thirty (30) days\' written notice with opportunity to cure; or (b) for convenience, upon sixty (60) days\' written notice."',
    'confidentiality': '"Each Party agrees to maintain the confidentiality of all Confidential Information received from the other Party for a period of three (3) years following disclosure."',
    'data-protection': '"Provider shall process personal data solely as necessary to perform its obligations and in compliance with applicable data protection laws, including GDPR and CCPA."',
    'governing-law': '"This Agreement shall be governed by and construed in accordance with the laws of [State/Country], without regard to conflict of law principles."',
  };
  return templates[type] || null;
}

// ─── LLM Executive Summary ──────────────────────────────────────
async function generateLLMSummary(scoutReport, analystReport, playbook) {
  if (!process.env.GROQ_API_KEY) return null;

  try {
    const groq = getGroq();
    const prompt = `You are ContractScan AI, an autonomous contract analysis agent. Generate a concise executive summary.

CONTRACT DATA:
- Type: ${analystReport.contractType}
- Risk Score: ${analystReport.riskAssessment?.score}/100 (Grade: ${analystReport.riskAssessment?.grade})
- Risk Level: ${analystReport.riskAssessment?.level}
- Total Clauses: ${scoutReport.summary?.totalClauses}
- Red Flags: ${analystReport.summary?.totalRedFlags} (${analystReport.summary?.criticalFlags} critical, ${analystReport.summary?.highFlags} high)
- Missing Clauses: ${analystReport.summary?.missingClauseCount}
- Obligations Found: ${analystReport.summary?.obligationCount}
- Deadlines: ${analystReport.summary?.deadlines}
- Parties: ${scoutReport.entities?.company?.slice(0, 3).join(', ') || 'not identified'}
- Key Amounts: ${scoutReport.entities?.money?.slice(0, 3).join(', ') || 'none found'}
- Key Dates: ${scoutReport.entities?.date?.slice(0, 3).join(', ') || 'none found'}

TOP RED FLAGS:
${analystReport.redFlags?.slice(0, 5).map(f => `- [${f.severity}] ${f.flag}`).join('\n')}

Write a 3-paragraph executive summary:
1. Contract overview (type, parties, key terms)
2. Main risks and red flags (be specific)
3. Recommendation: sign as-is, negotiate, or walk away

Keep it under 200 words. Direct and actionable. Write for a CEO, not a lawyer.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    return completion.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXECUTOR
// ═══════════════════════════════════════════════════════════════════
export async function execute(scoutReport, analystReport, options = {}) {
  const startTime = Date.now();

  const playbook = generatePlaybook(analystReport);
  const llmSummary = options.useLLM !== false
    ? await generateLLMSummary(scoutReport, analystReport, playbook)
    : null;

  return {
    agent: 'Executor',
    status: 'complete',
    durationMs: Date.now() - startTime,
    playbook,
    executiveSummary: llmSummary,
    recommendation: analystReport.riskAssessment?.score >= 40
      ? 'DO NOT SIGN without negotiating flagged items'
      : analystReport.riskAssessment?.score >= 15
      ? 'NEGOTIATE flagged items before signing'
      : 'LOW RISK — review flagged items but generally safe to sign',
  };
}
