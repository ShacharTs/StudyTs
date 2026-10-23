'use strict';

const net = require('net');

const FIRST_PORT = 7301;
const LAST_PORT = 7310;

function canListen(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

// Prefer the known API port so bookmarks and the MCP config stay stable; fall back to any free port.
async function findFreePort(preferred = FIRST_PORT, last = LAST_PORT) {
  for (let port = preferred; port <= last; port += 1) {
    if (await canListen(port)) return port;
  }
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

module.exports = { findFreePort };
