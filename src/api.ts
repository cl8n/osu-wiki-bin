import type { Dictionary } from '@cl8n/types';
import { get } from 'https';
import { linkName } from './game-mode';
import { md } from './text';
import { config } from './wiki';

interface UserLinkOptionsBase {
    byName?: boolean;
    flag?: boolean;
}

interface UserLinkOptions extends UserLinkOptionsBase {
    returnObj?: false;
}

interface UserLinkOptionsRO extends UserLinkOptionsBase {
    returnObj: true;
}

// TODO: typing kinda sucks

function osuApi(endpoint: string, params: Dictionary<string>): Promise<any> {
    let url = `https://osu.ppy.sh/api/${endpoint}?k=${config('osuApiKey')}`;
    Object.keys(params).forEach(k => url += `&${k}=${params[k]}`);

    return new Promise((resolve, reject) => {
        get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', err => reject(err.message));
    });
}

const usersById: Dictionary<object[]> = {};
const usersByName: Dictionary<object[]> = {};

export async function userLink(userId: string, options?: UserLinkOptions): Promise<string>;
export async function userLink(userId: string, options: UserLinkOptionsRO): Promise<object>;
export async function userLink(userId: string, options?: UserLinkOptions | UserLinkOptionsRO): Promise<object | string> {
    const filledOptions = {
        byName: false,
        flag: true,
        returnObj: false,
        ...options,
    };

    const nullUser = {
        user_id: filledOptions.byName ? 0 : userId,
        username: filledOptions.byName ? userId : '<null>',
        country: '__'
    };

    const cachedUser = filledOptions.byName ? usersByName[userId] : usersById[userId];
    const user = cachedUser != null
        ? cachedUser
        : await osuApi('get_user', {
            type: filledOptions.byName ? 'string' : 'id',
            u: userId
        });

    if (user.length === 0) {
        if (filledOptions.returnObj)
            return nullUser;

        console.error(`User not found: ${userId}`);
        user.push(nullUser);
    }

    if (user[0].country == null || user[0].country === '' || user[0].country === 'XX')
        user[0].country = '__';

    usersById[user[0].user_id] = user;
    usersByName[user[0].username] = user;

    if (filledOptions.returnObj)
        return user[0];
    else
        return (filledOptions.flag ? `::{ flag=${user[0].country} }:: ` : '') + `[${md(user[0].username)}](https://osu.ppy.sh/users/${user[0].user_id})`;
}

export async function beatmapLink(beatmapId: string): Promise<string> {
    const nullBeatmap = {
        artist: '<null>',
        beatmap_id: 0,
        beatmapset_id: 0,
        creator: '<null>',
        mode: 0,
        title: '<null>',
        version: '<null>'
    };

    const beatmap = await osuApi('get_beatmaps', {
        b: beatmapId
    });

    if (beatmap.length === 0) {
        console.error(`Beatmap not found: ${beatmapId}`);
        beatmap.push(nullBeatmap);
    }

    return `[${md(beatmap[0].artist)} - ${md(beatmap[0].title)} (${md(beatmap[0].creator)}) [${md(beatmap[0].version)}]](https://osu.ppy.sh/beatmapsets/${beatmap[0].beatmapset_id}#${linkName(beatmap[0].mode)}/${beatmap[0].beatmap_id})`;
}

export async function beatmapsetLink(beatmapsetId: string): Promise<string> {
    const nullBeatmap = {
        artist: '<null>',
        beatmap_id: 0,
        beatmapset_id: 0,
        creator: '<null>',
        mode: 0,
        title: '<null>',
        version: '<null>'
    };

    const beatmap = await osuApi('get_beatmaps', {
        s: beatmapsetId
    });

    if (beatmap.length === 0) {
        console.error(`Beatmap not found: ${beatmapsetId}`);
        beatmap.push(nullBeatmap);
    }

    return `[${md(beatmap[0].artist)} - ${md(beatmap[0].title)}](https://osu.ppy.sh/beatmapsets/${beatmap[0].beatmapset_id})`;
}
