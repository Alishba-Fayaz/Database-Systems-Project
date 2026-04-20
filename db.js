const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',          // Default XAMPP password is empty
    database: 'entrepreneur_funding',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// Test connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        console.error('   Make sure XAMPP MySQL is running and database is created.');
    } else {
        console.log('MySQL Database connected successfully.');
        connection.release();
    }
});

module.exports = promisePool;
