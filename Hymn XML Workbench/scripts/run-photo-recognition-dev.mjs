#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { runRecognitionDevelopmentPipeline } from '../photo-recognition.mjs';

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error('Usage: node scripts/run-photo-recognition-dev.mjs INPUT-EVIDENCE.json OUTPUT-REPORT.json');
  process.exit(1);
}

const input = JSON.parse(await readFile(inputArg, 'utf8'));
const report = runRecognitionDevelopmentPipeline(input);
await writeFile(outputArg, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Photo quality: ${report.quality.decision}`);
if (report.quality.reasons.length) console.log(`Rejection reasons: ${report.quality.reasons.join(' | ')}`);
if (report.quality.recommendations.length) console.log(`Quality notices: ${report.quality.recommendations.join(' | ')}`);
console.log(`Recognition result: ${report.emission.decision}`);
console.log(`Items: ${JSON.stringify(report.emission.counts)}`);
console.log(`Conflicts: ${report.conflicts.length}`);
console.log(`Wrote ${outputArg}`);
