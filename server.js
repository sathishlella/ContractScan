import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { scout } from './lib/scout.js';
import { analyze } from './lib/analyst.js';
import { execute } from './lib/executor.js';
import { supervise } from './lib/supervisor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  try {
    const { contract, mode } = req.body || {};
    if (!contract || contract.trim().length < 50) return res.status(400).json({ error: 'Contract text too short (min 50 chars).' });

    const scoutReport = scout(contract);
    const analystReport = analyze(scoutReport);
    const executorReport = await execute(scoutReport, analystReport, { useLLM: mode !== 'offline' });
    const supervisorReport = await supervise(scoutReport, analystReport, executorReport);

    res.json({
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
    });
  } catch (err) {
    console.error('ContractScan error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n  📜 ContractScan AI running at http://localhost:${PORT}\n`));
