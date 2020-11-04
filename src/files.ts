import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export async function getFiles(...paths: string[]): Promise<string[]> {
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

            return dirent.isDirectory() ? getFiles(res) : [res];
        })));
    }

    return files.filter((file) => file !== undefined);
}
