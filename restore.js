#!/usr/bin/env node
/* Restores resources/app.asar's lib/main.js from the copy saved by apply.js.
 * Usage: node restore.js [path/to/app.asar]
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveAsar } = require('./find-asar');

const ASAR = resolveAsar();
const BACKUP = path.join(__dirname, 'backup', 'main.orig.mjs');

function fail(message) {
	console.error('restore: ' + message);
	process.exit(1);
}

function sha256(buffer) {
	return crypto.createHash('sha256').update(buffer).digest('hex');
}

if (!fs.existsSync(BACKUP)) fail('no backup at ' + BACKUP + ' — run apply.js first');

const original = fs.readFileSync(BACKUP);

const fd = fs.openSync(ASAR, 'r+');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
// Chromium pickle header: [payload size][string length][string][padding]; data starts at 12 + payload.
const dataBase = 12 + head.readUInt32LE(8);
const hb = Buffer.alloc(head.readUInt32LE(12));
fs.readSync(fd, hb, 0, hb.length, 16);
const entry = JSON.parse(hb.toString('utf8')).files.lib.files['main.js'];
const offset = dataBase + Number(entry.offset);

if (entry.size !== original.length) {
	fs.closeSync(fd);
	fail(`backup is ${original.length} bytes but ${ASAR} expects ${entry.size} — different app version, refusing to restore`);
}
if (entry.integrity?.hash !== undefined && sha256(original) !== entry.integrity.hash) {
	fs.closeSync(fd);
	fail('backup does not match this app.asar — different app version, refusing to restore');
}

const current = Buffer.alloc(entry.size);
fs.readSync(fd, current, 0, entry.size, offset);
if (sha256(current) === sha256(original)) {
	fs.closeSync(fd);
	console.log('restore: already original, nothing to do (' + ASAR + ')');
	process.exit(0);
}

fs.writeSync(fd, original, 0, original.length, offset);
fs.closeSync(fd);

const check = fs.openSync(ASAR, 'r+');
const written = Buffer.alloc(original.length);
fs.readSync(check, written, 0, original.length, offset);
fs.closeSync(check);
if (sha256(written) !== sha256(original)) fail('read-back mismatch: asar bytes differ from the backup');

console.log('restore: restored lib/main.js in ' + ASAR);
