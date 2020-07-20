require('colors');
const { readdirSync } = require('fs');
const { join } = require('path');
const { getRedirects } = require('./include');

// TODO: can save a lot of filesystem lookups here

function wikiDirectoryExists(name) {
    const nameParts = name.split('/');
    let currentDir = join(__dirname, '../wiki');

    for (const namePart of nameParts) {
        const dirEnts = readdirSync(currentDir, { withFileTypes: true });
        const dirEnt = dirEnts.find(d => d.isDirectory && d.name.toLowerCase() === namePart.toLowerCase());

        if (dirEnt === undefined)
            return false;
        else
            currentDir = join(currentDir, dirEnt.name);
    }

    return true;
}

function run() {
    for (const redirect of Object.keys(getRedirects()))
        if (wikiDirectoryExists(redirect))
            console.log(redirect.red);
}

module.exports = { run };
