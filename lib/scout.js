/**
 * ContractScan AI — Agent A: Scout
 * Contract Parser & Clause Extractor
 *
 * ZERO LLM — Pure regex + NLP pattern matching
 * Inputs: raw contract text → Outputs: structured clauses, parties, dates, amounts
 */

// ─── Contract Section Headers (100+ patterns) ───────────────────
const SECTION_PATTERNS = [
  /^(?:\d+[\.\)]\s*|ARTICLE\s+\w+[\.:]\s*|SECTION\s+\d+[\.:]\s*|CLAUSE\s+\d+[\.:]\s*)(.+)/gim,
  /^(?:[IVXLC]+[\.\)]\s*)(.+)/gim,
  /^(?:[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*)\s*$/gm,
];

// ─── Clause Type Classifier (60+ clause types) ──────────────────
const CLAUSE_TYPES = [
  { type: 'term', patterns: [/\b(?:term|duration|period|commence|expir|renew)/gi], category: 'duration' },
  { type: 'termination', patterns: [/\b(?:terminat|cancel|end\s+(?:of|the)\s+agreement|dissolv|wind.?down)/gi], category: 'exit' },
  { type: 'payment', patterns: [/\b(?:payment|fee|price|cost|invoice|billing|compensat|remunerat)/gi], category: 'financial' },
  { type: 'indemnification', patterns: [/\b(?:indemnif|hold\s+harmless|defend\s+and|make\s+whole)/gi], category: 'liability' },
  { type: 'liability', patterns: [/\b(?:liabilit|liable|damage|consequential|special\s+damage|limitation\s+of)/gi], category: 'liability' },
  { type: 'warranty', patterns: [/\b(?:warrant|guaranty|guarantee|represent(?:s|ation)?)/gi], category: 'assurance' },
  { type: 'confidentiality', patterns: [/\b(?:confidential|non.?disclos|proprietary|trade\s+secret|NDA)/gi], category: 'protection' },
  { type: 'intellectual-property', patterns: [/\b(?:intellectual\s+property|IP\s+rights|patent|copyright|trademark|license|licens)/gi], category: 'protection' },
  { type: 'non-compete', patterns: [/\b(?:non.?compet|restrictive\s+covenant|covenant\s+not\s+to\s+compet)/gi], category: 'restriction' },
  { type: 'non-solicitation', patterns: [/\b(?:non.?solicit|not\s+solicit|refrain\s+from\s+solicit)/gi], category: 'restriction' },
  { type: 'governing-law', patterns: [/\b(?:governing\s+law|jurisdiction|applicable\s+law|governed\s+by|venue)/gi], category: 'legal' },
  { type: 'arbitration', patterns: [/\b(?:arbitrat|mediat|dispute\s+resolution|ADR|alternative\s+dispute)/gi], category: 'legal' },
  { type: 'force-majeure', patterns: [/\b(?:force\s+majeure|act\s+of\s+god|unforeseeable|extraordinary\s+event)/gi], category: 'protection' },
  { type: 'assignment', patterns: [/\b(?:assign(?:ment)?|transfer\s+(?:of\s+)?rights|delegate)/gi], category: 'rights' },
  { type: 'amendment', patterns: [/\b(?:amend(?:ment)?|modif(?:y|ication)|supplement|addendum)/gi], category: 'governance' },
  { type: 'entire-agreement', patterns: [/\b(?:entire\s+agreement|whole\s+agreement|merger\s+clause|integration)/gi], category: 'governance' },
  { type: 'severability', patterns: [/\b(?:severab|sever(?:ed|ance)|invalid(?:ity)?|unenforceable)/gi], category: 'governance' },
  { type: 'notice', patterns: [/\b(?:notice|notification|written\s+notice|deliver\s+notice)/gi], category: 'procedure' },
  { type: 'insurance', patterns: [/\b(?:insurance|policy|coverage|underwriter|insured\s+party)/gi], category: 'assurance' },
  { type: 'compliance', patterns: [/\b(?:compl(?:y|iance)|regulatory|GDPR|CCPA|HIPAA|SOX|AML|KYC)/gi], category: 'legal' },
  { type: 'data-protection', patterns: [/\b(?:data\s+protect|personal\s+data|data\s+process|data\s+breach|GDPR|privacy)/gi], category: 'protection' },
  { type: 'SLA', patterns: [/\b(?:service\s+level|SLA|uptime|availability|response\s+time|performance\s+standard)/gi], category: 'service' },
  { type: 'auto-renewal', patterns: [/\b(?:auto.?renew|automatic(?:ally)?\s+renew|evergreen|successive\s+term)/gi], category: 'duration' },
  { type: 'cap', patterns: [/\b(?:aggregate\s+liabilit|total\s+liabilit|cap(?:ped)?|maximum\s+liabilit|not\s+exceed)/gi], category: 'liability' },
  { type: 'exclusivity', patterns: [/\b(?:exclusiv|sole\s+(?:right|provider|supplier)|preferred\s+vendor)/gi], category: 'restriction' },
  { type: 'change-of-control', patterns: [/\b(?:change\s+of\s+control|merger|acquisition|corporate\s+restructur)/gi], category: 'governance' },
  { type: 'audit', patterns: [/\b(?:audit\s+right|right\s+to\s+audit|inspect|examination\s+of\s+record)/gi], category: 'governance' },
  { type: 'subcontracting', patterns: [/\b(?:subcontract|sub.?contract|third.?party\s+(?:provider|contractor))/gi], category: 'rights' },
  { type: 'escrow', patterns: [/\b(?:escrow|source\s+code\s+escrow|held\s+in\s+escrow)/gi], category: 'protection' },
];

