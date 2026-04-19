const originalKill = process.kill;
process.kill = function(...args) {
    console.log('process.kill called', args, new Error().stack);
    return originalKill.apply(this, args);
};

process.on('exit', (code) => {
    console.log('Process exiting with code:', code, new Error().stack);
});

setTimeout(() => {
    console.log('Active handles:', process._getActiveHandles().map(h => h.constructor.name));
}, 500);

import './project/src/backend/server.js';
