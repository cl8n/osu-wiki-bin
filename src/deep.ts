export type NestedKeyFor<T, V = boolean | number | string | null | undefined> =
    keyof T extends string
    ? {
        [K in keyof Required<T>]: T[K] extends V ? K : `${K}.${NestedKeyFor<T[K], V>}`;
    }[keyof T]
    : never;

type NestedScopesFor<T> =
    keyof T extends string
    ? {
        [K in keyof Required<T>]: T[K] extends boolean | number | string | null | undefined
            ? never
            : K | `${K}.${NestedScopesFor<T[K]>}`;
    }[keyof T]
    : never;

type TryKey<T, K> = K extends keyof T ? K : never;

type NestedProperty<T, K extends string> =
    K extends `${infer Part}.${infer Rest}`
        ? NestedProperty<T[TryKey<T, Part>], Rest>
        : T[TryKey<T, K>];

type FlattenedEntries<T> = {
    [K in NestedKeyFor<T>]: [K, NestedProperty<T, K>];
}[NestedKeyFor<T>][];

type FlattenStackFrame = {
    keys: string[];
    prefix: string;
};

export function flattenedEntries<T>(object: T): FlattenedEntries<T> {
    const entries: [any, any][] = [];
    const stack: FlattenStackFrame[] = [{ keys: Object.keys(object), prefix: '' }];
    let frame: FlattenStackFrame | undefined;
    let key: string | undefined;

    while ((frame = stack.pop()) != null) {
        while ((key = frame.keys.pop()) != null) {
            const fullKey: any = frame.prefix + key;
            const value: any = nestedProperty(object, fullKey);

            if (value == null || typeof value !== 'object') {
                entries.push([fullKey, value]);
            } else {
                stack.push({
                    keys: Object.keys(value),
                    prefix: fullKey + '.',
                });
            }
        }
    }

    return entries;
}

export function getKey<T, V>(object: T, value: V, scope: NestedScopesFor<T> | '' = ''): NestedKeyFor<T, V> | undefined {
    const entry: any = flattenedEntries(object)
        .find((entry) =>
            entry[0].startsWith(scope) && (
                typeof entry[1] === 'string' && typeof value === 'string'
                    ? entry[1].toLowerCase() === value.toLowerCase()
                    : (entry[1] as unknown) === value
            )
        );

    return entry && entry[0];
}

export function nestedProperty<T, K extends string>(object: T, property: K): NestedProperty<T, K> extends never ? undefined : NestedProperty<T, K> {
    const keys = property.split('.');
    let value: any = object;

    for (let i = 0; i < keys.length && value != null; i++)
        value = value[keys[i]];

    return value;
}
