const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require(path.join(__dirname, '.obf_tools', 'node_modules', 'javascript-obfuscator'));

const mode = process.argv[2] || 'main';
const inPath = process.argv[3];
const outPath = process.argv[4];
if (!inPath || !outPath) process.exit(1);

const src = fs.readFileSync(inPath, 'utf8');
const isWorker = mode === 'worker';

const res = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: isWorker ? 0.45 : 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: isWorker ? 0.1 : 0.15,
    debugProtection: !isWorker,
    debugProtectionInterval: isWorker ? 0 : 2000,
    disableConsoleOutput: !isWorker,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    renameProperties: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 8,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.65,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 1,
    target: isWorker ? 'browser-no-eval' : 'browser',
    transformObjectKeys: true,
    unicodeEscapeSequence: false
});

fs.writeFileSync(outPath, res.getObfuscatedCode(), 'utf8');
