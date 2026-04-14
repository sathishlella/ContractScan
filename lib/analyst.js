/**
 * ContractScan AI — Agent B: Analyst
 * Risk Scoring, Red Flag Detection, Obligation Extraction
 *
 * ZERO LLM — Pure rule-based risk analysis
 */

// ─── Red Flag Knowledge Base (80+ rules) ────────────────────────
const RED_FLAG_RULES = [
  // Liability
  { pattern: /unlimited\s+liabilit/i, flag: 'Unlimited liability exposure', severity: 'critical', category: 'liability', advice: 'Negotiate a liability cap (typically 12 months of fees or contract value)' },
  { pattern: /consequential\s+(?:damage|loss).*(?:shall\s+not|will\s+not|won't)\s+(?:be\s+)?(?:limit|cap|restrict)/i, flag: 'No cap on consequential damages', severity: 'high', category: 'liability', advice: 'Exclude consequential damages or set a specific cap' },
  { pattern: /indemnif.*(?:all|any)\s+(?:loss|damage|claim|cost|expense)/i, flag: 'Broad indemnification obligation', severity: 'high', category: 'liability', advice: 'Narrow the indemnification scope to direct, third-party claims only' },
  { pattern: /hold\s+harmless.*(?:any|all)\s+(?:claim|action|suit)/i, flag: 'Broad hold harmless clause', severity: 'high', category: 'liability', advice: 'Limit hold harmless to claims arising from your breach only' },

  // Termination
  { pattern: /terminat.*(?:at\s+any\s+time|without\s+cause|for\s+convenience|at\s+(?:its|their)\s+sole\s+discretion)/i, flag: 'Unilateral termination right', severity: 'high', category: 'termination', advice: 'Ensure termination for convenience requires notice period and mutual rights' },
  { pattern: /terminat.*(?:immediate|forthwith|without\s+(?:prior\s+)?notice)/i, flag: 'Immediate termination without notice', severity: 'critical', category: 'termination', advice: 'Require minimum 30-day written notice for termination' },
  { pattern: /(?:no|without)\s+(?:refund|return|repayment).*(?:terminat|cancel)/i, flag: 'No refund upon termination', severity: 'high', category: 'financial', advice: 'Negotiate pro-rata refund for unused services/prepaid fees' },
  { pattern: /(?:penalty|liquidated\s+damage|early\s+termination\s+fee)/i, flag: 'Early termination penalty', severity: 'medium', category: 'financial', advice: 'Negotiate reduction or waiver of termination penalty' },

  // Auto-renewal
  { pattern: /auto(?:matic)?(?:ally)?\s+renew/i, flag: 'Auto-renewal clause detected', severity: 'medium', category: 'duration', advice: 'Ensure opt-out window is at least 30-60 days before renewal date' },
  { pattern: /(?:renew|extend).*(?:same\s+terms|identical\s+terms)/i, flag: 'Renewal locks in same terms', severity: 'low', category: 'duration', advice: 'Add right to renegotiate pricing/terms at renewal' },

  // IP Rights
  { pattern: /(?:all|any)\s+(?:intellectual\s+property|IP).*(?:belong|vest|assign|transfer).*(?:to|in)\s+(?:the\s+)?(?:company|client|vendor|provider)/i, flag: 'IP assignment to one party', severity: 'high', category: 'ip', advice: 'Clarify which IP is assigned vs. licensed, and retention of pre-existing IP' },
  { pattern: /work(?:\s+|-)(?:for|made\s+for)\s+hire/i, flag: 'Work-for-hire clause', severity: 'medium', category: 'ip', advice: 'Ensure this only covers work specifically commissioned under this contract' },

  // Non-compete
  { pattern: /non.?compet.*(?:\d+\s*year|\d+\s*month)/i, flag: 'Non-compete with duration', severity: 'high', category: 'restriction', advice: 'Review duration and geographic scope — many states limit enforceability' },
  { pattern: /non.?compet(?:e|ition)/i, flag: 'Non-compete clause present', severity: 'medium', category: 'restriction', advice: 'Non-competes are increasingly restricted by law (FTC, California, etc.)' },
  { pattern: /non.?solicit.*(?:\d+\s*year|\d+\s*month)/i, flag: 'Non-solicitation restriction', severity: 'medium', category: 'restriction', advice: 'Ensure scope is limited to direct reports/clients you worked with' },

  // Data & Privacy
  { pattern: /(?:retain|keep|store).*(?:data|information).*(?:indefinite|perpetual|forever)/i, flag: 'Indefinite data retention', severity: 'high', category: 'privacy', advice: 'Set specific data retention and deletion periods' },
  { pattern: /(?:share|disclose|transfer).*(?:personal|customer)\s+(?:data|information).*(?:third\s+part|affiliate|partner)/i, flag: 'Third-party data sharing', severity: 'high', category: 'privacy', advice: 'Require explicit consent and list of approved third parties' },
  { pattern: /(?:GDPR|CCPA|HIPAA).*(?:comply|compliance|compliant)/i, flag: 'Regulatory compliance reference', severity: 'low', category: 'compliance', advice: 'Verify actual compliance measures, not just contractual claims' },

  // Financial
  { pattern: /(?:price|fee|rate).*(?:increase|adjust|change).*(?:at\s+(?:any|its)\s+(?:sole\s+)?discretion|without\s+(?:prior\s+)?notice)/i, flag: 'Unilateral price increase right', severity: 'critical', category: 'financial', advice: 'Cap price increases (e.g., CPI or max 5% annually) with advance notice' },
  { pattern: /(?:late|overdue).*(?:fee|penalty|interest|charge).*(?:\d+%|percent)/i, flag: 'Late payment penalty', severity: 'medium', category: 'financial', advice: 'Negotiate reasonable late fee rate and grace period' },
  { pattern: /(?:minimum|guaranteed)\s+(?:commitment|purchase|spend|order|volume)/i, flag: 'Minimum commitment requirement', severity: 'high', category: 'financial', advice: 'Ensure minimum is realistic and aligned with projected usage' },

  // Governing Law
  { pattern: /(?:governed\s+by|subject\s+to).*(?:laws?\s+of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i, flag: 'Specific governing law jurisdiction', severity: 'low', category: 'legal', advice: 'Ensure jurisdiction is favorable to your organization' },
  { pattern: /(?:waiv|surrender|give\s+up).*(?:right\s+to\s+(?:jury\s+)?trial|class\s+action)/i, flag: 'Waiver of legal rights', severity: 'high', category: 'legal', advice: 'Consider whether waiving jury trial / class action is acceptable' },
  { pattern: /(?:mandatory|binding)\s+arbitration/i, flag: 'Mandatory arbitration clause', severity: 'medium', category: 'legal', advice: 'Review arbitration rules, location, and cost-sharing arrangements' },

  // Warranty
  { pattern: /(?:as.?is|no\s+warrant|disclaim.*(?:all|any)\s+warrant)/i, flag: 'Disclaimer of all warranties', severity: 'high', category: 'warranty', advice: 'Negotiate minimum warranty period (typically 12 months)' },
  { pattern: /(?:fitness\s+for\s+(?:a\s+)?particular\s+purpose|merchantabilit).*(?:disclaim|exclude|waiv)/i, flag: 'Implied warranty disclaimer', severity: 'medium', category: 'warranty', advice: 'Ensure express warranties are adequate to cover your needs' },

  // Assignment
  { pattern: /(?:not|cannot|shall\s+not)\s+(?:assign|transfer).*(?:without\s+(?:prior\s+)?(?:written\s+)?consent)/i, flag: 'Assignment restriction', severity: 'low', category: 'rights', advice: 'Standard clause — ensure exceptions for internal restructuring' },

  // Broad definitions
  { pattern: /(?:including\s+but\s+not\s+limited\s+to|without\s+limitation)/i, flag: 'Open-ended scope language', severity: 'low', category: 'scope', advice: 'Review what this broad language applies to — may expand obligations unexpectedly' },

  // SLA
  { pattern: /(?:99(?:\.\d+)?%|uptime|availability).*(?:target|goal|objective|endeavor|best\s+effort)/i, flag: 'SLA is target/best-effort only (not guaranteed)', severity: 'medium', category: 'service', advice: 'Negotiate firm SLA commitments with service credits for non-compliance' },

  // Force Majeure
  { pattern: /force\s+majeure.*(?:pandemic|epidemic|disease)/i, flag: 'Force majeure includes pandemic/epidemic', severity: 'low', category: 'protection', advice: 'Post-COVID, review whether pandemic force majeure is still appropriate' },
];

// ─── Missing Clause Detection ────────────────────────────────────
const EXPECTED_CLAUSES = {
  'NDA': ['confidentiality', 'term', 'termination', 'governing-law', 'severability', 'entire-agreement'],
  'SaaS Agreement': ['term', 'payment', 'SLA', 'termination', 'liability', 'data-protection', 'warranty', 'confidentiality', 'governing-law'],
  'Employment Contract': ['term', 'payment', 'termination', 'confidentiality', 'non-compete', 'intellectual-property', 'governing-law'],
  'Service Agreement': ['term', 'payment', 'termination', 'liability', 'indemnification', 'warranty', 'confidentiality', 'governing-law'],
  'License Agreement': ['term', 'payment', 'intellectual-property', 'termination', 'liability', 'warranty', 'governing-law'],
  'General Contract': ['term', 'payment', 'termination', 'liability', 'confidentiality', 'governing-law'],
};

// ─── Obligation Extractor ────────────────────────────────────────
const OBLIGATION_PATTERNS = [
  { pattern: /(?:shall|must|is\s+required\s+to|agrees?\s+to|will|is\s+obligat)/gi, type: 'obligation', strength: 'mandatory' },
  { pattern: /(?:should|may\s+(?:not)?|is\s+encouraged|is\s+expected)/gi, type: 'recommendation', strength: 'advisory' },
  { pattern: /(?:within\s+\d+\s+(?:day|business\s+day|week|month|hour))/gi, type: 'deadline', strength: 'mandatory' },
  { pattern: /(?:no\s+later\s+than|prior\s+to|before\s+the|on\s+or\s+before)/gi, type: 'deadline', strength: 'mandatory' },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN ANALYST
// ═══════════════════════════════════════════════════════════════════
export function analyze(scoutReport) {
  const startTime = Date.now();

  if (!scoutReport || !Array.isArray(scoutReport.clauses)) {
    return { agent: 'Analyst', status: 'error', message: 'Invalid scout report', durationMs: Date.now() - startTime };
  }

  const fullText = scoutReport.clauses.map(c => c.fullText).join('\n\n');

  // Phase 1: Red flag detection
  const redFlags = [];
  for (const rule of RED_FLAG_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    if (regex.test(fullText)) {
      // Find which clause contains this flag
      const matchingClause = scoutReport.clauses.find(c => new RegExp(rule.pattern.source, rule.pattern.flags).test(c.fullText));
      redFlags.push({
        flag: rule.flag,
        severity: rule.severity,
        category: rule.category,
        advice: rule.advice,
        clauseIndex: matchingClause?.index,
        context: matchingClause?.text?.slice(0, 200),
      });
    }
  }

  // Phase 2: Missing clause detection
  const contractType = scoutReport.contractType?.type || 'General Contract';
  const expected = EXPECTED_CLAUSES[contractType] || EXPECTED_CLAUSES['General Contract'];
  const foundTypes = new Set(scoutReport.clauses.map(c => c.primaryType));
  const missingClauses = expected.filter(t => !foundTypes.has(t));

  // Phase 3: Obligation extraction
  const obligations = [];
  for (const clause of scoutReport.clauses) {
    for (const oblPattern of OBLIGATION_PATTERNS) {
      const regex = new RegExp(oblPattern.pattern.source, oblPattern.pattern.flags);
      const matches = clause.fullText.match(regex);
      if (matches && matches.length > 0) {
        // Extract the sentence containing the obligation
        const sentences = clause.fullText.split(/[.!?]+/).filter(s => s.trim().length > 10);
        for (const sentence of sentences) {
          if (new RegExp(oblPattern.pattern.source, oblPattern.pattern.flags).test(sentence)) {
            obligations.push({
              text: sentence.trim().slice(0, 300),
              type: oblPattern.type,
              strength: oblPattern.strength,
              clauseType: clause.primaryType,
              clauseIndex: clause.index,
            });
          }
        }
      }
    }
  }
  // Deduplicate
  const uniqueObligations = [];
  const seenObl = new Set();
  for (const obl of obligations) {
    const key = obl.text.slice(0, 60);
    if (!seenObl.has(key)) {
      seenObl.add(key);
      uniqueObligations.push(obl);
    }
  }

  // Phase 4: Risk scoring
  let riskScore = 0;
  const sevWeights = { critical: 25, high: 15, medium: 5, low: 1 };
  for (const flag of redFlags) {
    riskScore += sevWeights[flag.severity] || 5;
  }
  // Missing clauses add risk
  riskScore += missingClauses.length * 8;

  const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 10 ? 'medium' : 'low';
  const riskGrade = riskScore >= 60 ? 'F' : riskScore >= 45 ? 'D' : riskScore >= 30 ? 'C' : riskScore >= 15 ? 'B' : riskScore >= 5 ? 'B+' : 'A';

  // Phase 5: Clause balance analysis
  const partyMentions = {};
  const parties = scoutReport.entities?.party || [];
  for (const party of parties) {
    const name = party.replace(/['"]/g, '').trim();
    if (name.length > 2) {
      const count = (fullText.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
      partyMentions[name] = count;
    }
  }

  const elapsed = Date.now() - startTime;

  return {
    agent: 'Analyst',
    status: 'complete',
    durationMs: elapsed,
    contractType,
    riskAssessment: {
      score: Math.min(100, riskScore),
      level: riskLevel,
      grade: riskGrade,
      verdict: riskScore >= 30
        ? 'This contract has significant risks that need legal review before signing'
        : riskScore >= 10
        ? 'Moderate risks detected — review flagged items before signing'
        : 'Low risk contract — standard terms with minor issues',
    },
    redFlags: redFlags.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] || 4) - (order[b.severity] || 4);
    }),
    missingClauses: missingClauses.map(type => ({
      type,
      importance: expected.indexOf(type) < 3 ? 'critical' : 'recommended',
      advice: `Consider adding a ${type} clause to protect your interests`,
    })),
    obligations: uniqueObligations.slice(0, 30),
    summary: {
      totalRedFlags: redFlags.length,
      criticalFlags: redFlags.filter(f => f.severity === 'critical').length,
      highFlags: redFlags.filter(f => f.severity === 'high').length,
      missingClauseCount: missingClauses.length,
      obligationCount: uniqueObligations.length,
      mandatoryObligations: uniqueObligations.filter(o => o.strength === 'mandatory').length,
      deadlines: uniqueObligations.filter(o => o.type === 'deadline').length,
    },
  };
}
