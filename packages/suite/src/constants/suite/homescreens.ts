import { DeviceModelInternal } from '@trezor/connect';

// original trezor images has to be first as they are send to device as '0' and the default image from fw is used
export const getHomescreens = (isBitcoinOnlyFirmware: boolean) => ({
    [DeviceModelInternal.T1B1]: [
        'original_t1b1', // note - has to be first
        'blank',
        'circleweb',
        'circuit',
        'starweb',
        'stars',
        'bitcoin_b2',
        'bitcoin_shade',
        'bitcoin_b',
        'bitcoin_full',
        'bitcat',
        'nyancat',
        'coffee',
        'flower',
        'saturn',
        'jupiter',
        'einstein',
        'piggy',
        'honeybadger',
        'dragon',
        'narwal',
        'rabbit',
        'bunny',
        'rooster',
        'fancy',
        'genesis',
        'my_bank',
        'candle',
        'ancap',
        'anonymous',
        'mushroom',
        'invader',
        'mtgox',
        'electrum',
        'mycelium',
        'multibit',
        'reddit',
        'hacker',
        'polis',
        'carlos',
    ],
    [DeviceModelInternal.T2B1]: [
        'original_t2b1', // note - has to be first
        'blank',
        'circleweb',
        'circuit',
        'jupiter',
        'saturn',
        'starweb',
    ],
    [DeviceModelInternal.T2T1]: [
        'original_t2t1', // note - has to be first
        'trezor-3d',
        'pigeon',
        'smile-1',
        'stain-1',
        'stain-2',
        'stain-3',
        'smile-2',
    ],
    [DeviceModelInternal.T3T1]: [
        isBitcoinOnlyFirmware ? 'orange' : 'green',
        'gradient',
        isBitcoinOnlyFirmware ? 'green' : 'orange',
        'solid',
        'smile-2',
    ],
});
