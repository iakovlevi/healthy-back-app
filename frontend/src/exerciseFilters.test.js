import { filterByPressure, filterByPosition, filterWorkoutsByPressure, filterWorkoutsByPosition } from './exerciseFilters';

// Мок упражнений для тестов
const MOCK_EXERCISES = {
    suboccipital_release: { id: 'suboccipital_release', zones: ['Шея'], pressureImpact: false, position: 'lying' },
    upper_traps_ball: { id: 'upper_traps_ball', zones: ['Плечи'], pressureImpact: false, position: 'standing' },
    glute_roll: { id: 'glute_roll', zones: ['Ягодицы'], pressureImpact: false, position: 'sitting' },
    dumbbell_row: { id: 'dumbbell_row', zones: ['Спина', 'Бицепс'], pressureImpact: true, position: 'combined' },
    goblet_squat: { id: 'goblet_squat', zones: ['Ноги', 'Ягодицы'], pressureImpact: true, position: 'standing' },
    floor_press: { id: 'floor_press', zones: ['Грудь', 'Трицепс'], pressureImpact: false, position: 'lying' },
    cat_cow: { id: 'cat_cow', zones: ['Спина'], pressureImpact: false, position: 'combined' }
};

const MOCK_WORKOUTS = [
    { id: 'relax_program', title: 'Релакс', exercises: ['suboccipital_release', 'glute_roll', 'floor_press'] },
    { id: 'strength_program', title: 'Сила', exercises: ['dumbbell_row', 'goblet_squat'] },
    { id: 'mixed_program', title: 'Смешанная', exercises: ['suboccipital_release', 'goblet_squat'] }
];

describe('filterByPressure', () => {
    it('returns all exercises when excludeHighPressure is false', () => {
        const result = filterByPressure(Object.values(MOCK_EXERCISES), false);
        expect(result).toHaveLength(Object.keys(MOCK_EXERCISES).length);
    });

    it('excludes exercises with pressureImpact=true when excludeHighPressure is true', () => {
        const result = filterByPressure(Object.values(MOCK_EXERCISES), true);
        expect(result.every(ex => !ex.pressureImpact)).toBe(true);
        expect(result).toHaveLength(5); // suboccipital, upper_traps, glute_roll, floor_press, cat_cow
    });

    it('returns empty array when all exercises have high pressure', () => {
        const highPressureOnly = [
            { id: 'ex1', pressureImpact: true },
            { id: 'ex2', pressureImpact: true }
        ];
        const result = filterByPressure(highPressureOnly, true);
        expect(result).toHaveLength(0);
    });
});

describe('filterByPosition', () => {
    it('returns all exercises when positions array is empty', () => {
        const result = filterByPosition(Object.values(MOCK_EXERCISES), []);
        expect(result).toHaveLength(Object.keys(MOCK_EXERCISES).length);
    });

    it('filters exercises by single position', () => {
        const result = filterByPosition(Object.values(MOCK_EXERCISES), ['lying']);
        expect(result).toHaveLength(2); // suboccipital_release, floor_press
        expect(result.every(ex => ex.position === 'lying')).toBe(true);
    });

    it('filters exercises by multiple positions', () => {
        const result = filterByPosition(Object.values(MOCK_EXERCISES), ['lying', 'sitting']);
        expect(result).toHaveLength(3); // suboccipital_release, glute_roll, floor_press
        expect(result.every(ex => ['lying', 'sitting'].includes(ex.position))).toBe(true);
    });

    it('returns combined exercises when combined is selected', () => {
        const result = filterByPosition(Object.values(MOCK_EXERCISES), ['combined']);
        expect(result).toHaveLength(2); // dumbbell_row, cat_cow
    });
});

describe('filterWorkoutsByPressure', () => {
    it('returns all workouts when excludeHighPressure is false', () => {
        const result = filterWorkoutsByPressure(MOCK_WORKOUTS, MOCK_EXERCISES, false);
        expect(result).toHaveLength(MOCK_WORKOUTS.length);
    });

    it('excludes workouts with AT LEAST ONE high pressure exercise', () => {
        const result = filterWorkoutsByPressure(MOCK_WORKOUTS, MOCK_EXERCISES, true);
        expect(result).toHaveLength(1); // only relax_program
        expect(result[0].id).toBe('relax_program');
    });

    it('keeps workouts where all exercises have no pressure impact', () => {
        const safeWorkouts = [{ id: 'safe', exercises: ['suboccipital_release', 'floor_press'] }];
        const result = filterWorkoutsByPressure(safeWorkouts, MOCK_EXERCISES, true);
        expect(result).toHaveLength(1);
    });
});

describe('filterWorkoutsByPosition', () => {
    it('returns all workouts when positions array is empty', () => {
        const result = filterWorkoutsByPosition(MOCK_WORKOUTS, MOCK_EXERCISES, []);
        expect(result).toHaveLength(MOCK_WORKOUTS.length);
    });

    it('keeps workouts where ALL exercises match selected positions', () => {
        const result = filterWorkoutsByPosition(MOCK_WORKOUTS, MOCK_EXERCISES, ['lying', 'sitting']);
        // relax_program: suboccipital(lying), glute(sitting), floor_press(lying) -> all match
        // strength_program: dumbbell_row(combined), goblet_squat(standing) -> none match
        // mixed_program: suboccipital(lying), goblet_squat(standing) -> not all match
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('relax_program');
    });

    it('supports combined position filter', () => {
        const workoutsWithCombined = [{ id: 'combined_only', exercises: ['dumbbell_row', 'cat_cow'] }];
        const result = filterWorkoutsByPosition(workoutsWithCombined, MOCK_EXERCISES, ['combined']);
        expect(result).toHaveLength(1);
    });

    it('excludes workout if any exercise does not match positions', () => {
        const result = filterWorkoutsByPosition(MOCK_WORKOUTS, MOCK_EXERCISES, ['lying']);
        // relax_program has glute_roll (sitting) -> exclude
        // Only workouts where ALL exercises are lying
        expect(result).toHaveLength(0);
    });
});
