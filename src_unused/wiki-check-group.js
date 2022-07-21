const { readFileSync } = require('fs');
const { join } = require('path');
const request = require('request-promise-native');
const { qat_api_key } = require('./config.json');

async function run(options) {
    const groupFolder = {
        bn: 'Beatmap_Nominators',
        bng: 'Beatmap_Nominators'
    }[options.group];

    if (groupFolder == null) {
        console.error(`Invalid group. Available options are ${Object.keys(groupFolder).join(', ')}.`);
        return;
    }

    const file = readFileSync(join(__dirname, `../wiki/People/The_Team/${groupFolder}/en.md`), 'utf8');
    const userIdsLocal = [];
    const userSearch = /osu.ppy.sh\/users\/(\d+)/g;
    let match;
    while ((match = userSearch.exec(file)) !== null)
        userIdsLocal.push(match[1]);

    const users = JSON.parse(await request({
        uri: 'https://bn.mappersguild.com/interOp/users',
        headers: {
            'Qat-Signature': qat_api_key
        }
    }));
    console.log(users[0]);
    process.exit();

    const missingFromLocal = userIdsOnline.filter(x => !userIdsLocal.includes(x));
    const missingFromOnline = userIdsLocal.filter(x => !userIdsOnline.includes(x));

    console.log('Users missing from file:');
    for (const u of missingFromLocal) {
        const user = await userLink(u, { flag: false, returnObj: true });
        console.log(`    #${user.user_id.toString().padEnd(8)} ${user.username}`);
    }
    console.log('Users in file that are not in group:');
    for (const u of missingFromOnline) {
        const user = await userLink(u, { flag: false, returnObj: true });
        console.log(`    #${user.user_id.toString().padEnd(8)} ${user.username}`);
    }
}

async function checkGroup(group) {
    const file = loadGroup(group);

    const userIdsOnline = [];
    for (const groupId of groupMap[group]) {
        const members = await groupMembers(groupId);
        userIdsOnline.push(...members);
    }

    const userIdsLocal = [];
    const userSearch = /osu.ppy.sh\/users\/(\d+)/g;
    let match;
    while ((match = userSearch.exec(file)) !== null)
        userIdsLocal.push(match[1]);
}

module.exports = {
    options: {
        g: '=group', group: 'string'
    },
    run
};
