'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { resolveDesktopHome, unpackedPath } = require('./paths.cjs');

// `StudyTs --mcp` runs only the MCP server on stdio, with no window and no web server. Claude's config then needs
// just the app path: no script path that moves on update (or sits in a temporary AppImage mount) and no env block.
async function runMcpServer(app) {
  const home = resolveDesktopHome(app);
  process.env.STUDYTS_HOME = home;
  process.env.DATABASE_URL = `file:${path.join(home, 'studyts.db').replaceAll('\\', '/')}`;
  if (app.dock) app.dock.hide();
  // Claude closes stdin when it shuts the server down; without this the hidden app would keep running.
  process.stdin.once('end', () => app.exit(0));
  const bundle = path.join(unpackedPath(app.getAppPath()), 'dist-server', 'mcp', 'servers', 'studyTsServer.mjs');
  await import(pathToFileURL(bundle).href);
}

module.exports = { runMcpServer };
