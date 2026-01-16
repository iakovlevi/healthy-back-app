import { checkAchievementConditions, apiRequest, mockApi, mergeLegacyData } from './app';

const makeHistory = (dates, workoutId) => dates.map((date) => ({
    date: new Date(date).toISOString(),
    workoutId
}));

describe('checkAchievementConditions', () => {
    it('handles workout count achievements', () => {
        const history = makeHistory([
            new Date(2024, 0, 1),
            new Date(2024, 0, 2),
            new Date(2024, 0, 3),
            new Date(2024, 0, 4),
            new Date(2024, 0, 5)
        ], 'neck_rescue');

        expect(checkAchievementConditions('first_step', history, [], {})).toBe(true);
        expect(checkAchievementConditions('consistency_3', history, [], {})).toBe(true);
        expect(checkAchievementConditions('workout_5', history, [], {})).toBe(true);
        expect(checkAchievementConditions('workout_10', history, [], {})).toBe(false);
    });

    it('handles weight milestones', () => {
        const weights = { squat: 15, press: 5 };
        expect(checkAchievementConditions('weight_5', [], [], weights)).toBe(true);
        expect(checkAchievementConditions('weight_10', [], [], weights)).toBe(true);
        expect(checkAchievementConditions('weight_15', [], [], weights)).toBe(true);
    });

    it('handles streak achievements', () => {
        const streak3 = makeHistory([
            new Date(2024, 0, 3),
            new Date(2024, 0, 2),
            new Date(2024, 0, 1)
        ], 'neck_rescue');

        expect(checkAchievementConditions('streak_3', streak3, [], {})).toBe(true);

        const streak7 = makeHistory(
            Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 - i)),
            'neck_rescue'
        );
        expect(checkAchievementConditions('streak_7', streak7, [], {})).toBe(true);
    });

    it('handles time-of-day achievements', () => {
        const early = [{ date: new Date(2024, 0, 1, 8, 0, 0).toISOString(), workoutId: 'neck_rescue' }];
        const night = [{ date: new Date(2024, 0, 1, 22, 0, 0).toISOString(), workoutId: 'neck_rescue' }];

        expect(checkAchievementConditions('early_bird', early, [], {})).toBe(true);
        expect(checkAchievementConditions('night_owl', night, [], {})).toBe(true);
    });

    it('handles workout type achievements', () => {
        const strengthHistory = makeHistory(Array.from({ length: 5 }, (_, i) => new Date(2024, 0, i + 1)), 'full_body_strength');
        const relaxHistory = makeHistory(Array.from({ length: 5 }, (_, i) => new Date(2024, 0, i + 1)), 'neck_rescue');

        expect(checkAchievementConditions('strength_master', strengthHistory, [], {})).toBe(true);
        expect(checkAchievementConditions('relax_guru', relaxHistory, [], {})).toBe(true);
    });

    it('handles pain achievements', () => {
        const logs = Array.from({ length: 10 }, (_, i) => ({
            date: new Date(2024, 0, 1, 10, i).toISOString(),
            level: 6,
            context: 'daily'
        }));
        expect(checkAchievementConditions('pain_tracker', [], logs, {})).toBe(true);

        const pre = { date: new Date(2024, 0, 1, 10, 0, 0).toISOString(), level: 6, context: 'pre' };
        const post = { date: new Date(2024, 0, 1, 10, 30, 0).toISOString(), level: 3, context: 'post' };
        expect(checkAchievementConditions('pain_killer', [], [pre, post], {})).toBe(true);
    });

    it('returns false for unknown ids', () => {
        expect(checkAchievementConditions('unknown', [], [], {})).toBe(false);
    });
});

