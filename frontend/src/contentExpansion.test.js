import { EXERCISES, WORKOUTS } from './app';

const LOW_PRESSURE_STRENGTH_IDS = [
    'tricep_ext_lying',
    'bicep_curl_sitting',
    'concentration_curl',
    'lateral_raise_sitting',
    'front_raise_sitting',
    'rear_delt_lying',
    'floor_fly',
    'dumbbell_pullover',
    'supported_row',
    'calf_raise_sitting',
    'side_leg_lift',
    'glute_bridge_weighted'
];

const NEW_WORKOUT_IDS = [
    'mcgill_big_three',
    'office_five',
    'hip_flow',
    'healthy_sleep',
    'arms_shoulders_lp',
    'torso_lp',
    'legs_lp'
];

describe('content expansion', () => {
    it('adds low-pressure dumbbell exercises with breathing notes', () => {
        LOW_PRESSURE_STRENGTH_IDS.forEach((id) => {
            const exercise = EXERCISES[id];
            expect(exercise).toBeDefined();
            expect(exercise).toEqual(expect.objectContaining({
                type: 'strength',
                isStrength: true,
                pressureImpact: false
            }));
            expect(exercise.description).toMatch(/выдох/i);
        });
    });

    it('marks side plank as higher pressure and suggests a replacement', () => {
        const sidePlank = EXERCISES.side_plank;
        expect(sidePlank).toBeDefined();
        expect(sidePlank.pressureImpact).toBe(true);
        expect(sidePlank.description).toMatch(/dead bug|мертвый жук/i);
    });

    it('uses the core zone for stability exercises', () => {
        expect(EXERCISES.bird_dog?.zones).toContain('Кор');
        expect(EXERCISES.dead_bug?.zones).toContain('Кор');
        expect(EXERCISES.side_plank?.zones).toContain('Кор');
    });

    it('adds new workouts and keeps dumbbell programs pressure-safe', () => {
        NEW_WORKOUT_IDS.forEach((id) => {
            expect(WORKOUTS.find((workout) => workout.id === id)).toBeDefined();
        });

        ['arms_shoulders_lp', 'torso_lp', 'legs_lp'].forEach((id) => {
            const workout = WORKOUTS.find((item) => item.id === id);
            expect(workout).toBeDefined();
            const hasHighPressure = workout.exercises.some((exId) => EXERCISES[exId]?.pressureImpact);
            expect(hasHighPressure).toBe(false);
        });

        const bigThree = WORKOUTS.find((item) => item.id === 'mcgill_big_three');
        expect(bigThree.exercises).toEqual(expect.arrayContaining(['bird_dog', 'dead_bug', 'side_plank']));
    });
});
