import express from 'express';
const app = express();
const server = app.listen(3000, () => {
    console.log('Express test server listening on 3000');
});
server.on('error', (e) => {
    console.log('Server emitted error:', e);
});
process.on('exit', (code) => console.log('Exiting with code', code));
