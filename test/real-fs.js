const fs = require('fs');
const os = require('os');
const path = require('path');
const kanbn = require('../src/main');

/**
 * A drop-in replacement for mock-fs.
 *
 * mock-fs 4 doesn't intercept the synchronous fs bindings on modern node, which means anything
 * reading with readFileSync/existsSync (i.e. all of the assertions in test/context.js) sees the
 * real filesystem while the library under test writes into the mock. Rather than mock the
 * filesystem at all, each call here builds the same structure in a real temporary directory and
 * points the shared kanbn instance at it, so tests exercise the code paths the CLI actually uses.
 *
 * The call signature matches mock-fs: pass a nested object where strings (or Buffers) are files
 * and objects are directories, then call restore() to tear it down.
 */

// The original root, so restore() can put the shared instance back how it found it
const ORIGINAL_ROOT = kanbn.ROOT;

let currentRoot = null;

/**
 * Recursively write a mock-fs style structure into a directory
 * @param {string} target The directory to write into
 * @param {object} structure A nested object describing files and folders
 */
function writeStructure(target, structure) {
  fs.mkdirSync(target, { recursive: true });
  for (const [name, contents] of Object.entries(structure)) {
    const itemPath = path.join(target, name);
    if (typeof contents === 'string' || Buffer.isBuffer(contents)) {
      fs.mkdirSync(path.dirname(itemPath), { recursive: true });
      fs.writeFileSync(itemPath, contents);
    } else if (contents !== null && typeof contents === 'object') {
      writeStructure(itemPath, contents);
    } else {
      throw new Error(`Unsupported filesystem entry "${name}": expected a string, Buffer or object`);
    }
  }
}

/**
 * Point the shared kanbn instance at a different root folder
 * @param {string} root The folder to treat as the working directory
 */
function setRoot(root) {
  kanbn.ROOT = root;
  kanbn.CONFIG_YAML = path.join(root, 'kanbn.yml');
  kanbn.CONFIG_JSON = path.join(root, 'kanbn.json');
  kanbn.clearConfigCache();
}

/**
 * Create a temporary folder containing the given structure and point kanbn at it
 * @param {object} [structure={}] A nested object describing files and folders
 * @return {string} The path of the temporary folder
 */
function realFileSystem(structure = {}) {
  realFileSystem.restore();

  // realpath so that assertions comparing paths aren't tripped up by symlinked temp folders
  currentRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-test-')));
  writeStructure(currentRoot, structure);
  setRoot(currentRoot);
  return currentRoot;
}

/**
 * Remove the temporary folder and point kanbn back at the original root
 */
realFileSystem.restore = () => {
  if (currentRoot !== null) {
    fs.rmSync(currentRoot, { recursive: true, force: true });
    currentRoot = null;
  }
  setRoot(ORIGINAL_ROOT);
};

/**
 * Get the current temporary folder, or null if there isn't one
 * @return {string|null} The path of the current temporary folder
 */
realFileSystem.root = () => currentRoot;

realFileSystem.setRoot = setRoot;

module.exports = realFileSystem;
