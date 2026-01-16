const express = require('express');
const serverless = require('serverless-http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { Driver, getCredentialsFromEnv, TypedValues } = require('ydb-sdk');

const app = express();
app.use(cors());
if (process.env.NODE_ENV === 'test') {
    app.use((req, res, next) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => {
            if (data) {
                try {
                    req.body = JSON.parse(data);
                } catch (e) {
                    return res.status(400).json({ message: 'Invalid JSON' });
                }
            } else {
                req.body = {};
            }
            next();
        });
    });
} else {
    app.use(express.json());
}

// CONFIG
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-123';
let YDB_ENDPOINT = process.env.YDB_ENDPOINT || "";

const normalizeYdbDatabase = (value) => {
    if (!value) return value;
    let normalized = value.trim();
    const ruIndex = normalized.indexOf('/ru-');
    if (ruIndex >= 0) {
        normalized = normalized.slice(ruIndex);
    } else if (normalized.startsWith('ru-')) {
        normalized = `/${normalized}`;
    }
    return normalized;
};

let YDB_DATABASE = normalizeYdbDatabase(process.env.YDB_DATABASE || "");

// Чистим эндпоинт от протоколов и лишних параметров (важно для v3)
if (YDB_ENDPOINT) {
    YDB_ENDPOINT = YDB_ENDPOINT.replace("grpcs://", "").replace("grpc://", "").split("?")[0].replace(/\/$/, "");
}

console.log(`[INIT] YDB Config: Endpoint="${YDB_ENDPOINT}", Database="${YDB_DATABASE}"`);

// LOGGING MIDDLEWARE
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
});

// DB INIT
const authService = getCredentialsFromEnv();
let dbDriver = new Driver({
    endpoint: YDB_ENDPOINT,
    database: YDB_DATABASE,
    authService,
});

(async () => {
    try {
        if (!await dbDriver.ready(20000)) {
            console.error('[DB] Driver not ready after 20s!');
        } else {
            console.log('[DB] Connected successfully to YDB');
        }
    } catch (e) {
        console.error('[DB] Initialization Failed:', e);
    }
})();

// HELPER: Format YDB row to JS object
const formatRow = (row, columns) => {
    const obj = {};
    if (!row || !columns) return obj;
    row.items.forEach((item, i) => {
        const colName = columns[i].name;
        // Robust value extraction for YDB v3
        let val = null;
        if (item.textValue !== undefined) val = item.textValue;
        else if (item.int64Value !== undefined) val = item.int64Value;
        else if (item.uint64Value !== undefined) val = item.uint64Value;
        else if (item.boolValue !== undefined) val = item.boolValue;
        else if (item.bytesValue !== undefined) {
            val = Buffer.isBuffer(item.bytesValue) ? item.bytesValue.toString('utf8') : item.bytesValue?.toString();
        }
        else if (item.doubleValue !== undefined) val = item.doubleValue;
        else if (item.floatValue !== undefined) val = item.floatValue;
        else if (item.nullFlagValue !== undefined) val = null;
        else {
            // Check for direct .value (sometimes present in SDK wrappers)
            if (item.value !== undefined) val = item.value;
            else {
                const key = Object.keys(item).find(k => k.endsWith('Value'));
                val = key ? item[key] : null;
            }
        }
        obj[colName] = val;
    });
    return obj;
};

const normalizeUserData = (data) => {
    const normalized = {
        history: Array.isArray(data.history) ? data.history : [],
        painLogs: Array.isArray(data.painLogs) ? data.painLogs : [],
        weights: (data.weights && typeof data.weights === 'object' && !Array.isArray(data.weights)) ? data.weights : {},
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        readinessLogs: Array.isArray(data.readinessLogs) ? data.readinessLogs : []
    };

    if (Array.isArray(normalized.history)) {
        normalized.history = normalized.history.map((entry) => {
            if (!entry || typeof entry !== 'object') return entry;
            if (!entry.exerciseType) {
                return {
                    ...entry,
                    exerciseType: 'time',
                    strength: entry.strength ?? null
                };
            }
            return entry;
        });
    }
    return normalized;
};

