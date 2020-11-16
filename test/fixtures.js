const mock = require('mock-fs');
const faker = require('faker');
const paramCase = require('param-case').paramCase;
const parseIndex = require('../lib/parse-index.js');
const parseTask = require('../lib/parse-task.js');

function generateTask() {
  // generate task using faker and return id
}

module.exports = (tasks = 1) => {
  // TODO generate index and task fixtures
  mock({
    '.kanbn': {
      'index.md': 'test',
      'tasks': {}
    }
  });

  // return index object
};
