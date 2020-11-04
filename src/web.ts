import { get } from 'https';

// TODO types

export async function groupMembers(groupId: string): Promise<string[]> {
    const userSearch = /","id":(\d+),"is_active":/g;
    const url = `https://osu.ppy.sh/groups/${groupId}?sort=username`;
    let data = await new Promise<string>((resolve, reject) => {
        get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err.message));
    });

    data = data.substring(data.indexOf('id="json-users"'));

    const userIds: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = userSearch.exec(data)) !== null)
        userIds.push(match[1]);

    return userIds;
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
