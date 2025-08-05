const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
    user: process.env.DB_USER || process.env.USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vibe_agents_dev',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
    // Connection pool settings
    max: 20, // Maximum number of connections
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

// Database query helper function
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('📊 Query executed', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('❌ Database query error:', error);
        throw error;
    }
};

// Transaction helper function
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Database health check
const healthCheck = async () => {
    try {
        const result = await query('SELECT NOW() as current_time');
        return {
            status: 'healthy',
            timestamp: result.rows[0].current_time,
            pool: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
};

// Graceful shutdown
const closePool = async () => {
    console.log('🔄 Closing database connection pool...');
    await pool.end();
    console.log('✅ Database connection pool closed');
};

module.exports = {
    pool,
    query,
    transaction,
    healthCheck,
    closePool
};
