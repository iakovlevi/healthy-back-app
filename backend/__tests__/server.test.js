process.env.NODE_ENV = 'test';

const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const mockUtf8 = jest.fn((value) => ({ utf8: value }));
const mockWithSession = jest.fn();
const mockExecuteQuery = jest.fn();

jest.mock('ydb-sdk', () => ({
    Driver: jest.fn().mockImplementation(() => ({
        ready: jest.fn().mockResolvedValue(true),
        tableClient: {
            withSession: (...args) => mockWithSession(...args)
        }
    })),
    getCredentialsFromEnv: jest.fn(() => ({})),
    TypedValues: { utf8: (...args) => mockUtf8(...args) }
}));

const {
    app,
    db,
    formatRow,
    setDbDriverForTests
} = require('../server');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-123';

afterAll(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
});

const buildDriver = (resultSets) => ({
    tableClient: {
        withSession: jest.fn((fn) => fn({ executeQuery: jest.fn().mockResolvedValue({ resultSets }) }))
    }
});

describe('formatRow', () => {
    it('maps common YDB value shapes to a JS object', () => {
        const row = {
            items: [
                { textValue: 'text' },
                { int64Value: '1' },
                { uint64Value: '2' },
                { boolValue: true },
                { bytesValue: Buffer.from('hash') },
                { doubleValue: 1.5 },
                { floatValue: 2.5 },
                { nullFlagValue: true },
                { weirdValue: 'fallback' }
            ]
        };
        const columns = [
            { name: 'text' },
            { name: 'int' },
            { name: 'uint' },
            { name: 'bool' },
            { name: 'bytes' },
            { name: 'double' },
            { name: 'float' },
            { name: 'nullish' },
            { name: 'fallback' }
        ];

        expect(formatRow(row, columns)).toEqual({
            text: 'text',
            int: '1',
            uint: '2',
            bool: true,
            bytes: 'hash',
            double: 1.5,
            float: 2.5,
            nullish: null,
            fallback: 'fallback'
        });
    });

    it('returns empty object for missing input', () => {
        expect(formatRow(null, null)).toEqual({});
    });
});

describe('db operations', () => {
    beforeEach(() => {
        mockUtf8.mockClear();
    });

    it('getUser returns formatted row', async () => {
        const resultSets = [{
            columns: [{ name: 'id' }, { name: 'email' }, { name: 'hash' }],
            rows: [{
                items: [
                    { textValue: 'u1' },
                    { textValue: 'a@b.com' },
                    { textValue: 'hash' }
                ]
            }]
        }];
        setDbDriverForTests(buildDriver(resultSets));

        const user = await db.getUser('a@b.com');
        expect(user).toEqual({ id: 'u1', email: 'a@b.com', hash: 'hash' });
        expect(mockUtf8).toHaveBeenCalledWith('a@b.com');
    });

    it('getData returns payload by type', async () => {
        const resultSets = [{
            columns: [{ name: 'type' }, { name: 'payload' }],
            rows: [{
                items: [
                    { textValue: 'history' },
                    { textValue: JSON.stringify([{ id: 1 }]) }
                ]
            }, {
                items: [
                    { textValue: 'weights' },
                    { textValue: JSON.stringify({ squat: 10 }) }
                ]
            }]
        }];
        setDbDriverForTests(buildDriver(resultSets));

        const data = await db.getData('user-1');
        expect(data).toEqual({
            history: [{ id: 1, exerciseType: 'time', strength: null }],
            weights: { squat: 10 },
            readinessLogs: []
        });
    });

    it('getData defaults readinessLogs and migrates history entries', async () => {
        const resultSets = [{
            columns: [{ name: 'type' }, { name: 'payload' }],
            rows: [{
                items: [
                    { textValue: 'history' },
                    { textValue: JSON.stringify([
                        { id: 1, exerciseType: 'reps', strength: { weight: 10, sets: 3, reps: 8, restSec: 60 } },
                        { id: 2 }
                    ]) }
                ]
            }]
        }];
        setDbDriverForTests(buildDriver(resultSets));

        const data = await db.getData('user-1');
        expect(data).toEqual({
            history: [
                { id: 1, exerciseType: 'reps', strength: { weight: 10, sets: 3, reps: 8, restSec: 60 } },
                { id: 2, exerciseType: 'time', strength: null }
            ],
            readinessLogs: []
        });
    });

    it('saveData stringifies payload', async () => {
        const executeQuery = jest.fn().mockResolvedValue({ resultSets: [] });
        const driver = {
            tableClient: {
                withSession: jest.fn((fn) => fn({ executeQuery }))
            }
        };
        setDbDriverForTests(driver);

        await db.saveData('u1', 'history', [{ id: 1 }]);
        const [, params] = executeQuery.mock.calls[0];
        expect(params.$payload).toEqual({ utf8: JSON.stringify([{ id: 1 }]) });
    });

    it('createUser stores generated id and returns user', async () => {
        const executeQuery = jest.fn().mockResolvedValue({ resultSets: [] });
        const driver = {
            tableClient: {
                withSession: jest.fn((fn) => fn({ executeQuery }))
            }
        };
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
        setDbDriverForTests(driver);

        const created = await db.createUser('a@b.com', 'hash');
        expect(created).toEqual({ id: '1700000000000', email: 'a@b.com' });
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch('UPSERT INTO users');
        expect(params.$id).toEqual({ utf8: '1700000000000' });
        expect(params.$email).toEqual({ utf8: 'a@b.com' });
        expect(params.$hash).toEqual({ utf8: 'hash' });

        nowSpy.mockRestore();
    });
});

