export function md(text: string): string {
    return text.replace(/[_\[\]\(\)*~\\]/g, '\\$&');
}

export function replaceLineEndings(content: string, ending: string = '\n') {
    const originalEndingMatch = content.match(/\r\n|\r|\n/);
    const originalEnding = originalEndingMatch == null ? undefined : originalEndingMatch[0];

    content = content.replace(/\r\n|\r|\n/g, ending);

    return { content, originalEnding };
}
