/**
 * ContractScan AI — Agent D: Supervisor
 * Quality validation, confidence scoring, pipeline QA
 */

import Groq from 'groq-sdk';

let _groq;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

export async function supervise(scoutReport, analystReport, executorReport) {
  const startTime = Date.now();

  // Phase 1: Validate analysis quality
  const qualityChecks = [];

  // Check: enough clauses parsed
  const clauseCount = scoutReport?.summary?.totalClauses || 0;
  if (clauseCount < 3) {
    qualityChecks.push({ check: 'clause-coverage', status: 'warning', message: `Only ${clauseCount} clauses found — contract may not have been fully parsed` });
  } else {
    qualityChecks.push({ check: 'clause-coverage', status: 'pass', message: `${clauseCount} clauses parsed successfully` });
  }

  // Check: contract type identified
  if (scoutReport?.contractType?.confidence >= 0.8) {
    qualityChecks.push({ check: 'contract-type', status: 'pass', message: `Identified as ${scoutReport.contractType.type} (${Math.round(scoutReport.contractType.confidence * 100)}% confidence)` });
  } else {
    qualityChecks.push({ check: 'contract-type', status: 'warning', message: `Low confidence in contract type classification (${Math.round((scoutReport?.contractType?.confidence || 0) * 100)}%)` });
  }

  // Check: entities found
  const entitiesFound = Object.values(scoutReport?.entities || {}).flat().length;
  if (entitiesFound >= 3) {
    qualityChecks.push({ check: 'entity-extraction', status: 'pass', message: `${entitiesFound} entities extracted (dates, amounts, parties)` });
  } else {
    qualityChecks.push({ check: 'entity-extraction', status: 'warning', message: 'Few entities found — contract may be template/incomplete' });
  }

  // Check: red flags are consistent
  const criticalFlags = analystReport?.summary?.criticalFlags || 0;
  const riskLevel = analystReport?.riskAssessment?.level || 'unknown';
  if (criticalFlags > 0 && riskLevel === 'low') {
    qualityChecks.push({ check: 'risk-consistency', status: 'fail', message: 'Critical flags detected but risk level is low — inconsistency' });
  } else {
    qualityChecks.push({ check: 'risk-consistency', status: 'pass', message: 'Risk assessment is consistent with detected flags' });
  }

  // Check: playbook generated
  if ((executorReport?.playbook || []).length > 0) {
    qualityChecks.push({ check: 'playbook-generation', status: 'pass', message: `${executorReport.playbook.length} negotiation items generated` });
  } else if (analystReport?.summary?.totalRedFlags > 0) {
    qualityChecks.push({ check: 'playbook-generation', status: 'warning', message: 'Red flags found but no playbook items generated' });
  } else {
    qualityChecks.push({ check: 'playbook-generation', status: 'pass', message: 'No playbook needed — low risk contract' });
  }

  // Phase 2: Overall confidence score
  const passCount = qualityChecks.filter(q => q.status === 'pass').length;
  const confidenceScore = Math.round(passCount / qualityChecks.length * 100);

  // Phase 3: Pipeline timing
  const timing = {
    scout: scoutReport?.durationMs || 0,
    analyst: analystReport?.durationMs || 0,
    executor: executorReport?.durationMs || 0,
    total: (scoutReport?.durationMs || 0) + (analystReport?.durationMs || 0) + (executorReport?.durationMs || 0),
    humanEquivalent: '2-4 hours (junior lawyer) or $500-$1,500 (outside counsel)',
  };

  const elapsed = Date.now() - startTime;

  return {
    agent: 'Supervisor',
    status: 'complete',
    durationMs: elapsed,
    qualityChecks,
    confidenceScore,
    timing: {
      ...timing,
      supervisor: elapsed,
      totalWithSupervisor: timing.total + elapsed,
    },
    overallAssessment: {
      analysisReliable: confidenceScore >= 60,
      recommendation: confidenceScore >= 80
        ? 'High confidence analysis — actionable as-is'
        : confidenceScore >= 50
        ? 'Moderate confidence — review flagged items with legal counsel'
        : 'Low confidence — contract may need manual review',
    },
    disclaimer: 'ContractScan AI provides automated analysis for informational purposes only. This is not legal advice. Consult a qualified attorney before signing any contract.',
  };
}