describe('routes', () => {
    beforeEach(() => {
        db.getUser = jest.fn();
        db.createUser = jest.fn();
        db.getData = jest.fn();
        db.saveData = jest.fn();
    });

    it('GET / responds with health status', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('POST /auth/register validates input', async () => {
        const res = await request(app).post('/auth/register').send({ email: '', password: '' });
        expect(res.status).toBe(400);
    });

    it('POST /auth/register rejects existing user', async () => {
        db.getUser.mockResolvedValue({ id: '1', email: 'a@b.com' });
        const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'pass' });
        expect(res.status).toBe(400);
    });

    it('POST /auth/register creates user and returns token', async () => {
        db.getUser.mockResolvedValue(null);
        db.createUser.mockResolvedValue({ id: '1', email: 'a@b.com' });
        const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'pass' });
        expect(res.status).toBe(200);
        expect(res.body.user).toEqual({ email: 'a@b.com' });
        expect(res.body.token).toEqual(expect.any(String));
        expect(db.createUser).toHaveBeenCalledWith('a@b.com', expect.any(String));
        expect(db.createUser.mock.calls[0][1]).not.toBe('pass');
    });

    it('POST /auth/login rejects unknown user', async () => {
        db.getUser.mockResolvedValue(null);
        const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'pass' });
        expect(res.status).toBe(401);
    });

    it('POST /auth/login rejects bad hash type', async () => {
        db.getUser.mockResolvedValue({ id: '1', email: 'a@b.com', hash: { bad: true } });
        const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'pass' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Auth data corruption');
    });

    it('POST /auth/login rejects wrong password', async () => {
        const hash = await bcrypt.hash('pass', 10);
        db.getUser.mockResolvedValue({ id: '1', email: 'a@b.com', hash });
        const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });

    it('POST /auth/login returns token for valid user', async () => {
        const hash = await bcrypt.hash('pass', 10);
        db.getUser.mockResolvedValue({ id: '1', email: 'a@b.com', hash });
        const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'pass' });
        expect(res.status).toBe(200);
        expect(res.body.user).toEqual({ email: 'a@b.com' });
        expect(res.body.token).toEqual(expect.any(String));
    });

    it('GET /data/sync requires token', async () => {
        const res = await request(app).get('/data/sync');
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('No token provided');
    });

    it('GET /data/sync rejects invalid token', async () => {
        const res = await request(app).get('/data/sync').set('Authorization', 'Bearer nope');
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid token');
    });

    it('GET /data/sync returns user data', async () => {
        const token = jwt.sign({ id: 'u1', email: 'a@b.com' }, JWT_SECRET);
        db.getData.mockResolvedValue({ history: [] });
        const res = await request(app).get('/data/sync').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ history: [] });
    });

    it('GET /data/sync handles db errors', async () => {
        const token = jwt.sign({ id: 'u1', email: 'a@b.com' }, JWT_SECRET);
        db.getData.mockRejectedValue(new Error('boom'));
        const res = await request(app).get('/data/sync').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('boom');
    });

    it('POST /data/:type persists payload', async () => {
        const token = jwt.sign({ id: 'u1', email: 'a@b.com' }, JWT_SECRET);
        const res = await request(app).post('/data/history').set('Authorization', `Bearer ${token}`).send({ ok: true });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(db.saveData).toHaveBeenCalledWith('u1', 'history', { ok: true });
    });

    it('POST /data/:type handles db errors', async () => {
        const token = jwt.sign({ id: 'u1', email: 'a@b.com' }, JWT_SECRET);
        db.saveData.mockRejectedValue(new Error('save failed'));
        const res = await request(app).post('/data/history').set('Authorization', `Bearer ${token}`).send({ ok: true });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('save failed');
    });
});
