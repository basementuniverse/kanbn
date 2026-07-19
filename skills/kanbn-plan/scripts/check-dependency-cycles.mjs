#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';

function usage() {
  console.error('Usage: node skills/kanbn-plan/scripts/check-dependency-cycles.mjs [project-root] [--json]');
}

function parseArgs(argv) {
  let projectRoot = process.cwd();
  let json = false;

  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
      continue;
    }

    if (arg.startsWith('-')) {
      usage();
      process.exit(1);
    }

    if (projectRoot !== process.cwd()) {
      usage();
      process.exit(1);
    }

    projectRoot = arg;
  }

  return {
    json,
    projectRoot: path.resolve(projectRoot)
  };
}

function ensureKanbnFiles(projectRoot) {
  const tasksPath = path.join(projectRoot, '.kanbn', 'tasks');
  if (!fs.existsSync(tasksPath)) {
    throw new Error(`No Kanbn tasks directory found at ${tasksPath}`);
  }
  return tasksPath;
}

function normaliseRelationType(type) {
  return String(type || '').trim().toLowerCase();
}

function getTaskIdFromHref(href) {
  const fileName = path.basename(String(href || '').trim());
  return fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
}

function extractRelationsSection(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sectionLines = [];
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+Relations\s*$/.test(line.trim())) {
      inSection = true;
      continue;
    }

    if (inSection && /^##\s+/.test(line.trim())) {
      break;
    }

    if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n').trim();
}

function parseRelations(markdown) {
  const section = extractRelationsSection(markdown);
  if (!section) {
    return [];
  }

  const relations = [];
  const lines = section.split(/\r?\n/);
  const relationPattern = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*$/;

  for (const line of lines) {
    const match = line.trim().match(relationPattern);
    if (!match) {
      continue;
    }

    const text = match[1].trim();
    const href = match[2].trim();
    const targetTaskId = getTaskIdFromHref(href);
    const relationType = text.endsWith(targetTaskId)
      ? text.slice(0, text.length - targetTaskId.length).trim()
      : text;

    relations.push({
      task: targetTaskId,
      type: normaliseRelationType(relationType)
    });
  }

  return relations;
}

function loadTasks(tasksPath) {
  const tasks = new Map();

  for (const entry of fs.readdirSync(tasksPath, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const taskId = entry.name.slice(0, -3);
    const markdown = fs.readFileSync(path.join(tasksPath, entry.name), 'utf8');
    tasks.set(taskId, {
      id: taskId,
      relations: parseRelations(markdown)
    });
  }

  return tasks;
}

function buildDependencyGraph(tasks) {
  const graph = new Map();
  const danglingReferences = [];

  for (const taskId of tasks.keys()) {
    graph.set(taskId, new Set());
  }

  for (const [taskId, task] of tasks.entries()) {
    for (const relation of task.relations) {
      if (!relation.task) {
        continue;
      }

      let fromId = null;
      let toId = null;

      if (relation.type === 'depends-on') {
        fromId = relation.task;
        toId = taskId;
      } else if (relation.type === 'blocks') {
        fromId = taskId;
        toId = relation.task;
      } else {
        continue;
      }

      if (!tasks.has(fromId) || !tasks.has(toId)) {
        danglingReferences.push({
          from: taskId,
          relationType: relation.type,
          target: relation.task
        });
        continue;
      }

      graph.get(fromId).add(toId);
    }
  }

  return { danglingReferences, graph };
}

function findCycles(graph) {
  const visited = new Set();
  const visiting = new Set();
  const stack = [];
  const cycles = [];
  const seenCycleKeys = new Set();

  function recordCycle(startNode) {
    const startIndex = stack.indexOf(startNode);
    if (startIndex === -1) {
      return;
    }

    const cycle = stack.slice(startIndex).concat(startNode);
    const uniqueNodes = cycle.slice(0, -1);
    const canonicalStart = [...uniqueNodes].sort()[0];
    const canonicalIndex = uniqueNodes.indexOf(canonicalStart);
    const rotated = uniqueNodes.slice(canonicalIndex).concat(uniqueNodes.slice(0, canonicalIndex));
    const cycleKey = rotated.join('>');

    if (!seenCycleKeys.has(cycleKey)) {
      seenCycleKeys.add(cycleKey);
      cycles.push(rotated.concat(rotated[0]));
    }
  }

  function visit(node) {
    visited.add(node);
    visiting.add(node);
    stack.push(node);

    for (const nextNode of graph.get(node) || []) {
      if (!visited.has(nextNode)) {
        visit(nextNode);
      } else if (visiting.has(nextNode)) {
        recordCycle(nextNode);
      }
    }

    stack.pop();
    visiting.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return cycles;
}

function printTextReport(result) {
  if (result.danglingReferences.length > 0) {
    console.error(`Dangling dependency references: ${result.danglingReferences.length}`);
    for (const reference of result.danglingReferences) {
      console.error(`- ${reference.from}: ${reference.relationType} ${reference.target}`);
    }
  }

  if (result.cycles.length > 0) {
    console.error(`Dependency cycles detected: ${result.cycles.length}`);
    for (const cycle of result.cycles) {
      console.error(`- ${cycle.join(' -> ')}`);
    }
  }

  if (result.danglingReferences.length === 0 && result.cycles.length === 0) {
    console.log('No dependency cycles or dangling dependency references found');
  }
}

function main() {
  const { json, projectRoot } = parseArgs(process.argv.slice(2));

  let tasksPath;
  try {
    tasksPath = ensureKanbnFiles(projectRoot);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const tasks = loadTasks(tasksPath);
  const { graph, danglingReferences } = buildDependencyGraph(tasks);
  const cycles = findCycles(graph);
  const result = { cycles, danglingReferences };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTextReport(result);
  }

  if (cycles.length > 0 || danglingReferences.length > 0) {
    process.exit(1);
  }
}

main();