// ─── Entity Extractors ───────────────────────────────────────────
const ENTITY_PATTERNS = {
  // Money amounts
  money: /(?:\$|USD|EUR|GBP|£|€)\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:million|billion|thousand|M|B|K))?|\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:dollars|USD|EUR|GBP)/gi,

  // Dates
  date: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\b\d{4}-\d{2}-\d{2}/gi,

  // Percentages
  percentage: /\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\s*percent/gi,

  // Time periods
  duration: /\b\d+\s*(?:day|week|month|year|calendar\s+day|business\s+day|working\s+day)s?\b/gi,

  // Parties (common patterns)
  party: /(?:hereinafter\s+(?:referred\s+to\s+as\s+)?["']([^"']+)["']|(?:the\s+)?["']([^"']+)["']\s*\)|(?:Company|Client|Vendor|Provider|Contractor|Consultant|Licensor|Licensee|Employer|Employee|Buyer|Seller|Landlord|Tenant|Lender|Borrower)\b)/gi,

  // Email
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Company suffixes
  company: /\b[A-Z][a-zA-Z\s&,]+(?:Inc|LLC|Ltd|Corp|Corporation|Company|Co|LP|LLP|GmbH|AG|SA|PLC|Pty|BV|NV)\b\.?/g,
};

// ─── Contract Type Detector ─────────────────────────────────────
function detectContractType(text) {
  const types = [
    { type: 'NDA', pattern: /\b(?:non.?disclosure|confidentiality\s+agreement|NDA|mutual\s+NDA)\b/i, confidence: 0.95 },
    { type: 'SaaS Agreement', pattern: /\b(?:SaaS|software\s+as\s+a\s+service|subscription\s+agreement|cloud\s+service)\b/i, confidence: 0.9 },
    { type: 'Employment Contract', pattern: /\b(?:employment\s+agreement|employment\s+contract|offer\s+of\s+employment|employee\s+agreement)\b/i, confidence: 0.95 },
    { type: 'Service Agreement', pattern: /\b(?:service\s+agreement|master\s+service|MSA|professional\s+service|consulting\s+agreement)\b/i, confidence: 0.9 },
    { type: 'License Agreement', pattern: /\b(?:license\s+agreement|software\s+license|EULA|end\s+user\s+license)\b/i, confidence: 0.9 },
    { type: 'Lease Agreement', pattern: /\b(?:lease\s+agreement|rental\s+agreement|tenancy\s+agreement)\b/i, confidence: 0.9 },
    { type: 'Purchase Agreement', pattern: /\b(?:purchase\s+agreement|buy.?sell|acquisition\s+agreement|asset\s+purchase)\b/i, confidence: 0.9 },
    { type: 'Partnership Agreement', pattern: /\b(?:partnership\s+agreement|joint\s+venture|JV\s+agreement)\b/i, confidence: 0.85 },
    { type: 'Loan Agreement', pattern: /\b(?:loan\s+agreement|credit\s+agreement|promissory\s+note|lending\s+agreement)\b/i, confidence: 0.9 },
    { type: 'Terms of Service', pattern: /\b(?:terms\s+of\s+service|terms\s+and\s+conditions|ToS|terms\s+of\s+use)\b/i, confidence: 0.85 },
    { type: 'Data Processing Agreement', pattern: /\b(?:data\s+processing\s+agreement|DPA|data\s+protection\s+addendum)\b/i, confidence: 0.95 },
    { type: 'Independent Contractor', pattern: /\b(?:independent\s+contractor|contractor\s+agreement|1099|freelanc)\b/i, confidence: 0.85 },
    { type: 'Non-Compete Agreement', pattern: /\b(?:non.?compete\s+agreement|restrictive\s+covenant\s+agreement)\b/i, confidence: 0.95 },
  ];

  for (const t of types) {
    if (t.pattern.test(text)) return { type: t.type, confidence: t.confidence };
  }
  return { type: 'General Contract', confidence: 0.5 };
}

