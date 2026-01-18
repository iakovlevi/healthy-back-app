const express = require('express');
const serverless = require('serverless-http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const { Driver, getCredentialsFromEnv, TypedValues, Session } = require('ydb-sdk');

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
const DATA_TYPES = ['history', 'painLogs', 'weights', 'achievements', 'readinessLogs'];
const META_TYPE = '__meta__';

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

// DISABLE CACHING FOR /data/* ENDPOINTS
// Prevents 304 Not Modified responses that return stale empty data
app.use('/data', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
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

const calculateChecksum = (payloadStr) => {
    return crypto.createHash('sha256').update(payloadStr).digest('hex');
};

const hashEmail = (email) => {
    if (!email) return null;
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
};

const getItemCount = (payload) => {
    if (Array.isArray(payload)) return payload.length;
    return null;
};

const getPayloadSize = (payloadStr) => {
    return payloadStr.length;
};

const isPayloadEmpty = (payload) => {
    if (Array.isArray(payload)) return payload.length === 0;
    if (payload && typeof payload === 'object') return Object.keys(payload).length === 0;
    return true;
};

const parsePayload = (payload, typeLabel = 'unknown') => {
    if (typeof payload !== 'string') return payload;
    try {
        return JSON.parse(payload);
    } catch (e) {
        console.error(`[DB] JSON Parse Error for type ${typeLabel}:`, e.message);
        return payload;
    }
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
            console.log(`[DB] Creating user: ${email}, id: ${id}`);
            await session.executeQuery(
                query,
                {
                    '$id': TypedValues.utf8(id),
                    '$email': TypedValues.utf8(email),
                    '$hash': TypedValues.utf8(hash)
                },
                Session.AUTO_TX_RW
            );
        });
        return { id, email };
    },
    getDataByType: async (userId, type) => {
        if (!dbDriver) throw new Error("Database driver not initialized");
        return await dbDriver.tableClient.withSession(async (session) => {
            const query = `DECLARE $userId AS Utf8; DECLARE $type AS Utf8; SELECT type, payload FROM userData WHERE userId = $userId AND type = $type;`;
            const { resultSets } = await session.executeQuery(query, {
                '$userId': TypedValues.utf8(userId),
                '$type': TypedValues.utf8(type)
            });
            const rows = resultSets?.[0]?.rows || [];
            const columns = resultSets?.[0]?.columns || [];
            if (rows.length === 0) {
                return { payload: null, meta: null };
            }
            const formatted = formatRow(rows[0], columns);
            const parsed = parsePayload(formatted.payload, formatted.type);

            // Handle atomic metadata format
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.data !== undefined) {
                return {
                    payload: parsed.data,
                    meta: {
                        lastUpdatedAt: parsed.lastUpdatedAt || null,
                        checksum: parsed.checksum || null
                    }
                };
            }

            return { payload: parsed, meta: null };
        });
    },
    getMeta: async (userId) => {
        // Legacy getMeta for backward compatibility
        const result = await db.getDataByType(userId, META_TYPE);
        if (result.payload && typeof result.payload === 'object') {
            return result.payload;
        }
        return {};
    },
    updateMeta: async (userId, type, metaPatch) => {
        // No longer used for new data, but kept for legacy support/migration
        const current = await db.getMeta(userId);
        const merged = {
            ...current,
            [type]: {
                ...(current[type] || {}),
                ...metaPatch
            }
        };
        await db.saveData(userId, META_TYPE, merged);
        return merged;
    },
    getData: async (userId, fallbackId = null) => {
        if (!dbDriver) throw new Error("Database driver not initialized");
        const fetchByUserId = async (id) => {
            return await dbDriver.tableClient.withSession(async (session) => {
                const query = `DECLARE $userId AS Utf8; SELECT type, payload FROM userData WHERE userId = $userId;`;
                const { resultSets } = await session.executeQuery(query, {
                    '$userId': TypedValues.utf8(id)
                });
                const rows = resultSets?.[0]?.rows || [];
                const columns = resultSets?.[0]?.columns || [];
                return { rows, columns };
            });
        };

        const parseRows = (rows, columns, resolvedId) => {
            const data = {};
            let meta = {};
            const types = [];
            console.log(`[DB] getData for ${resolvedId} found ${rows.length} rows`);

            rows.forEach((row, idx) => {
                const formatted = formatRow(row, columns);
                const parsed = parsePayload(formatted.payload, formatted.type);

                if (formatted.type === META_TYPE) {
                    if (parsed && typeof parsed === 'object') {
                        // Merge legacy meta
                        meta = { ...meta, ...parsed };
                    }
                } else {
                    // Check for atomic metadata format
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.data !== undefined) {
                        data[formatted.type] = parsed.data;
                        meta[formatted.type] = {
                            lastUpdatedAt: parsed.lastUpdatedAt || null,
                            checksum: parsed.checksum || null
                        };
                    } else {
                        data[formatted.type] = parsed;
                    }
                    types.push(formatted.type);
                }
            });
            console.log(`[DB] Fetched data keys for ${resolvedId}:`, Object.keys(data));
            return { data, meta, types };
        };

        const emailHash = hashEmail(fallbackId);
        const primaryRows = await fetchByUserId(userId);
        const primaryParsed = parseRows(primaryRows.rows, primaryRows.columns, userId);

        const sourceByType = {};
        DATA_TYPES.forEach((type) => {
            sourceByType[type] = 'primary';
        });

        const typesNeedingLegacy = DATA_TYPES.filter((type) => {
            const payload = primaryParsed.data[type];
            const metaEntry = primaryParsed.meta?.[type];
            return isPayloadEmpty(payload) && !(metaEntry && metaEntry.lastUpdatedAt);
        });

        let legacyParsed = { data: {}, meta: {}, types: [] };
        const migratedTypes = [];
        let legacyChecked = false;
        let legacyRowCount = 0;

        if (typesNeedingLegacy.length > 0 && fallbackId && fallbackId !== userId) {
            legacyChecked = true;
            const legacyRows = await fetchByUserId(fallbackId);
            legacyRowCount = legacyRows.rows.length;
            legacyParsed = parseRows(legacyRows.rows, legacyRows.columns, fallbackId);

            typesNeedingLegacy.forEach((type) => {
                const legacyPayload = legacyParsed.data[type];
                const legacyMetaEntry = legacyParsed.meta?.[type];
                const hasLegacySignal = !isPayloadEmpty(legacyPayload) || (legacyMetaEntry && legacyMetaEntry.lastUpdatedAt);
                if (hasLegacySignal) {
                    primaryParsed.data[type] = legacyPayload;
                    sourceByType[type] = 'legacy';
                    migratedTypes.push(type);
                }
            });
        }

        const normalized = normalizeUserData(primaryParsed.data);
        const migrationMeta = {};

        if (migratedTypes.length > 0) {
            await Promise.all(migratedTypes.map((type) => {
                const payload = normalized[type];
                const payloadStr = JSON.stringify(payload);
                const checksum = calculateChecksum(payloadStr);
                const legacyMetaEntry = legacyParsed.meta?.[type];
                const lastUpdatedAt = legacyMetaEntry?.lastUpdatedAt || new Date().toISOString();
                migrationMeta[type] = { lastUpdatedAt, checksum };
                return Promise.all([
                    db.saveData(userId, type, payload),
                    db.updateMeta(userId, type, { lastUpdatedAt, checksum })
                ]);
            }));
            console.log(`[DATA] Migrated ${migratedTypes.length} data blocks from legacy key to ${userId}`);
        }

        const legacyKeyNotFound = legacyChecked
            && migratedTypes.length === 0
            && typesNeedingLegacy.length === DATA_TYPES.length;

        if (legacyKeyNotFound) {
            console.log('[EVENT] legacy_key_not_found', {
                userId,
                emailHash,
                env: { endpoint: YDB_ENDPOINT, database: YDB_DATABASE }
            });
        }

        const meta = {};
        DATA_TYPES.forEach((type) => {
            const source = sourceByType[type];
            const baseMeta = source === 'legacy' ? legacyParsed.meta?.[type] : primaryParsed.meta?.[type];
            const payload = normalized[type];
            const checksum = baseMeta?.checksum || (payload !== undefined ? calculateChecksum(JSON.stringify(payload)) : null);
            const lastUpdatedAt = migrationMeta[type]?.lastUpdatedAt || baseMeta?.lastUpdatedAt || null;
            meta[type] = {
                lastUpdatedAt,
                checksum,
                source
            };
        });

        console.log('[DATA] Sync meta', {
            userId,
            emailHash,
            rowsRead: {
                primary: primaryRows.rows.length,
                legacy: legacyChecked ? legacyRowCount : 0
            },
            source: sourceByType,
            env: { endpoint: YDB_ENDPOINT, database: YDB_DATABASE }
        });

        return { ...normalized, meta, legacyKeyNotFound };
    },
    saveData: async (userId, type, payload, meta = null) => {
        if (!dbDriver) throw new Error("Database driver not initialized");
        await dbDriver.tableClient.withSession(async (session) => {
            const query = `DECLARE $userId AS Utf8; DECLARE $type AS Utf8; DECLARE $payload AS Utf8; UPSERT INTO userData (userId, type, payload) VALUES ($userId, $type, $payload);`;

            // Atomic storage: wrap payload with metadata if provided
            let finalPayload = payload;
            if (meta && type !== META_TYPE) {
                finalPayload = {
                    data: payload,
                    checksum: meta.checksum,
                    lastUpdatedAt: meta.lastUpdatedAt || new Date().toISOString()
                };
            }

            const payloadStr = JSON.stringify(finalPayload);
            console.log(`[DB] Saving data for ${userId}, type=${type}, payload length=${payloadStr.length}`, {
                env: { endpoint: YDB_ENDPOINT, database: YDB_DATABASE }
            });
            await session.executeQuery(
                query,
                {
                    '$userId': TypedValues.utf8(userId),
                    '$type': TypedValues.utf8(type),
                    '$payload': TypedValues.utf8(payloadStr)
                },
                Session.AUTO_TX_RW
            );
        });
    },
    // Performs write + read verification in same session to avoid race conditions
    saveDataWithVerification: async (userId, type, payload, meta = null) => {
        if (!dbDriver) throw new Error("Database driver not initialized");

        // Atomic storage: wrap payload with metadata if provided
        let finalPayload = payload;
        if (meta && type !== META_TYPE) {
            finalPayload = {
                data: payload,
                checksum: meta.checksum,
                lastUpdatedAt: meta.lastUpdatedAt || new Date().toISOString()
            };
        }
        const payloadStr = JSON.stringify(finalPayload);

        return await dbDriver.tableClient.withSession(async (session) => {
            // 1. Write data
            const writeQuery = `DECLARE $userId AS Utf8; DECLARE $type AS Utf8; DECLARE $payload AS Utf8; UPSERT INTO userData (userId, type, payload) VALUES ($userId, $type, $payload);`;
            console.log(`[DB] Saving data for ${userId}, type=${type}, payload length=${payloadStr.length}`, {
                env: { endpoint: YDB_ENDPOINT, database: YDB_DATABASE }
            });
            await session.executeQuery(
                writeQuery,
                {
                    '$userId': TypedValues.utf8(userId),
                    '$type': TypedValues.utf8(type),
                    '$payload': TypedValues.utf8(payloadStr)
                },
                Session.AUTO_TX_RW
            );

            // 2. Read back data in the same session for verification
            const readQuery = `DECLARE $userId AS Utf8; DECLARE $type AS Utf8; SELECT type, payload FROM userData WHERE userId = $userId AND type = $type;`;
            const { resultSets } = await session.executeQuery(readQuery, {
                '$userId': TypedValues.utf8(userId),
                '$type': TypedValues.utf8(type)
            });

            const rows = resultSets?.[0]?.rows || [];
            const columns = resultSets?.[0]?.columns || [];
            if (rows.length === 0) {
                return { verified: false, readPayload: null };
            }
            const formatted = formatRow(rows[0], columns);
            const parsed = parsePayload(formatted.payload, type);

            // Unwrap if using atomic format
            const readData = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.data !== undefined)
                ? parsed.data
                : parsed;

            return { verified: true, readPayload: readData };
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
        const data = await db.getData(req.user.id, req.user.email);
        console.log(`[DATA] Sync successful for user ${req.user.id}`);
        res.json(data);
    } catch (e) {
        console.error('[DATA] Sync error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/data/:type', authMiddleware, async (req, res) => {
    try {
        const type = req.params.type;
        const restoreFromSnapshot = req.query.restoreFromSnapshot === '1' || req.query.restoreFromSnapshot === 'true';
        const payload = (restoreFromSnapshot
            && req.body
            && typeof req.body === 'object'
            && !Array.isArray(req.body)
            && Object.prototype.hasOwnProperty.call(req.body, 'data'))
            ? req.body.data
            : req.body;
        const safePayload = payload === undefined ? null : payload;
        const payloadStr = JSON.stringify(safePayload);
        const checksum = calculateChecksum(payloadStr);
        const itemCount = getItemCount(safePayload);
        const payloadSize = getPayloadSize(payloadStr);
        const savedAt = new Date().toISOString();

        // Use atomic write+verify including metadata in the same payload
        // This eliminates the race condition between data and __meta__ updates
        const meta = { checksum, lastUpdatedAt: savedAt };
        const { verified, readPayload } = await db.saveDataWithVerification(req.user.id, type, safePayload, meta);

        if (!verified) {
            console.error('[EVENT] write_mismatch', {
                userId: req.user.id,
                type,
                payloadSize,
                itemCount,
                checksum,
                readItemCount: null,
                readChecksum: null,
                restoreFromSnapshot,
                reason: 'verification_read_empty',
                env: { endpoint: YDB_ENDPOINT, database: YDB_DATABASE }
            });
            return res.status(500).json({ error: 'write_mismatch' });
        }

        const readPayloadStr = JSON.stringify(readPayload ?? null);
        const readChecksum = calculateChecksum(readPayloadStr);
        const readItemCount = getItemCount(readPayload);

        if (readChecksum !== checksum || (itemCount !== null && readItemCount !== itemCount)) {
            console.error('[EVENT] write_mismatch', {
                userId: req.user.id,
                type,
                payloadSize,
                itemCount,
                checksum,
                readItemCount,
                readChecksum,
                restoreFromSnapshot,
                reason: 'checksum_or_count_mismatch',
                env: { endpoint: YDB_ENDPOINT, database: YDB_DATABASE }
            });
            return res.status(500).json({ error: 'write_mismatch' });
        }

        console.log(`[DATA] Save successful: ${type} for user ${req.user.id}`, {
            payloadSize,
            itemCount,
            checksum,
            restoreFromSnapshot,
            env: { endpoint: YDB_ENDPOINT, database: YDB_DATABASE }
        });
        res.json({ success: true, type, savedAt, payloadSize, itemCount, checksum });
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
