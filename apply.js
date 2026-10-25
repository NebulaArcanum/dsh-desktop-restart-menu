#!/usr/bin/env node
/*
 * Adds a Restart entry above Exit in the desktop application menu (top-left "应用")
 * and a "Restart DeepSeek Harness" entry above Exit in the tray menu.
 *
 * The Electron shell (resources/app.asar -> lib/main.js) owns both menus and has no
 * plugin hook, so this patches that bundle in place. The asar header is left untouched:
 * the patched lib/main.js is trimmed/padded back to its exact original byte length.
 *
 * Usage: node apply.js [path/to/app.asar] [--dry-run]
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolveAsar } = require('./find-asar');

const ASAR = resolveAsar();
const DRY = process.argv.includes('--dry-run');
const HERE = __dirname;
const BACKUP = path.join(HERE, 'backup', 'main.orig.mjs');
const MARK = 'dsh-restart-menu-patch';

const APP_MENU_FROM = '\t\t{ type: "separator" },\n\t\t...hideCommands,\n\t\t{\n\t\t\trole: "quit",';
const APP_MENU_TO = `\t\t{ type: "separator" },
\t\t...hideCommands,
\t\t// ${MARK}: restart above Exit
\t\t{
\t\t\tlabel: currentDesktopLocale().messages.restartApplication,
\t\t\tclick: () => {
\t\t\t\tif (quitting) return;
\t\t\t\tapp.relaunch();
\t\t\t\tquitWithoutConfirmation();
\t\t\t}
\t\t},
\t\t{
\t\t\trole: "quit",`;

const TRAY_FROM = '\t\t\t{ type: "separator" },\n\t\t\t{\n\t\t\t\tlabel: messages.quitApplication,';
const TRAY_TO = `\t\t\t{ type: "separator" },
\t\t\t// ${MARK}: tray restart above Exit
\t\t\t{
\t\t\t\tlabel: \`\${messages.restartApplication} \${messages.aboutProduct}\`,
\t\t\t\tclick: () => {
\t\t\t\t\tthis.options.restart();
\t\t\t\t}
\t\t\t},
\t\t\t{
\t\t\t\tlabel: messages.quitApplication,`;

const TRAY_OPTIONS_FROM = '\t\t\tquit: () => {\n\t\t\t\tapp.quit();\n\t\t\t}\n\t\t});';
const TRAY_OPTIONS_TO = `\t\t\tquit: () => {
\t\t\t\tapp.quit();
\t\t\t},
\t\t\trestart: () => {
\t\t\t\tif (quitting) return;
\t\t\t\tapp.relaunch();
\t\t\t\tquitWithoutConfirmation();
\t\t\t}
\t\t});`;

// Large ASCII doc comments used only to keep the asar entry size unchanged.
const REMOVABLE = [
	'\t/**\n' +
	'\t* @param node - Absolute Electron executable in Node mode.\n' +
	'\t* @param runtimeDir - Immutable packages carried by the current application.\n' +
	'\t* @param projectDir - Desktop plugin profile and child working directory.\n' +
	'\t* @param inspectPort - Optional loopback inspector port for workspace development.\n' +
	'\t* @param environment - Environment inherited by the Host and its plugin subprocesses.\n' +
	'\t* @param onFailure - Receives the first unexpected child failure, including after readiness.\n' +
	'\t* @param primaryRuntime - Optional bundled dependency payload; when supplied, missing sibling\n' +
	'\t*   `office-skills` resources fail Host startup.\n' +
	'\t* @param packageManager - Bundled pnpm entry and Node launcher directory, scoped to package operations.\n' +
	'\t* @param onPlatformSession - Private credential updates for embedded Platform views.\n' +
	'\t*/\n',
];

function fail(message) {
	console.error('apply: ' + message);
	process.exit(1);
}

