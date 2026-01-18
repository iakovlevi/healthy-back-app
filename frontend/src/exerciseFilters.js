/**
 * Фильтры для упражнений и программ
 * 
 * Реализация PRD: Категоризация и фильтрация упражнений
 */

/**
 * Фильтрует упражнения по внутрибрюшному давлению
 * @param {Array} exercises - Массив упражнений
 * @param {boolean} excludeHighPressure - Исключить упражнения с повышенным давлением
 * @returns {Array} Отфильтрованный массив упражнений
 */
export const filterByPressure = (exercises, excludeHighPressure) => {
    if (!excludeHighPressure) return exercises;
    return exercises.filter(ex => !ex.pressureImpact);
};

/**
 * Фильтрует упражнения по положению тела
 * @param {Array} exercises - Массив упражнений
 * @param {Array<string>} positions - Массив допустимых позиций ('standing', 'sitting', 'lying', 'combined')
 * @returns {Array} Отфильтрованный массив упражнений
 */
export const filterByPosition = (exercises, positions) => {
    if (!positions || positions.length === 0) return exercises;
    return exercises.filter(ex => positions.includes(ex.position));
};

/**
 * Фильтрует программы тренировок по внутрибрюшному давлению
 * Программа скрывается, если содержит ХОТЯ БЫ ОДНО упражнение с pressureImpact=true
 * @param {Array} workouts - Массив программ
 * @param {Object} exercises - Объект всех упражнений (ключ = id)
 * @param {boolean} excludeHighPressure - Исключить программы с давлением
 * @returns {Array} Отфильтрованный массив программ
 */
export const filterWorkoutsByPressure = (workouts, exercises, excludeHighPressure) => {
    if (!excludeHighPressure) return workouts;
    return workouts.filter(workout => {
        return workout.exercises.every(exId => {
            const exercise = exercises[exId];
            return exercise && !exercise.pressureImpact;
        });
    });
};

/**
 * Фильтрует программы тренировок по положению тела
 * Программа показывается, только если ВСЕ её упражнения соответствуют выбранным положениям
 * @param {Array} workouts - Массив программ
 * @param {Object} exercises - Объект всех упражнений (ключ = id)
 * @param {Array<string>} positions - Массив допустимых позиций
 * @returns {Array} Отфильтрованный массив программ
 */
export const filterWorkoutsByPosition = (workouts, exercises, positions) => {
    if (!positions || positions.length === 0) return workouts;
    return workouts.filter(workout => {
        return workout.exercises.every(exId => {
            const exercise = exercises[exId];
            return exercise && positions.includes(exercise.position);
        });
    });
};
