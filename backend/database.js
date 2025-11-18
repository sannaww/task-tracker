const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

// Инициализация базы данных
db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица задач
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATETIME NOT NULL,
        completed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER NOT NULL,
        shared_with TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
});

// Promisified database methods
db.getAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.get(sql, params, function (err, row) {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

db.allAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.all(sql, params, function (err, rows) {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

db.runAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

module.exports = db;