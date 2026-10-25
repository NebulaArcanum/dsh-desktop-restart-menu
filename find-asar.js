#!/usr/bin/env node
/* Locates the installed DeepSeek Harness app.asar: an explicit .asar argument wins,
 * otherwise common install locations are probed. */
const fs = require('node:fs');
const path = require('node:path');

const REL = path.join('resources', 'app.asar');

function candidates() {
	const list = [];
	const add = (base) => {
		if (base) list.push(path.join(base, REL));
	};
	if (process.platform === 'darwin') {
		list.push('/Applications/DeepSeek Harness.app/Contents/Resources/app.asar');
		return list;
	}
	add(process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness'));
	add(process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'DeepSeek Harness'));
	add(process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'DeepSeek Harness'));
	add(process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'DeepSeek Harness'));
	if (process.platform === 'win32') {
		for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
			for (const dir of ['Programs', 'Program Files', 'Program Files (x86)', 'Apps', 'Software']) {
				list.push(path.join(letter + ':', dir, 'DeepSeek Harness', REL));
			}
		}
	}
	return [...new Set(list)];
}

function hint() {
	console.error('Pass the full path instead, for example:');
	console.error('  node apply.js "D:\\Programs\\DeepSeek Harness\\resources\\app.asar"');
	console.error('Find it via: Start menu -> right-click DeepSeek Harness -> Open file location -> resources.');
}

function resolveAsar(argv = process.argv) {
	const given = argv.find((a) => a.endsWith('.asar'));
	if (given !== undefined) {
		const abs = path.resolve(given);
		if (fs.existsSync(abs)) return abs;
		console.error('app.asar not found: ' + abs);
		hint();
		process.exit(1);
	}
	const tried = candidates();
	for (const candidate of tried) {
		if (fs.existsSync(candidate)) return candidate;
	}
	console.error('Could not find DeepSeek Harness app.asar automatically.');
	hint();
	console.error('Tried:');
	for (const item of tried) console.error('  ' + item);
	process.exit(1);
}

module.exports = { resolveAsar };
