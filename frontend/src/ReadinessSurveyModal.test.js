import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadinessSurveyModal } from './app';

describe('ReadinessSurveyModal', () => {
    it('shows daily prefill controls in pre context and reveals sleep/stress on edit', async () => {
        const user = userEvent.setup();
        const onSave = jest.fn();
        const onClose = jest.fn();
        render(
            <ReadinessSurveyModal
                context="pre"
                onSave={onSave}
                onClose={onClose}
                dailyPrefill={{ sleep: 7, stress: 3, createdAt: new Date().toISOString() }}
            />
        );

        expect(screen.getByText('Подставлено из daily')).toBeInTheDocument();
        expect(screen.getByText('Актуально сегодня?')).toBeInTheDocument();

        await act(async () => {
            await user.click(screen.getByRole('button', { name: 'Изменить' }));
        });

        // After edit, sleep and stress should be visible as secondary questions
        expect(screen.getAllByText('Сон').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Стресс').length).toBeGreaterThan(0);
    });

    it('hides details toggle in post context', () => {
        render(<ReadinessSurveyModal context="post" onSave={jest.fn()} onClose={jest.fn()} />);
        expect(screen.queryByText('Подробнее')).not.toBeInTheDocument();
    });

    it('saves skipped readiness as null', async () => {
        const user = userEvent.setup();
        const onSave = jest.fn();
        render(<ReadinessSurveyModal context="daily" onSave={onSave} onClose={jest.fn()} />);

        // Find buttons by text since I removed some data-testids
        const skipButtons = screen.getAllByRole('button', { name: 'Пропустить' });
        await act(async () => {
            await user.click(skipButtons[0]); // Skip readiness
        });

        // Click '5' on Sleep
        const fiveButtons = screen.getAllByRole('button', { name: '5' });
        await act(async () => {
            await user.click(fiveButtons[1]); // Assuming 2nd scale is sleep
        });

        await act(async () => {
            await user.click(screen.getByRole('button', { name: 'Завершить' }));
        });

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            context: 'daily',
            values: expect.objectContaining({
                readiness: null,
                sleep: 5
            })
        }));
    });
});
