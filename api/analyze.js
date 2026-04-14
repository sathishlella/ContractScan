import { scout } from '../lib/scout.js';
import { analyze } from '../lib/analyst.js';
import { execute } from '../lib/executor.js';
import { supervise } from '../lib/supervisor.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); return res.end(); }
  if (req.method !== 'POST') { res.writeHead(405, corsHeaders); return res.end(JSON.stringify({ error: 'POST only' })); }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { contract, mode } = body || {};

    if (!contract || typeof contract !== 'string' || contract.trim().length < 50) {
      res.writeHead(400, corsHeaders);
      return res.end(JSON.stringify({ error: 'Missing or too short "contract" field (min 50 chars).' }));
    }

    const scoutReport = scout(contract);
    const analystReport = analyze(scoutReport);
    const executorReport = await execute(scoutReport, analystReport, { useLLM: mode !== 'offline' });
    const supervisorReport = await supervise(scoutReport, analystReport, executorReport);

    res.writeHead(200, corsHeaders);
    return res.end(JSON.stringify({
      success: true,
      contractType: scoutReport.contractType,
      risk: analystReport.riskAssessment,
      summary: { ...scoutReport.summary, ...analystReport.summary },
      entities: scoutReport.entities,
      redFlags: analystReport.redFlags,
      missingClauses: analystReport.missingClauses,
      obligations: analystReport.obligations?.slice(0, 20),
      playbook: executorReport.playbook,
      recommendation: executorReport.recommendation,
      executiveSummary: executorReport.executiveSummary,
      quality: supervisorReport.qualityChecks,
      confidence: supervisorReport.confidenceScore,
      timing: supervisorReport.timing,
      disclaimer: supervisorReport.disclaimer,
      pipeline: {
        scout: { durationMs: scoutReport.durationMs, clauses: scoutReport.summary.totalClauses },
        analyst: { durationMs: analystReport.durationMs, redFlags: analystReport.summary.totalRedFlags },
        executor: { durationMs: executorReport.durationMs, playbookItems: executorReport.playbook?.length || 0 },
        supervisor: { durationMs: supervisorReport.durationMs, confidence: supervisorReport.confidenceScore },
      },
    }));
  } catch (err) {
    console.error('ContractScan error:', err);
    res.writeHead(500, corsHeaders);
    return res.end(JSON.stringify({ success: false, error: err.message }));
  }
}
