// @ts-check

'use strict';

module.exports = asyncSqlite;

const alreadyProcessed = new WeakMap();
const statementParams = new WeakMap();
const boundParams = new WeakMap();

/**
 * options: {
 *   trace: (sql, method, ctorName) => {}
 *   profile:  (sql, msec, method, ctorName) => {}
 *   usePromise: boolean
 * } 
 */
const defaultOptions = {
	trace: null,
	profile: null,
	usePromise: false,
	asyncMethods: [ // awaitable methods
		'run', 'exec', 'get', 'all', 'each',
		'close', 'map', 'loadExtension',
		'bind', 'reset', 'finalize',
	],
	traceMethods: [ // traceable methods for trace and profile
		'run', 'exec', 'get', 'all', 'each', 'map',
	],
	getActualOptions: null,
};

/**
 * asyncSqlite - make thenable SQLite object. Database or Statement.
 * @param {*} object
 * @param {*} options
 * @returns obj
 */
function asyncSqlite(object, options = {}) {
	if (object == null || typeof object !== 'object')
		throw new TypeError('Unexpected argument. Database or Statement object expected');

		if (alreadyProcessed.get(object)) return object;
	alreadyProcessed.set(object, true);

	const ctorName = object.constructor.name;
	const opts = Object.assign({}, defaultOptions, options);
	const thenable = opts.usePromise ? newPromise : makeThenable;

	const traceOrProfile = opts.trace || opts.profile ? true : false;
	const traceMethods = traceOrProfile ? opts.traceMethods
		.reduce((prev, curr) => (prev[curr] = true, prev), {}) : {};

	if (typeof opts.getActualOptions === 'function')
		opts.getActualOptions(opts);

	// make thenable methods for Database and Statement

	for (const method of opts.asyncMethods) {
		const func = object[method];
		if (typeof func === 'function' && method !== 'prepare') {
			object[method] = traceOrProfile && traceMethods[method] ?
				(...args) => thenable((res, rej) => {
					try {
						let resolve = res;
						const sp = statementParams.get(object);
						if (method === 'bind') boundParams.set(object, stringify(sp ? [sp, ...args] : args));
						const bp = boundParams.get(object);
						const sql = stringify(bp ? [bp, ...args] : sp ? [sp, ...args] : args);

						// trace: before call
						if (typeof opts.trace === 'function')
							opts.trace(sql, method, ctorName);

						// profile: after call
						if (typeof opts.profile === 'function') {
							let hrtime = process.hrtime();
							resolve = val => {
								// @ts-ignore
								hrtime = process.hrtime(hrtime);
								opts.profile(sql, hrtime[0] * 1e3 + hrtime[1] / 1e6, method, ctorName);
								res(val);
							};
						}

						args.push((err, val) => err ? rej(err) : resolve(val));
						func.apply(object, args);
					}
					catch (err) { rej(err); }
				}) :
				(...args) => thenable((res, rej) => {
					try {
						args.push((err, val) => err ? rej(err) : res(val));
						func.apply(object, args);
					}
					catch (err) { rej(err); }
				});
		}
	}

	// prepare method of Database for Statement
	const prepare = object.prepare;
	if (typeof prepare === 'function') {
		object.prepare = (...args) => thenable((res, rej) => {
			try {
				args.push(err => err ? rej(err) : res(stmt));
				const stmt = asyncSqlite(prepare.apply(object, args), opts);
				if (traceOrProfile) statementParams.set(stmt, stringify(args));
			}
			catch (err) { rej(err); }
		});
	}

	return object;
}


/**
 * makeThenable: make thenable object. object has then method.
 * @param {function} func
 * @returns promise-like-object
 */
function makeThenable(func) {
	return { then: func };
}


/**
 * newPromise: make promise object.
 * @param {any} func
 * @returns promise-object
 */
function newPromise(func) {
	return new Promise(func);
}


/**
 * stringify: stringfigy arguments.
 * @param {any[]} args 
 * @returns string
 */
function stringify(args) {
	return args.reduce((prev, curr, i) => {
		if (typeof curr === 'function') return prev;

		const delim = i === 0 ? '' : '; ';
		if (i === 0 && typeof curr === 'string') prev += delim + curr;
		else prev += delim + JSON.stringify(curr);
		return prev;
	}, '');
}
