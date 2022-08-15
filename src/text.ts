export function md(text: string): string {
    return text.replace(/[_\[\]\(\)*~\\]/g, '\\$&');
}

interface LineEndingsInfo {
    content: string;
    originalEnding: string;
}

export function replaceLineEndings(content: string): LineEndingsInfo
export function replaceLineEndings(lineEndingsInfo: LineEndingsInfo): string
export function replaceLineEndings(contentOrLineEndingsInfo: string | LineEndingsInfo): string | LineEndingsInfo {
    if (typeof contentOrLineEndingsInfo === 'object') {
        return contentOrLineEndingsInfo.content.replaceAll('\n', contentOrLineEndingsInfo.originalEnding);
    }

    return {
        content: contentOrLineEndingsInfo.replaceAll(/\r\n|\r|\n/g, '\n'),
        originalEnding: contentOrLineEndingsInfo.match(/\r\n|\r|\n/)?.[0] ?? '\n',
    };
}
