# [aa-sqlite3](https://www.npmjs.com/package/aa-sqlite3) - npm

**aa-sqlite3 (Async Await SQLite3)** is simple awaitable wrapper for **sqlite3** in async function.


# INSTALL:

```bash
$ npm install aa-sqlite3 sqlite3
```

# PREPARE:

```js
const sqlite3 = require('sqlite3').verbose();
const aaSqlite3 = require('aa-sqlite3');

const db = aaSqlite3(new sqlite3.Database('./test.db'));
```

or

```js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./test.db');

const aaSqlite3 = require('aa-sqlite3');
aaSqlite3(db);
```

# EXAMPLE:

Simple example:

```js
'use strict';

const sqlite3 = require('sqlite3').verbose();
const aaSqlite3 = require('aa-sqlite3');

(async () => {
  // Simple example:
  const db = aaSqlite3(new sqlite3.Database('./test.db'));

  // db.on('trace', (sql) => console.log('trace:', sql));
  db.on('profile', (sql, msec) => console.log('profile:', sql, msec, 'msec'));

  await db.exec('DROP TABLE IF EXISTS users');
  await db.exec('CREATE TABLE IF NOT EXISTS users(name TEXT UNIQUE, age INTEGER)');

  await db.run('INSERT INTO users(name, age) VALUES($name, $age)', { $name: 'Kaz', $age: 57 });
  await db.run('INSERT INTO users(name, age) VALUES(?, ?)', 'Leo', 13);

  const rows = await db.all('SELECT * FROM users');
  console.log('db.all: =>', rows.length, 'rows:', rows);

  const row = await db.get('SELECT * FROM users WHERE name = $name', { $name: 'Leo' });
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
```

Other example:

```js
'use strict';

const sqlite3 = require('sqlite3').verbose();
const aaSqlite3 = require('aa-sqlite3');

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
})().catch(console.error);
```

# FORMAT:

## **aaSqlite3** (**object**, [**options**]) - replace all methods awaitable (for Database and Statement)

- **object**: sqlite3 Database object (instance)

- **options**: options for aaSqlite3

  - key **"trace"**: trace function (call before method)  
  **(sql, method, constructorName) => void**

    - **sql**: sql string and parameters
    - **method**: "run", "exec", "get", "all", and so on
    - **constructorName**: "Database" or "Statement"

  - key **"profile"**: profile function (call after method)  
  **(sql, msec, method, constructorName) => void**

    - **sql**: sql string and parameters
    - **msec**: milliseconds
    - **method**: "run", "exec", "get", "all", and so on
    - **constructorName**: "Database" or "Statement"

  - key **"asyncMethods"**: array of awaitable methods string  
  default: [  
  'run', 'exec', 'get', 'all', 'each',  
  'close', 'map', 'loadExtension',  
  'bind', 'reset', 'finalize',  
  ]

  - key **"traceMethods"**: array of traceable methods string for trace and profile  
  default: [  
  'run', 'exec', 'get', 'all', 'each', 'map',  
  ]

  - key **"usePromise"**: use Promise or else,  
  if true: use native Promise or,  
  if false: simple thenable object

  - key **"getActualOptions"**: get actual options object  
  **(options) => void**

# GIT REPOSITORY

https://github.com/LightSpeedWorks/aa-sqlite3

# LICENSE:

  MIT