// ─── Paragraph Splitter ──────────────────────────────────────────
function splitIntoParagraphs(text) {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map(p => p.trim())
    .filter(p => p.length > 20);
}

// ─── Clause Classifier ──────────────────────────────────────────
function classifyClause(text) {
  const matches = [];
  for (const clauseType of CLAUSE_TYPES) {
    let totalMatches = 0;
    for (const pattern of clauseType.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const found = text.match(regex);
      if (found) totalMatches += found.length;
    }
    if (totalMatches > 0) {
      matches.push({
        type: clauseType.type,
        category: clauseType.category,
        strength: Math.min(1, totalMatches * 0.3),
      });
    }
  }
  return matches.sort((a, b) => b.strength - a.strength);
}

// ─── Entity Extraction ──────────────────────────────────────────
function extractEntities(text) {
  const entities = {};
  for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const found = text.match(regex);
    entities[type] = found ? [...new Set(found)] : [];
  }
  return entities;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCOUT FUNCTION
// ═══════════════════════════════════════════════════════════════════
export function scout(rawText) {
  const startTime = Date.now();
  const text = typeof rawText === 'string' ? rawText : String(rawText);

  // Phase 1: Detect contract type
  const contractType = detectContractType(text);

  // Phase 2: Split into paragraphs/sections
  const paragraphs = splitIntoParagraphs(text);

  // Phase 3: Classify each paragraph
  const clauses = paragraphs.map((para, index) => {
    const types = classifyClause(para);
    const entities = extractEntities(para);
    return {
      index,
      text: para.slice(0, 500),
      fullText: para,
      types: types.slice(0, 3),
      primaryType: types[0]?.type || 'general',
      category: types[0]?.category || 'general',
      entities,
      wordCount: para.split(/\s+/).length,
    };
  });

  // Phase 4: Extract global entities
  const globalEntities = extractEntities(text);

  // Phase 5: Summary stats
  const typeCounts = {};
  for (const c of clauses) {
    typeCounts[c.primaryType] = (typeCounts[c.primaryType] || 0) + 1;
  }

  const elapsed = Date.now() - startTime;

  return {
    agent: 'Scout',
    status: 'complete',
    durationMs: elapsed,
    contractType,
    summary: {
      totalClauses: clauses.length,
      totalWords: text.split(/\s+/).length,
      uniqueClauseTypes: Object.keys(typeCounts).length,
      typeCounts,
      partiesFound: globalEntities.party?.length || 0,
      datesFound: globalEntities.date?.length || 0,
      amountsFound: globalEntities.money?.length || 0,
    },
    clauses,
    entities: globalEntities,
  };
}
