// @ts-check

'use strict';

const sqlite3 = require('sqlite3').verbose();
const aaSqlite3 = require('../aa-sqlite3');

(async () => {
	// Simple example:
	const db = aaSqlite3(new sqlite3.Database('./test.db'));

	// db.on('trace', (sql) => console.log('trace:', sql));
	db.on('profile', (sql, msec) => console.log('profile:', sql, msec, 'msec'));

	await db.exec('DROP TABLE IF EXISTS users');
	await db.exec('CREATE TABLE IF NOT EXISTS users(name TEXT UNIQUE, age INTEGER)');

	await db.run('INSERT INTO users(name, age) VALUES($name, $age)',
		{ $name: 'Kaz', $age: 57 });
	await db.run('INSERT INTO users(name, age) VALUES(?, ?)',
		'Leo', 13);

	const rows = await db.all('SELECT * FROM users');
	console.log('db.all: =>', rows.length, 'rows:', rows);

	const row = await db.get('SELECT * FROM users WHERE name = $name',
		{ $name: 'Leo' });
	console.log('db.get: ->', row);

	const nRows = await db.each('SELECT * FROM users',
		(err, row) => console.log('db.each: ->', err ? err : row));
	console.log('db.each: =>', nRows, 'rows');

	const st = await db.prepare('SELECT * FROM users WHERE name = ?');
	console.log('st.get: ->', await st.get('Leo'));
	console.log('st.get: ->', await st.get('Kaz'));
	await st.finalize();

	console.log('db.get(all): =>', await Promise.all([
		db.get('SELECT * FROM users WHERE name = $name', { $name: 'Leo' }),
		db.get('SELECT * FROM users WHERE name = ?', 'Kaz'),
	]));

	await db.close();
})().catch(console.error);
