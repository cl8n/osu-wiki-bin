interface PackageInfo {
    description: string;
    version: string;
}

export const packageInfo = require('../package.json') as PackageInfo;
