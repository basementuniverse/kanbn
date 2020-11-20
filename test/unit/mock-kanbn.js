const mockRequire = require('mock-require');

const kanbn = {
  wibble() {
    return 'hello!'
  }
};

mockRequire('kanbn', kanbn);