function readAsar(file) {
	const fd = fs.openSync(file, 'r+');
	const head = Buffer.alloc(16);
	fs.readSync(fd, head, 0, 16, 0);
	// The JSON header is a Chromium pickle: [payload size][string length][string][padding].
	// payload size = 4-byte length field + string + padding, so file data starts at 12 + payload.
	const dataBase = 12 + head.readUInt32LE(8);
	const jsonLen = head.readUInt32LE(12);
	const hb = Buffer.alloc(jsonLen);
	fs.readSync(fd, hb, 0, jsonLen, 16);
	const header = JSON.parse(hb.toString('utf8'));
	const entry = header.files.lib.files['main.js'];
	const original = Buffer.alloc(entry.size);
	fs.readSync(fd, original, 0, entry.size, dataBase + Number(entry.offset));
	return { fd, entry, original, dataBase };
}

const { fd, entry, original, dataBase } = readAsar(ASAR);
const originalText = original.toString('utf8');

if (originalText.includes(MARK)) {
	console.log('apply: already patched, nothing to do (' + ASAR + ')');
	fs.closeSync(fd);
	process.exit(0);
}

// An unpatched bundle must match the hash the asar header stores for it. A mismatch
// means the header was parsed at the wrong offset (or the file is damaged) — never write.
if (entry.integrity?.hash !== undefined) {
	const actual = crypto.createHash('sha256').update(original).digest('hex');
	if (actual !== entry.integrity.hash) {
		fs.closeSync(fd);
		fail('lib/main.js does not match the asar integrity hash; refusing to write');
	}
}

let patched = originalText;
for (const [from, to, name] of [
	[APP_MENU_FROM, APP_MENU_TO, 'application menu'],
	[TRAY_FROM, TRAY_TO, 'tray menu'],
	[TRAY_OPTIONS_FROM, TRAY_OPTIONS_TO, 'tray options'],
]) {
	const count = patched.split(from).length - 1;
	if (count !== 1) fail(`${name}: expected exactly one anchor, found ${count} — this shell version is not supported`);
	patched = patched.replace(from, to);
}

let growth = Buffer.byteLength(patched) - original.length;
let removed = 0;
for (const doc of REMOVABLE) {
	if (removed >= growth) break;
	if (patched.split(doc).length - 1 !== 1) continue;
	patched = patched.replace(doc, '');
	removed += Buffer.byteLength(doc);
}

if (removed < growth) fail(`no removable comment large enough (need ${growth} bytes, found ${removed})`);

const pad = removed - growth;
if (pad > 0) patched += pad >= 4 ? '/*' + ' '.repeat(pad - 4) + '*/' : ' '.repeat(pad);

if (Buffer.byteLength(patched) !== original.length) fail('length adjustment failed: ' + Buffer.byteLength(patched) + ' vs ' + original.length);

const tmp = path.join(HERE, 'main.patched.mjs');
fs.writeFileSync(tmp, patched);
try {
	execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (error) {
	fail('patched lib/main.js does not parse:\n' + (error.stderr?.toString() ?? error.message));
}

if (DRY) {
	console.log('apply: dry run OK');
	console.log('  asar:      ' + ASAR);
	console.log('  entry:     lib/main.js @ ' + entry.offset + ' (' + original.length + ' bytes)');
	console.log('  patched:   ' + patched.length + ' chars, syntax OK');
	console.log('  trimmed:   ' + removed + ' bytes of doc comments, padded ' + pad + ' bytes');
	console.log('  preview:   ' + tmp);
	fs.closeSync(fd);
	process.exit(0);
}

fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
fs.writeFileSync(BACKUP, original);
const expected = crypto.createHash('sha256').update(patched).digest('hex');
fs.writeSync(fd, Buffer.from(patched, 'utf8'), 0, Buffer.byteLength(patched), dataBase + Number(entry.offset));
fs.closeSync(fd);

const check = readAsar(ASAR);
const actual = crypto.createHash('sha256').update(check.original).digest('hex');
fs.closeSync(check.fd);
if (actual !== expected) fail('read-back mismatch: asar bytes differ from the patched bundle');

console.log('apply: patched ' + ASAR);
console.log('  lib/main.js: ' + original.length + ' bytes -> ' + patched.length + ' chars, sha256 ' + actual.slice(0, 16) + '…');
console.log('  backup:      ' + BACKUP);
console.log('Restart DeepSeek Harness to load the new menus.');
