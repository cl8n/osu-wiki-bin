export function md(text: string): string {
    return text.replace(/[_\[\]\(\)*~\\]/g, '\\$&');
}
