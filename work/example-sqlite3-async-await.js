// @ts-check

const sqlite3 = require('sqlite3').verbose();
const aaSqlite3 = require('../aa-sqlite3');

const log = init();

(async () => {
	for (let i = 0; i < 3; ++i) {
		log.init();
		await main();
	}
})().catch(err => {
	console.error('='.repeat(80));
	console.error(err);
	console.error('='.repeat(80));
});


async function main() {
	const options = {
		trace: (sql, method, ctorName) => log(`  trace: ${ctorName}.${method}:`, sql),
		profile: (sql, msec, method, ctorName) => log(`profile: ${ctorName}.${method}:`, sql, msec),
		usePromise: true,
	};
	const db = aaSqlite3(new sqlite3.Database('./test.db'), options);

	// db.on('trace', sql => log('trace:', sql));
	// db.on('profile', (sql, msec) => log('profile:', sql, msec));

	await db.exec('DROP TABLE IF EXISTS users');
	await db.exec('CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY, age INTEGER) WITHOUT rowid');
	await db.exec('CREATE INDEX IF NOT EXISTS users_ix01 ON users(name, age)');

	await db.run('INSERT INTO users(name, age) VALUES(?, ?)', 'Kaz', 57);
	await db.run('INSERT INTO users(name, age) VALUES(?, ?)', 'Leo', 13);
	// for (let i = 1000; i < 2000; ++i)
	// 	await db.run('INSERT INTO users(name,age) VALUES(?, ?)', 'Name' + i, i - 1000);

	log('each: => nRows:', await db.each('SELECT * FROM users', (err, row) => {
		if (err) log(err);
		else log('each: ->', row);
		db.interrupt();
	}));

	log('get:', await db.get('SELECT * FROM users WHERE name = $name', { $name: 'Leo' }));

	const rows = await db.all('SELECT * FROM users');
	for (const row of rows) log('all: ->', row);
	log('all: => nRows:', rows.length);

	const st1 = await db.prepare('SELECT * FROM users WHERE name = $name');
	log('get:', await st1.get({ $name: 'Leo' }));
	await st1.finalize();

	log('map:', await db.map('SELECT * FROM users'));

	const st2 = await db.prepare('SELECT * FROM users');
	log('all:', await st2.all());
	await st2.finalize();

	const st3 = await db.prepare('SELECT * FROM users WHERE name = $name');
	await st3.bind({ $name: 'Leo' });
	log('all:', await st3.all());
	await st3.finalize();

	// @ts-ignore: trace mode off
	options.trace = null;
	// @ts-ignore: profile mode off
	options.profile = null;
	log('db.close');
	await db.close();
	log('end');
}

function init() {
	let startHrTime, lastHrTime;
	log.init = function () {
		startHrTime = process.hrtime();
		lastHrTime = startHrTime;
	};
	function log(...args) {
		let totalHrTime = process.hrtime(startHrTime);
		let deltaHrTime = process.hrtime(lastHrTime);
		lastHrTime = process.hrtime();
		console.log(
			('      ' + (totalHrTime[0] * 1e3 + totalHrTime[1] / 1e6).toFixed(4)).substr(-10),
			('     +' + (deltaHrTime[0] * 1e3 + deltaHrTime[1] / 1e6).toFixed(4)).substr(-10),
			...args);
	}
	log.init();
	return log;
}
