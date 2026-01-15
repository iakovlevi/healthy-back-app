import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkoutsView, WorkoutPlayer } from './app';

const makeListState = (overrides = {}) => ({
    filter: 'program',
    selectedCategory: null,
    scrollTop: 0,
    restoredFromStorage: true,
    ...overrides
});

describe('WorkoutsView', () => {
    it('restores list state and notifies when navigating back', async () => {
        const user = userEvent.setup();
        const onListStateChange = jest.fn();

        render(
            <WorkoutsView
                startWorkout={jest.fn()}
                listState={makeListState({ filter: 'single', selectedCategory: 'strength' })}
                onListStateChange={onListStateChange}
            />
        );

        await act(async () => {
            await user.click(screen.getByTestId('workouts-back-button'));
        });
        expect(onListStateChange).toHaveBeenCalledWith(expect.objectContaining({ selectedCategory: null }));
    });

    it('starts a workout from list with source metadata', async () => {
        const user = userEvent.setup();
        const startWorkout = jest.fn();

        render(
            <WorkoutsView
                startWorkout={startWorkout}
                listState={makeListState({ filter: 'single', selectedCategory: 'strength' })}
                onListStateChange={jest.fn()}
            />
        );

        await act(async () => {
            await user.click(screen.getByTestId('workout-item-dumbbell_row'));
        });
        expect(startWorkout).toHaveBeenCalled();
        expect(startWorkout.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 'single_dumbbell_row' }));
        expect(startWorkout.mock.calls[0][1]).toBe('list');
    });
});

describe('WorkoutPlayer start screen', () => {
    it('shows a short program list with an expand control', async () => {
        const user = userEvent.setup();
        const workout = {
            id: 'custom_program',
            title: 'Custom Program',
            subtitle: 'Test',
            duration: '8 мин',
            type: 'relax',
            exercises: ['suboccipital_release', 'upper_traps_ball', 'thoracic_roll', 'glute_roll'],
            color: 'bg-slate-100 text-slate-800'
        };

        render(
            <WorkoutPlayer
                workout={workout}
                onClose={jest.fn()}
                onComplete={jest.fn()}
                onLogPreReadiness={jest.fn()}
                preSurveyDone={false}
                savedWeights={{}}
                onSaveWeight={jest.fn()}
            />
        );

        expect(screen.getAllByTestId('start-screen-exercise-item')).toHaveLength(3);
        await act(async () => {
            await user.click(screen.getByTestId('start-screen-more-button'));
        });
        expect(screen.getAllByTestId('start-screen-exercise-item')).toHaveLength(4);
    });
});

describe('Strength flow', () => {
    it('skips rest and moves to the next set', async () => {
        const user = userEvent.setup();
        const workout = {
            id: 'single_goblet',
            title: 'Goblet',
            exercises: ['goblet_squat'],
            color: 'bg-slate-100 text-slate-800'
        };

        render(
            <WorkoutPlayer
                workout={workout}
                onClose={jest.fn()}
                onComplete={jest.fn()}
                onLogPreReadiness={jest.fn()}
                preSurveyDone={true}
                savedWeights={{}}
                onSaveWeight={jest.fn()}
            />
        );

        await act(async () => {
            await user.click(screen.getByTestId('start-screen-start'));
        });

        await act(async () => {
            await user.clear(screen.getByTestId('strength-input-weight'));
            await user.type(screen.getByTestId('strength-input-weight'), '10');
            await user.clear(screen.getByTestId('strength-input-sets'));
            await user.type(screen.getByTestId('strength-input-sets'), '2');
            await user.clear(screen.getByTestId('strength-input-reps'));
            await user.type(screen.getByTestId('strength-input-reps'), '5');
            await user.clear(screen.getByTestId('strength-input-rest'));
            await user.type(screen.getByTestId('strength-input-rest'), '30');
            await user.click(screen.getByTestId('strength-start'));
        });

        expect(screen.getByTestId('strength-set-indicator')).toHaveTextContent('1/2');

        await act(async () => {
            await user.click(screen.getByTestId('strength-complete-set'));
        });
        expect(screen.getByTestId('strength-rest')).toBeInTheDocument();

        await act(async () => {
            await user.click(screen.getByTestId('strength-rest-skip'));
        });
        expect(screen.getByTestId('strength-set-indicator')).toHaveTextContent('2/2');
    });
});
