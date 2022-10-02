// @ts-check

'use strict';

const sqlite3 = require('sqlite3').verbose();
const aaSqlite3 = require('../aa-sqlite3');

init();

(async () => {
	// Example with options: trace, profile, etc...
	const db = aaSqlite3(new sqlite3.Database('./test.db'),
		{ // options
			trace: (sql, method, ctorName) =>
				console.log(`  trace: ${ctorName}.${method}:`, sql),
			profile: (sql, msec, method, ctorName) =>
				console.log(`profile: ${ctorName}.${method}:`, sql, msec, 'msec'),
			// usePromise: true, // default: false
			asyncMethods: [ // awaitable methods
				'run', 'exec', 'get', 'all', 'each',
				'close', 'map', 'loadExtension',
				'bind', 'reset', 'finalize',
			],
			traceMethods: [ // traceable methods for trace and profile
				'run', 'exec', 'get', 'all', 'each', 'map',
			],
		});
	// db.on('trace', (sql) => console.log('trace:', sql));
	// db.on('profile', (sql, msec) => console.log('profile:', sql, msec, 'msec'));

	await db.exec('DROP TABLE IF EXISTS users');
	await db.exec('CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY, age INTEGER) WITHOUT rowid');
	await db.exec('CREATE INDEX IF NOT EXISTS users_ix01 ON users(name, age)');

	await db.exec('BEGIN IMMEDIATE');
	await db.run('INSERT INTO users(name, age) VALUES(?, ?)', 'Kaz', 57);
	await db.run('INSERT INTO users(name, age) VALUES(?, ?)', 'Leo', 13);
	await db.exec('COMMIT');

	const rows = await db.all('SELECT * FROM users');
	console.log('         Database.all: =>', rows.length, 'rows:', rows);

	const row = await db.get('SELECT * FROM users WHERE name = $name', { $name: 'Leo' });
	console.log('         Database.get: ->', row);

	const nRow = await db.each('SELECT * FROM users', (err, row) => {
		if (err) console.log('each:', err);
		else console.log('         Database.each: ->', row);
		db.interrupt(); // if you want to abort long transaction
	});
	console.log('         Database.each: =>', nRow, 'rows');

	const map = await db.map('SELECT * FROM users');
	console.log('         Database.map: #>', map);

	{
		await db.exec('BEGIN IMMEDIATE');
		await db.run('DELETE FROM users WHERE name = ?', 'Kaz');
		await db.run('DELETE FROM users WHERE name = ?', 'Leo');

		const st = await db.prepare('INSERT INTO users(name, age) VALUES($name, $age)');
		await st.run({ $name: 'Taro', $age: 30 });
		await st.run({ $name: 'Hanako', $age: 20 });
		await st.finalize();
		await db.exec('COMMIT');
	}

	{
		const st = await db.prepare('SELECT * FROM users');
		console.log('         Statement.all: =>', await st.all());
		await st.finalize();
	}

	{
		const st = await db.prepare('SELECT * FROM users WHERE name = $name');
		console.log('         Statement.get: ->', await st.get({ $name: 'Taro' }));
		console.log('         Statement.get: ->', await st.get({ $name: 'Hanako' }));
		await st.finalize();
	}

	{
		const st = await db.prepare('SELECT * FROM users WHERE name = $name');
		await st.bind({ $name: 'Taro' });
		console.log('         Statement.all: =>', await st.all());
		await st.bind({ $name: 'Hanako' });
		console.log('         Statement.all: =>', await st.all());
		await st.finalize();
	}

	{
		const st = await db.prepare('SELECT * FROM users WHERE name = @name');
		console.log('         Statement.get: ->', await st.get({ '@name': 'Taro' }));
		await st.finalize();
	}

	{
		const st = await db.prepare('SELECT * FROM users WHERE name = :name');
		console.log('         Statement.get: ->', await st.get({ ':name': 'Hanako' }));
		await st.finalize();
	}

	{
		const st = await db.prepare('SELECT * FROM users WHERE name = ?');
		console.log('         Statement.get: ->', await st.get('Leo'), '(not found!)');
		await st.finalize();
	}

	const all = await Promise.all([
		db.get('SELECT * FROM users WHERE name = ?', 'Taro'),
		db.get('SELECT * FROM users WHERE name = ?', 'Hanako'),
	]);
	console.log('         Database.get: =>', all);

	console.log('         Database.close');
	await db.close();
	console.log('         Example.end');

	// aaSqlite3({}, { getActualOptions: (opts) => console.log('default:', opts) });

	// // @ts-ignore
	// await { then: res => setTimeout(res, 0) };
	// // await new Promise(res => setTimeout(res, 0));

})().catch(console.error);

function init() {
	for (let i = 0; i < 100; ++i) process.hrtime();

	console.log = (log => {
		const a = process.hrtime();
		let c = process.hrtime();
		return (...args) => {
			const b = process.hrtime();
			log.call(console, ms(df(b, a)), ms(df(b, c), '+'), ...args);
			c = b;
		};
		function df(b, a) {
			let x = b[0] - a[0];
			let y = b[1] - a[1];
			return y < 0 ? [x - 1, y + 1e9] : [x, y];
		};
		function ms (c, s = ' ') {
			return ('    ' + s + (c[0] * 1e3 + c[1] / 1e6).toFixed(4)).substr(-9) + ' ms';
		}
	})(console.log);
}
