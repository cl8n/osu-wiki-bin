export function memoize<P extends unknown[], R extends unknown>(func: (...args: P) => R): (...args: P) => R {
  const cache = new Map<P[0], R>();

  return (...args) => {
    const key = args[0];

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args);

    cache.set(key, result);

    return result;
  };
}
