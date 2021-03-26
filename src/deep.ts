import { DeepDictionary } from "@cl8n/types";

// TODO: typing
export function nestedProperty(object: DeepDictionary<unknown>, property: string): any {
    const keys = property.split('.');
    let value: any = object;

    for (let i = 0; i < keys.length && value != null; i++)
        value = value[keys[i]];

    return value;
}
