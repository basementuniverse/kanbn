const workspace = require('../main');
const utility = require('../utility');

/**
 * Show the workspace's contributors
 * @param {object[]} contributors
 * @param {?string} currentUser
 * @param {boolean} json
 */
function showContributors(contributors, currentUser, json) {
  if (json) {
    console.log(JSON.stringify({ contributors, currentUser }, null, 2));
    return;
  }
  if (!contributors.length) {
    console.log('No contributors are declared in this workspace');
    console.log(utility.replaceTags(
      `\n{d}Add a {d}{b}contributors{b}{d} list to your config file or the main board's front matter -{d} ` +
      `{b}kanbn contributors --help{b}`
    ));
    showCurrentUser(currentUser);
    return;
  }
  console.log(`${contributors.length} ${contributors.length === 1 ? 'contributor' : 'contributors'}:`);
  for (const contributor of contributors) {
    console.log(utility.replaceTags(
      `\n{b}${contributor.name}{b}` +
      (contributor.name === currentUser ? ' (you)' : '')
    ));
    if (contributor.displayName !== contributor.name) {
      console.log(`  ${contributor.displayName}`);
    }
    if (contributor.email) {
      console.log(`  ${contributor.email}`);
    }
    if (contributor.aliases.length) {
      console.log(`  also known as ${contributor.aliases.map(alias => `"${alias}"`).join(', ')}`);
    }
    if (contributor.colour) {
      console.log(`  ${contributor.colour}`);
    }
  }
  showCurrentUser(currentUser, contributors);
}

/**
 * Say who kanbn thinks the current user is, since that's what a bare --assigned and "@me" resolve to
 * @param {?string} currentUser
 * @param {object[]} [contributors=[]]
 */
function showCurrentUser(currentUser, contributors = []) {
  if (currentUser === null) {
    console.log(utility.replaceTags(
      `\n{d}Kanbn can't work out who you are. Set {d}{b}KANBN_USER{b}{d}, or set a git username with{d} ` +
      `{b}git config user.name "your name"{b}`
    ));
    return;
  }
  if (contributors.length && !contributors.some(contributor => contributor.name === currentUser)) {
    console.log(utility.replaceTags(
      `\n{d}You are{d} {b}${currentUser}{b}{d}, which isn't in the contributors list{d}`
    ));
    return;
  }
  console.log(utility.replaceTags(`\n{d}You are{d} {b}${currentUser}{b}`));
}

/**
 * Show how contributors are used across the workspace's tasks, and which names are in use that the
 * contributors list doesn't know about
 * @param {object} usage
 * @param {?string} currentUser
 * @param {boolean} json
 */
function showUsage(usage, currentUser, json) {
  if (json) {
    console.log(JSON.stringify({ ...usage, currentUser }, null, 2));
    return;
  }
  if (usage.contributors.length) {
    console.log(`${usage.contributors.length} ${usage.contributors.length === 1 ? 'contributor' : 'contributors'}:`);
    for (const contributor of usage.contributors) {
      console.log(utility.replaceTags(
        `\n{b}${contributor.name}{b}` +
        (contributor.name === currentUser ? ' (you)' : '')
      ));
      console.log(
        `  ${contributor.tasks} ${contributor.tasks === 1 ? 'task' : 'tasks'}, ` +
        `assigned ${contributor.assigned}, ` +
        `${contributor.comments} ${contributor.comments === 1 ? 'comment' : 'comments'}`
      );

      // A contributor matched through an alias or a different case is worth showing: it's a spelling
      // that works today only because the alias is there to catch it
      for (const spelling of contributor.spellings.filter(s => s.value !== contributor.name)) {
        console.log(`  written as "${spelling.value}" in ${spelling.tasks.length} ${spelling.tasks.length === 1 ? 'task' : 'tasks'}`);
      }
    }
  } else {
    console.log('No contributors are declared in this workspace');
  }

  if (!usage.unknown.length) {
    console.log(
      usage.contributors.length
        ? '\nEvery name used in a task matches a contributor'
        : '\nNo names are used in any task'
    );
    return;
  }
  console.log(
    `\n${usage.unknown.length} ${usage.unknown.length === 1 ? 'name is' : 'names are'} used in tasks ` +
    `but ${usage.unknown.length === 1 ? "isn't" : "aren't"} a known contributor:`
  );
  for (const unknown of usage.unknown) {
    console.log(utility.replaceTags(
      `\n{b}${unknown.value}{b}` +
      (unknown.value === currentUser ? ' (you)' : '')
    ));
    console.log(
      `  ${unknown.tasks.length} ${unknown.tasks.length === 1 ? 'task' : 'tasks'}, ` +
      `assigned ${unknown.assigned}, ` +
      `${unknown.comments} ${unknown.comments === 1 ? 'comment' : 'comments'}`
    );
    console.log(`  ${unknown.tasks.join(', ')}`);
  }
  console.log(utility.replaceTags(
    `\n{d}Add these to {d}{b}contributors{b}{d}, or as an {d}{b}alias{b}{d} of a contributor already ` +
    `in the list. Nothing is rewritten either way - {d}{b}assigned{b}{d} and comment {d}{b}author{b}` +
    `{d} are free text{d}`
  ));
}

module.exports = async args => {

  // Contributors are workspace-scoped, so this command isn't board-scoped either
  if (!await workspace.workspaceInitialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }

  let currentUser;
  try {
    currentUser = await workspace.currentUser();
  } catch (error) {
    utility.error(error);
    return;
  }

  // Show how the contributors are actually used across the workspace's tasks
  if (args.usage) {
    try {
      showUsage(await workspace.getContributorUsage(), currentUser, args.json);
    } catch (error) {
      utility.error(error);
    }
    return;
  }

  // List contributors
  try {
    showContributors(await workspace.getContributors(), currentUser, args.json);
  } catch (error) {
    utility.error(error);
  }
};
