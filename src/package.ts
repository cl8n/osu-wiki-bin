interface PackageInfo {
    description: string;
    name: string;
    version: string;
}

export const packageInfo = require('../package.json') as PackageInfo;
