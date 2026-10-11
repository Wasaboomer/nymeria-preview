// Focused Torre Silente V1 browser check: start an ephemeral local server,
// validate four mobile widths, and save screenshots. Does not commit or deploy.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = 8018;
const url = 'http://127.0.0.1:' + port;
let server;
let test;
function ready() {
  return new Promise((resolve, reject) => {
    http.get(url, res => {res.resume();resolve(res.statusCode < 500);})
      .on('error', reject).setTimeout(1000, function () {this.destroy();});
  });
}
function cleanup() {
  if (test && test.exitCode === null) test.kill('SIGTERM');
  if (server && server.exitCode === null) server.kill('SIGTERM');
}
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
(async () => {
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    {cwd: root, stdio: 'ignore'});
  let running = false;
  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) break;
    await new Promise(r => setTimeout(r, 200));
    try { if (await ready()) {running = true; break;} } catch {}
  }
  if (!running) throw new Error('Temporary test server did not start on ' + url);
  test = spawn(process.execPath, ['tests/torre-silente-v1-browser.cjs'],
    {cwd: root, stdio: 'inherit', env: {...process.env, NYMERIA_TEST_URL: url}});
  const code = await new Promise((resolve, reject) => {
    test.once('error', reject);
    test.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  cleanup();
  process.exitCode = code;
})().catch(e => {console.error(e);cleanup();process.exitCode=1;});
