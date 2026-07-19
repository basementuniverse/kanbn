#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { spawnSync } from 'child_process';

function usage() {
  console.error('Usage: node skills/kanbn-plan/scripts/validate-kanbn.mjs [project-root]');
}

function resolveProjectRoot(argv) {
  if (argv.length > 1) {
    usage();
    process.exit(1);
  }

  return path.resolve(argv[0] || process.cwd());
}

function ensureKanbnFiles(projectRoot) {
  const indexPath = path.join(projectRoot, '.kanbn', 'index.md');
  const tasksPath = path.join(projectRoot, '.kanbn', 'tasks');

  if (!fs.existsSync(indexPath)) {
    console.error(`No Kanbn index found at ${indexPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(tasksPath)) {
    console.error(`No Kanbn tasks directory found at ${tasksPath}`);
    process.exit(1);
  }
}

function getCandidates(projectRoot) {
  const candidates = [];
  const localBin = path.join(projectRoot, 'node_modules', '.bin', 'kanbn');

  if (process.env.KANBN_BIN) {
    candidates.push({ command: process.env.KANBN_BIN, args: [], label: process.env.KANBN_BIN });
  }

  if (fs.existsSync(localBin)) {
    candidates.push({ command: localBin, args: [], label: localBin });
  }

  candidates.push({ command: 'kanbn', args: [], label: 'kanbn' });
  candidates.push({ command: 'npx', args: ['-y', '@basementuniverse/kanbn'], label: 'npx -y @basementuniverse/kanbn' });

  return candidates;
}

function runValidate(projectRoot) {
  const candidates = getCandidates(projectRoot);
  let lastError = null;

  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.args, 'validate', '--json'],
      {
        cwd: projectRoot,
        encoding: 'utf8'
      }
    );

    if (result.error && result.error.code === 'ENOENT') {
      lastError = result.error;
      continue;
    }

    return { candidate, result };
  }

  throw lastError || new Error('Unable to locate a runnable Kanbn CLI');
}

function extractValidationErrors(output) {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

function main() {
  const projectRoot = resolveProjectRoot(process.argv.slice(2));
  ensureKanbnFiles(projectRoot);

  let execution;
  try {
    execution = runValidate(projectRoot);
  } catch (error) {
    console.error(`Unable to run Kanbn validation: ${error.message}`);
    process.exit(1);
  }

  const { candidate, result } = execution;
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

  if (result.status === 0) {
    if (combinedOutput) {
      console.log(combinedOutput);
    } else {
      console.log(`Kanbn validation passed via ${candidate.label}`);
    }
    return;
  }

  const errors = extractValidationErrors(combinedOutput);
  if (errors) {
    console.error(`Kanbn validation reported ${errors.length} error(s) via ${candidate.label}:`);
    for (const error of errors) {
      if (error && typeof error === 'object') {
        console.error(JSON.stringify(error, null, 2));
      } else {
        console.error(String(error));
      }
    }
    process.exit(1);
  }

  console.error(combinedOutput || `Kanbn validation failed via ${candidate.label}`);
  process.exit(result.status || 1);
}

main();
