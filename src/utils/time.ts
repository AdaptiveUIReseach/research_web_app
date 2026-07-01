export const performanceNow = () => {
    if (typeof performance !== 'undefined' && performance.now) {
        return performance.now();
    }
    return Date.now();
};

export const clientTimestamp = () => {
    if (typeof performance !== 'undefined' && performance.timeOrigin) {
        return Math.round(performance.timeOrigin + performance.now());
    }
    return Date.now();
};
