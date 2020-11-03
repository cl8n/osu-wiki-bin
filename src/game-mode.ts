const linkNames = ['osu', 'taiko', 'fruits', 'mania'] as const;
const longNames = ['osu!standard', 'osu!taiko', 'osu!catch', 'osu!mania'] as const;
const shortNames = ['osu', 'taiko', 'catch', 'mania'] as const;

// TODO: Stricter typing
export class GameMode {
    private _mode: number;

    constructor(mode: number | string) {
        if (typeof mode === 'number') {
            if (!Number.isInteger(mode) || mode < 0 || mode > 3) {
                throw new RangeError('The provided mode is not valid');
            }

            this._mode = mode;
        } else {
            switch (mode.toLowerCase().trim()) {
                case '0':
                case 'osu':
                case 'osu!':
                case 'osu!standard':
                case 'osu!std':
                case 'standard':
                case 'std':
                    this._mode = 0;
                    break;
                case '1':
                case 'osu!taiko':
                case 'taiko':
                    this._mode = 1;
                    break;
                case '2':
                case 'catch':
                case 'catch the beat':
                case 'ctb':
                case 'fruits':
                case 'osu!catch':
                case 'osu!ctb':
                    this._mode = 2;
                    break;
                case '3':
                case 'mania':
                case 'osu!mania':
                    this._mode = 3;
                    break;
                default:
                    throw new RangeError('The provided mode is not valid');
            }
        }
    }

    get integer() {
        return this._mode;
    }

    get linkName() {
        return linkNames[this._mode];
    }

    get longName() {
        return longNames[this._mode];
    }

    get shortName() {
        return shortNames[this._mode];
    }
}

export const gameModes = [0, 1, 2, 3].map((mode) => new GameMode(mode));

export function linkName(mode: number | string) { return new GameMode(mode).linkName; }
export function longName(mode: number | string) { return new GameMode(mode).longName; }
export function shortName(mode: number | string) { return new GameMode(mode).shortName; }
