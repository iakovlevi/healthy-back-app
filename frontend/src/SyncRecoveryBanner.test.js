import { render, screen } from '@testing-library/react';
import App from './app';

const makeSnapshot = (data, lastSyncedAt) => JSON.stringify({ data, lastSyncedAt });

describe('Sync recovery banner', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shows recovery banner when server data is empty and snapshot exists', async () => {
        localStorage.setItem('user_token', 'token');
        localStorage.setItem('mfr_last_sync', makeSnapshot({
            history: [{ id: 1 }],
            painLogs: [],
            weights: {},
            achievements: [],
            readinessLogs: []
        }, '2025-01-01T00:00:00.000Z'));

        const apiClient = jest.fn().mockResolvedValue({
            history: [],
            painLogs: [],
            weights: {},
            achievements: [],
            readinessLogs: [],
            meta: {}
        });

        render(<App apiClient={apiClient} />);

        expect(await screen.findByText('Данные не найдены на сервере. Восстановить локальную копию?')).toBeInTheDocument();
        expect(screen.getByText('Последняя синхронизация: 2025-01-01T00:00:00.000Z')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Восстановить' })).toBeEnabled();
    });

    it('blocks recovery when server has newer data', async () => {
        localStorage.setItem('user_token', 'token');
        localStorage.setItem('mfr_last_sync', makeSnapshot({
            history: [{ id: 1 }],
            painLogs: [],
            weights: {},
            achievements: [],
            readinessLogs: []
        }, '2025-01-01T00:00:00.000Z'));

        const apiClient = jest.fn().mockResolvedValue({
            history: [],
            painLogs: [],
            weights: {},
            achievements: [],
            readinessLogs: [],
            meta: {
                history: { lastUpdatedAt: '2025-02-01T00:00:00.000Z' }
            }
        });

        render(<App apiClient={apiClient} />);

        expect(await screen.findByText('Восстановление недоступно: на сервере есть более свежие данные.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Восстановить' })).toBeDisabled();
    });
});
