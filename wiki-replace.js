const { readFile, writeFile } = require('fs').promises;
const { beatmapLink, beatmapsetLink, userLink } = require('./include');

async function replace(file, flag) {
    let content = await readFile(file, 'utf8');

    for (const match of content.matchAll(/b#(\d+)/g))
        content = content.replace(match[0], await beatmapLink(match[1]));

    for (const match of content.matchAll(/s#(\d+)/g))
        content = content.replace(match[0], await beatmapsetLink(match[1]));

    for (const match of content.matchAll(/u#(\d+)|u!(.+?)!u/g)) {
        const byName = match[1] === undefined;
        content = content.replace(
            match[0],
            await userLink(match[byName ? 2 : 1], { byName, flag })
        );
    }

    await writeFile(file, content);
}

function run(options) {
    return Promise.all(options._.map(file => replace(file, !options['no-flags'])));
}

module.exports = {
    options: {
        f: '=no-flags',
        'no-flags': 'boolean'
    },
    run
};