// DB OPERATIONS
const db = {
    getUser: async (email) => {
        if (!dbDriver) throw new Error("Database driver not initialized");
        return await dbDriver.tableClient.withSession(async (session) => {
            const query = `DECLARE $email AS Utf8; SELECT id, email, hash FROM users WHERE email = $email;`;
            const { resultSets } = await session.executeQuery(query, {
                '$email': TypedValues.utf8(email)
            });
            if (resultSets[0].rows?.length > 0) {
                const user = formatRow(resultSets[0].rows[0], resultSets[0].columns);
                console.log('[DB] Found User:', { ...user, hash: '***' });
                return user;
            }
            console.log('[DB] User not found for email:', email);
            return null;
        });
    },
    createUser: async (email, hash) => {
        if (!dbDriver) throw new Error("Database driver not initialized");
        const id = Date.now().toString();
        await dbDriver.tableClient.withSession(async (session) => {
            const query = `DECLARE $id AS Utf8; DECLARE $email AS Utf8; DECLARE $hash AS Utf8; UPSERT INTO users (id, email, hash) VALUES ($id, $email, $hash);`;
            await session.executeQuery(query, {
                '$id': TypedValues.utf8(id),
                '$email': TypedValues.utf8(email),
                '$hash': TypedValues.utf8(hash)
            });
        });
        return { id, email };
    },
    getData: async (userId) => {
        if (!dbDriver) throw new Error("Database driver not initialized");
        return await dbDriver.tableClient.withSession(async (session) => {
            const query = `DECLARE $userId AS Utf8; SELECT type, payload FROM userData WHERE userId = $userId;`;
            const { resultSets } = await session.executeQuery(query, {
                '$userId': TypedValues.utf8(userId)
            });
            const data = {};
            const rowCount = resultSets[0].rows?.length || 0;
            console.log(`[DB] getData for ${userId} found ${rowCount} rows`);

            resultSets[0].rows?.forEach((row, idx) => {
                const formatted = formatRow(row, resultSets[0].columns);
                console.log(`[DB] Row ${idx} type:`, formatted.type, 'Payload length:', formatted.payload?.length);
                try {
                    data[formatted.type] = typeof formatted.payload === 'string' ? JSON.parse(formatted.payload) : formatted.payload;
                } catch (e) {
                    console.error(`[DB] JSON Parse Error for type ${formatted.type}:`, e.message);
                    data[formatted.type] = formatted.payload;
                }
            });
            console.log(`[DB] Fetched data keys for ${userId}:`, Object.keys(data));
            return normalizeUserData(data);
        });
    },
    saveData: async (userId, type, payload) => {
        if (!dbDriver) throw new Error("Database driver not initialized");
        await dbDriver.tableClient.withSession(async (session) => {
            const query = `DECLARE $userId AS Utf8; DECLARE $type AS Utf8; DECLARE $payload AS Utf8; UPSERT INTO userData (userId, type, payload) VALUES ($userId, $type, $payload);`;
            console.log(`[DB] Saving data for ${userId}, type=${type}, payload length=${JSON.stringify(payload).length}`);
            await session.executeQuery(query, {
                '$userId': TypedValues.utf8(userId),
                '$type': TypedValues.utf8(type),
                '$payload': TypedValues.utf8(JSON.stringify(payload))
            });
        });
    }
};

const setDbDriverForTests = (driver) => {
    dbDriver = driver;
};

// ROUTES
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Healthy Back API is running' }));

app.post('/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

        const existing = await db.getUser(email);
        if (existing) return res.status(400).json({ message: 'User already exists' });

        const hash = await bcrypt.hash(password, 10);
        const user = await db.createUser(email, hash);

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user: { email: user.email } });
    } catch (e) {
        console.error('[AUTH] Registration error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[AUTH] Login attempt for: ${email}`);
        const user = await db.getUser(email);
        console.log('[AUTH] User found:', user ? { ...user, hash: '***' } : 'null'); // Hide hash in logs but show object existence

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (typeof user.hash !== 'string') {
            console.error('[AUTH] FATAL: Hash is not a string:', typeof user.hash, user.hash);
            return res.status(500).json({ error: 'Auth data corruption' });
        }

        if (!(await bcrypt.compare(password, user.hash))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user: { email: user.email } });
    } catch (e) {
        console.error('[AUTH] Login error:', e);
        res.status(500).json({ error: e.message });
    }
});

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        console.log(`[AUTH] Decoded user from token:`, { id: decoded.id, email: decoded.email });
        req.user = decoded;
        next();
    } catch (e) {
        console.error('[AUTH] Token verification failed:', e.message);
        res.status(401).json({ message: 'Invalid token' });
    }
};

app.get('/data/sync', authMiddleware, async (req, res) => {
    try {
        const data = await db.getData(req.user.id);
        console.log(`[DATA] Sync successful for user ${req.user.id}`);
        res.json(data);
    } catch (e) {
        console.error('[DATA] Sync error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/data/:type', authMiddleware, async (req, res) => {
    try {
        await db.saveData(req.user.id, req.params.type, req.body);
        console.log(`[DATA] Save successful: ${req.params.type} for user ${req.user.id}`);
        res.json({ success: true });
    } catch (e) {
        console.error('[DATA] Save error:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = {
    handler: serverless(app),
    app,
    db,
    formatRow,
    setDbDriverForTests,
    normalizeYdbDatabase
};
