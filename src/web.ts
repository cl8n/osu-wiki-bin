import { get } from 'https';

// TODO types

export async function groupMembers(groupId: number): Promise<any> {
    const data = await new Promise<string>((resolve, reject) => {
        get(`https://osu.ppy.sh/groups/${groupId}?sort=username`, (res) => {
            let data = '';

            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        })
            .on('error', (error) => reject(error.message));
    });

    const scriptStart = '<script id="json-users" type="application/json">';
    const scriptEnd = '</script>';
    const scriptIndex = data.indexOf(scriptStart) + scriptStart.length;
    const script = data.slice(scriptIndex, data.indexOf(scriptEnd, scriptIndex));

    return JSON.parse(script);
}

export async function scrapeUser(userId: string): Promise<any> {
    const url = `https://osu.ppy.sh/users/${userId}`;
    const data = await new Promise<string>((resolve, reject) => {
        get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err.message));
    });

    const json = data.match(/<script id="json-user" type="application\/json">\s*({.+?})\s*<\/script>/)![1];
    return JSON.parse(json);
}
