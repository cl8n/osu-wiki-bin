import { promises as fsPromises } from 'fs';
const { readdir, stat } = fsPromises;
import { join } from 'path';

export async function getFiles(paths: string[], extension?: string): Promise<string[]> {
    let files: string[] = [];

    for (const path of paths) {
        if ((await stat(path)).isFile()) {
            files.push(path);
            continue;
        }

        const dirents = await readdir(path, { withFileTypes: true });

        files = files.concat(...await Promise.all(dirents.map((dirent) => {
            const res = join(path, dirent.name);

            if (dirent.isDirectory() && dirent.name === 'node_modules')
                return [];

            return dirent.isDirectory() ? getFiles([res]) : [res];
        })));
    }

    files = files.filter((file) => file != null);

    if (extension != null)
        files = files.filter((file) => file.endsWith(`.${extension}`));

    return files;
}
