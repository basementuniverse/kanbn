// Randomly generate tasks for manual testing
// Instructions:
//  kanbn init (initialise kanbn)
//  cd .kanbn/tasks && node generate.js 10 (go to the tasks folder and generate 10 tasks)
//  cd ../ && kanbn add -u (add all untracked tasks to the index)

const fs = require("fs");
const faker = require("faker");
const parseTask = require("../src/parse-task");
const utility = require("../src/utility");

let N;
if (process.argv.length > 2) {
  N = Number(process.argv[2]);
}
if (!N || isNaN(N)) {
  N = 1;
}

const capitalise = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const tags = [
  ...new Set([
    ...new Array(6).fill(null).map((i) => capitalise(faker.lorem.word(6))),
    "Nothing",
    "Tiny",
    "Small",
    "Medium",
    "Large",
    "Huge",
  ]),
];
const assignees = [...new Set([...new Array(4).fill(null).map((i) => faker.name.firstName())])];
const names = [
  ...new Set([
    ...new Array(N * 2)
      .fill(null)
      .map((i) => capitalise(faker.lorem.sentence(faker.random.number(4)).slice(0, -1)))
      .filter((i) => i),
  ]),
];
const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;

function generateTask(i) {
  const name = names[i];
  const id = utility.getTaskId(name);
  const created = faker.date.recent(30, NOW);
  const metadata = {
    created,
    updated: created,
  };

  // tags
  const COUNT_TAGS = 1 + faker.random.number(4);
  if (Math.random() > 0.3) {
    metadata.tags = [
      ...new Set(new Array(COUNT_TAGS).fill(null).map((i) => tags[Math.floor(Math.random() * tags.length)])),
    ];
  }

  // assigned
  if (Math.random() > 0.3) {
    metadata.assigned = assignees[Math.floor(Math.random() * assignees.length)];
  }

  // started
  if (Math.random() > 0.6) {
    const started = new Date(metadata.created);
    started.setTime(
      metadata.created.getTime() +
        (faker.random.number({
          min: 0,
          max: 10,
          precision: 1,
        }) *
          DAY +
          faker.random.number(DAY))
    );
    if (started < NOW) {
      metadata.started = started;
    }
  }

  // completed
  if (Math.random() >= 0.5) {
    const start = "started" in metadata ? metadata.started : metadata.created;
    const completed = new Date(start);
    completed.setTime(
      start.getTime() +
        (faker.random.number({
          min: 0,
          max: 10,
          precision: 1,
        }) *
          DAY +
          faker.random.number(DAY))
    );
    if (completed < NOW) {
      metadata.completed = completed;
    }
  }

  // due
  if (Math.random() >= 0.4) {
    metadata.due = new Date(metadata.created);
    metadata.due.setTime(
      metadata.created.getTime() +
        (faker.random.number({
          min: 0,
          max: 10,
          precision: 1,
        }) *
          DAY +
          faker.random.number(DAY))
    );
  }

  // progress
  if ("started" in metadata && Math.random() > 0.3) {
    metadata.progress = Math.random();
  }

  return {
    id,
    name,
    description: faker.lorem.paragraph(),
    metadata,
    subTasks: generateSubTasks(),
    relations: generateRelations(id),
    comments: generateComments(),
  };
}

function generateSubTasks() {
  if (Math.random() >= 0.5) {
    return [];
  }
  const COUNT_SUB_TASKS = faker.random.number(10);

  return new Array(COUNT_SUB_TASKS).fill(null).map((i) => ({
    text: faker.lorem.sentence(),
    completed: faker.random.boolean(),
  }));
}

function generateRelations(id) {
  if (Math.random() >= 0.75) {
    return [];
  }
  const COUNT_RELATIONS = faker.random.number(4);
  const relationTypes = ["", "blocks ", "duplicates ", "requires ", "obsoletes "];
  return new Array(COUNT_RELATIONS)
    .fill(null)
    .map((i) => ({
      task: utility.getTaskId(names[Math.floor(Math.random() * names.length)]),
      type: relationTypes[Math.floor(Math.random() * relationTypes.length)],
    }))
    .filter((i) => i.task !== id);
}

function generateComments() {
  if (Math.random() >= 0.5) {
    return [];
  }
  const COUNT_COMMENTS = faker.random.number(5);

  return new Array(COUNT_COMMENTS).fill(null).map((i) => ({
    date: faker.date.recent(30, NOW),
    author: assignees[Math.floor(Math.random() * assignees.length)],
    text: faker.lorem.sentence(),
  }));
}

const tasks = [];
for (let i = 0; i < N; i++) {
  tasks.push(generateTask(i));
}

for (let task of tasks) {
  fs.writeFileSync(task.id + ".md", parseTask.json2md(task), { encoding: "utf-8" });
}
