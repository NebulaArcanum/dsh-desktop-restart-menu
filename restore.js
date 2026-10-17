#!/usr/bin/env node
/* Restores resources/app.asar's lib/main.js from the copy saved by apply.js.
 * Usage: node restore.js [path/to/app.asar]
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ASAR = process.argv.find((a) => a.endsWith('.asar')) ?? 'D:/Programs/DeepSeek Harness/resources/app.asar';
const BACKUP = path.join(__dirname, 'backup', 'main.orig.mjs');

function fail(message) {
	console.error('restore: ' + message);
	process.exit(1);
}

if (!fs.existsSync(BACKUP)) fail('no backup at ' + BACKUP);
const original = fs.readFileSync(BACKUP);

const fd = fs.openSync(ASAR, 'r+');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const dataBase = 16 + head.readUInt32LE(12);
const hb = Buffer.alloc(head.readUInt32LE(12));
fs.readSync(fd, hb, 0, hb.length, 16);
const entry = JSON.parse(hb.toString('utf8')).files.lib.files['main.js'];

if (entry.size !== original.length) {
	fs.closeSync(fd);
	fail(`backup is ${original.length} bytes but ${ASAR} expects ${entry.size} — different app version, refusing to restore`);
}

fs.writeSync(fd, original, 0, original.length, dataBase + Number(entry.offset));
fs.closeSync(fd);

const check = fs.openSync(ASAR, 'r+');
const written = Buffer.alloc(original.length);
fs.readSync(check, written, 0, original.length, dataBase + Number(entry.offset));
fs.closeSync(check);
if (crypto.createHash('sha256').update(written).digest('hex') !== crypto.createHash('sha256').update(original).digest('hex')) fail('read-back mismatch');

console.log('restore: restored lib/main.js in ' + ASAR);
