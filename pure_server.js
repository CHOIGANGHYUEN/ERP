import http from 'http';
const server = http.createServer((req, res) => {
  res.end('ok');
});
server.listen(3000, () => {
  console.log('Pure server listening on 3000');
  setTimeout(() => {
    console.log('Active handles:', process._getActiveHandles().map(h => h.constructor.name));
  }, 500);
});
process.on('exit', (code) => {
  console.log('Pure server exiting with code', code);
});
