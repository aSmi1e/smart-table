/**
 * Модуль сравнения объектов с настраиваемыми правилами
 *
 * Этот модуль позволяет гибко сравнивать JavaScript объекты,
 * используя различные стратегии сравнения, которые можно настраивать.
 * Это особенно полезно для валидации данных или фильтрации объектов.
 */

const isEmpty = (value) => {
    return value === undefined ||
        value === null ||
        value === '' ||
        (typeof value === 'number' && isNaN(value));
};

/**
 * Коллекция правил сравнения, которые можно выбирать и применять
 *
 * Подробнее: правила - это функции высшего порядка, то есть функции,
 * которые возвращают другие функции. Это позволяет создавать настраиваемые
 * правила с параметрами.
 */
const rules = {
    skipNonExistentSourceFields: (source) => (key, sourceValue, targetValue) => {
        if (!Object.prototype.hasOwnProperty.call(source, key)) {
            return { skip: true };
        }
        return { skip: false };
    },

    skipEmptyTargetValues: () => (key, sourceValue, targetValue) => {
        if (isEmpty(targetValue)) {
            return { skip: true };
        }
        return { skip: false };
    },

    failOnEmptySource: () => (key, sourceValue, targetValue) => {
        if (isEmpty(sourceValue)) {
            return { result: false };
        }
        return { continue: true };
    },

    arrayAsRange: () => (key, sourceValue, targetValue) => {
        if (Array.isArray(targetValue)) {
            if (targetValue.length === 2) {
                const [from, to] = targetValue;

                if (!isEmpty(from) && sourceValue < from) {
                    return { result: false };
                }
                if (!isEmpty(to) && sourceValue > to) {
                    return { result: false };
                }
                return { result: true };
            }
            return { result: false };
        }
        return { continue: true };
    },

    stringIncludes: () => (key, sourceValue, targetValue) => {
        if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
            return { result: sourceValue.includes(targetValue) };
        }
        return { continue: true };
    },

    caseInsensitiveStringIncludes: () => (key, sourceValue, targetValue) => {
        if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
            return { result: sourceValue.toLowerCase().includes(targetValue.toLowerCase()) };
        }
        return { continue: true };
    },

    stringExactMatch: () => (key, sourceValue, targetValue) => {
        if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
            return { result: sourceValue === targetValue };
        }
        return { continue: true };
    },

    exactEquality: () => (key, sourceValue, targetValue) => {
        return { result: sourceValue === targetValue };
    },

    deepEquality: () => (key, sourceValue, targetValue) => {
        if (typeof sourceValue === 'object' && sourceValue !== null &&
            typeof targetValue === 'object' && targetValue !== null) {
            try {
                return { result: JSON.stringify(sourceValue) === JSON.stringify(targetValue) };
            } catch (e) {
                return { result: false };
            }
        }
        return { continue: true };
    },

    numericTolerance: (tolerance = 0.001) => (key, sourceValue, targetValue) => {
        if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
            return { result: Math.abs(sourceValue - targetValue) <= tolerance };
        }
        return { continue: true };
    },

    searchMultipleFields: (searchKey, searchFields, caseSensitive = false) => (key, sourceValue, targetValue, source, target) => {
        if (key !== searchKey) {
            return { continue: true };
        }

        if (isEmpty(targetValue)) {
            return { skip: true };
        }

        const searchTerm = String(targetValue);

        for (const field of searchFields) {
            if (Object.prototype.hasOwnProperty.call(source, field)) {
                const fieldValue = source[field];

                if (isEmpty(fieldValue)) {
                    continue;
                }

                const sourceFieldValue = String(fieldValue);

                let found = false;
                if (caseSensitive) {
                    found = sourceFieldValue.includes(searchTerm);
                } else {
                    found = sourceFieldValue.toLowerCase().includes(searchTerm.toLowerCase());
                }

                if (found) {
                    return { result: true };
                }
            }
        }

        return { result: false };
    }
};

/**
 * Массив правил по умолчанию - экспортируется, но не используется в функции сравнения
 *
 * Подробнее: это набор часто используемых правил, которые можно использовать
 * как отправную точку, но вы всегда можете настроить свой собственный набор
 */
const defaultRules = [
    'skipNonExistentSourceFields',
    'skipEmptyTargetValues',
    'failOnEmptySource',
    'arrayAsRange',
    'stringIncludes',
    'exactEquality'
];

/**
 * Сравнивает исходный объект с целевым объектом, используя предоставленные правила
 *
 * @param {Object} source - Исходный объект для сравнения
 * @param {Object} target - Целевой объект, содержащий критерии сравнения
 * @param {Function[]} rulesList - Массив функций-правил для применения при сравнении
 * @returns {boolean} - True если исходный объект соответствует всем критериям по правилам, иначе false
 *
 * Подробнее: это основная функция модуля, которая проходит по каждому свойству
 * целевого объекта и применяет правила для сравнения с исходным объектом
 */
function compare(source, target, rulesList) {

    if (!source || typeof source !== 'object' || !target || typeof target !== 'object') {
        return false;
    }

    if (!Array.isArray(rulesList) || rulesList.length === 0) {
        throw new Error('Rules list is required for comparison');
    }

    for (const key in target) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            const targetValue = target[key];
            const sourceValue = source[key];

            let skipProperty = false;
            let ruleResult = null;

            for (const rule of rulesList) {
                const ruleOutput = rule(key, sourceValue, targetValue, source, target);

                if (ruleOutput.skip === true) {
                    skipProperty = true;
                    break;
                }

                if (ruleOutput.hasOwnProperty('result')) {
                    ruleResult = ruleOutput.result;
                    break;
                }

                if (ruleOutput.continue === true) {
                    continue;
                }
            }

            if (skipProperty) {
                continue;
            }

            if (ruleResult === false) {
                return false;
            }
        }
    }

    return true;
}
/**
 * Создает функцию сравнения с замыканием
 *
 * @param {Array<string>} ruleNames - Массив имен правил для использования
 * @param {Array<Function>} customRules - Массив пользовательских функций-правил
 * @returns {Function} - Функция для сравнения объектов
 *
 * Подробнее: эта функция использует концепцию "замыкания" (closure),
 * чтобы создать настраиваемую функцию сравнения с предварительно заданными правилами.
 * Это позволяет повторно использовать одни и те же настройки сравнения без их
 * повторного определения.
 */
function createComparison(ruleNames, customRules = []) {
    return (source, target) => {
        const rulesList = [
            ...ruleNames.map(ruleName => {
                if (ruleName === 'skipNonExistentSourceFields') {
                    return rules[ruleName](source);
                }
                return rules[ruleName]();
            }),
            ...customRules
        ];

        return compare(source, target, rulesList);
    };
}

export {
    compare,
    rules,
    defaultRules,
    createComparison
};