describe('mockApi', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('handles login and stores token', async () => {
        const promise = mockApi('/auth/login', 'POST', { email: 'a@b.com' });
        jest.runAllTimers();
        const result = await promise;

        expect(result.token).toBe('mock_token');
        expect(localStorage.getItem('user_token')).toBe('mock_token');
        expect(result.user).toEqual({ email: 'a@b.com' });
    });

    it('handles sync by reading local storage data', async () => {
        localStorage.setItem('mfr_history', JSON.stringify([{ id: 1 }]));
        localStorage.setItem('mfr_pain', JSON.stringify([{ level: 2 }]));
        localStorage.setItem('mfr_weights', JSON.stringify({ squat: 10 }));
        localStorage.setItem('mfr_achievements_v2', JSON.stringify([{ id: 'first_step' }]));
        localStorage.setItem('mfr_readiness', JSON.stringify([{ readiness: 5 }]));

        const promise = mockApi('/data/sync', 'GET');
        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({
            history: [{ id: 1 }],
            painLogs: [{ level: 2 }],
            weights: { squat: 10 },
            achievements: [{ id: 'first_step' }],
            readinessLogs: [{ readiness: 5 }]
        });
    });
});

describe('mergeLegacyData', () => {
    it('uses legacy data when remote data is empty', () => {
        const remote = {
            history: [],
            painLogs: [],
            weights: {},
            achievements: [],
            readinessLogs: []
        };
        const legacy = {
            history: [{ id: 1 }],
            painLogs: [{ level: 2 }],
            weights: { squat: 10 },
            achievements: [{ id: 'first_step' }],
            readinessLogs: [{ readiness: 5 }]
        };

        const { merged, migration } = mergeLegacyData(remote, legacy);

        expect(merged).toEqual(legacy);
        expect(migration).toEqual(legacy);
    });

    it('keeps remote data when present', () => {
        const remote = {
            history: [{ id: 1 }],
            painLogs: [{ level: 1 }],
            weights: { squat: 5 },
            achievements: [{ id: 'existing' }],
            readinessLogs: [{ readiness: 3 }]
        };
        const legacy = {
            history: [{ id: 2 }],
            painLogs: [{ level: 2 }],
            weights: { squat: 10 },
            achievements: [{ id: 'legacy' }],
            readinessLogs: [{ readiness: 5 }]
        };

        const { merged, migration } = mergeLegacyData(remote, legacy);

        expect(merged).toEqual(remote);
        expect(migration).toBeNull();
    });

    it('fills only missing types from legacy data', () => {
        const remote = {
            history: [{ id: 1 }],
            painLogs: [],
            weights: {},
            achievements: [{ id: 'existing' }],
            readinessLogs: []
        };
        const legacy = {
            history: [{ id: 2 }],
            painLogs: [{ level: 2 }],
            weights: { squat: 10 },
            achievements: [{ id: 'legacy' }],
            readinessLogs: [{ readiness: 5 }]
        };

        const { merged, migration } = mergeLegacyData(remote, legacy);

        expect(merged.history).toEqual(remote.history);
        expect(merged.painLogs).toEqual(legacy.painLogs);
        expect(merged.weights).toEqual(legacy.weights);
        expect(merged.achievements).toEqual(remote.achievements);
        expect(merged.readinessLogs).toEqual(legacy.readinessLogs);
        expect(migration).toEqual({
            painLogs: legacy.painLogs,
            weights: legacy.weights,
            readinessLogs: legacy.readinessLogs
        });
    });
});

describe('apiRequest', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        global.fetch = originalFetch;
        console.log.mockRestore();
        console.error.mockRestore();
    });

    it('uses mockApi when baseUrl is demo', async () => {
        jest.useFakeTimers();
        const promise = apiRequest('/auth/login', 'POST', { email: 'a@b.com' }, null, 'YOUR_YANDEX');
        jest.runAllTimers();
        const result = await promise;
        expect(result.token).toBe('mock_token');
        jest.useRealTimers();
    });

    it('returns parsed response on success', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true })
        });
        const result = await apiRequest('/health', 'GET', null, 'token', 'https://example.com');
        expect(result).toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/health', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
            body: null
        });
    });

    it('trims trailing slashes from baseUrl', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true })
        });
        await apiRequest('/auth/login', 'POST', { a: 1 }, null, 'https://example.com/');
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ a: 1 })
        });
    });

    it('throws server error payloads', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ message: 'Bad request' })
        });
        await expect(apiRequest('/fail', 'POST', { a: 1 }, null, 'https://example.com')).rejects.toThrow('Bad request');
    });
});
