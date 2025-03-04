import * as crypto from 'crypto';
import * as base58check from 'bs58check';
import { FetchIntervalTrackingId } from 'src/actions/suite/metadataProviderActions';
import { DataType, MetadataProvider } from '@suite-common/metadata-types';
import { TrezorDevice } from '@suite-common/suite-types';

// note we only need base58 conversion fn from base58check, other functions from there might
// be supplemented from crypto module

const CIPHER_TYPE = 'aes-256-gcm';
const CIPHER_IVSIZE = 96 / 8;
const AUTH_SIZE = 128 / 8;

export const deriveMetadataKey = (masterKey: string, xpub: string) => {
    const hmac = crypto.createHmac('sha256', Buffer.from(masterKey, 'hex'));
    hmac.update(xpub);
    const hash = hmac.digest();

    return base58check.encode(hash);
};

const deriveHmac = (metadataKey: string) => {
    const hmac = crypto.createHmac('sha512', metadataKey);
    const buf = Buffer.from('0123456789abcdeffedcba9876543210', 'hex');
    hmac.update(buf);

    return hmac.digest();
};

export const deriveAesKey = (metadataKey: string) => {
    const hash = deriveHmac(metadataKey);
    if (hash.length !== 64 && Buffer.byteLength(hash) !== 64) {
        throw new Error(
            `Strange buffer length when deriving account hmac ${hash.length} ; ${Buffer.byteLength(
                hash,
            )}`,
        );
    }
    const secondHalf = hash.subarray(32, 64);

    return secondHalf.toString('hex');
};

export const deriveFilename = (metadataKey: string) => {
    const hash = deriveHmac(metadataKey);
    const firstHalf = hash.subarray(0, 32);

    return firstHalf.toString('hex');
};

export const deriveFilenameForLabeling = (metaKey: string, encryptionVersion: number) => {
    const name = deriveFilename(metaKey);
    // postfixes were added with version 2
    const postfix = encryptionVersion > 1 ? `_v${encryptionVersion}` : '';
    const extension = '.mtdt';

    return `${name}${postfix}${extension}`;
};

const getRandomIv = (): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        try {
            crypto.randomBytes(CIPHER_IVSIZE, (err, buf) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(buf);
                }
            });
        } catch (err) {
            reject(err);
        }
    });

export const arrayBufferToBuffer = (ab: ArrayBuffer) => {
    const buffer = Buffer.alloc(ab.byteLength);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }

    return buffer;
};

export const encrypt = async (input: Record<string, any> | string, aesKey: string | Buffer) => {
    if (typeof aesKey === 'string') {
        aesKey = Buffer.from(aesKey, 'hex');
    }
    const iv = await getRandomIv();
    const stringified = JSON.stringify(input);
    const buffer = Buffer.from(stringified, 'utf8');
    const cipher = crypto.createCipheriv(CIPHER_TYPE, aesKey, iv);
    const startCText = cipher.update(buffer);
    const endCText = cipher.final();
    // tag is always 128-bits
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, startCText, endCText]);
};

export const decrypt = (input: Buffer, key: string | Buffer) => {
    if (typeof key === 'string') {
        key = Buffer.from(key, 'hex');
    }

    const iv = input.subarray(0, CIPHER_IVSIZE);
    // tag is always 128-bits
    const authTag = input.subarray(CIPHER_IVSIZE, CIPHER_IVSIZE + AUTH_SIZE);
    const cText = input.subarray(CIPHER_IVSIZE + AUTH_SIZE);
    const decipher = crypto.createDecipheriv(CIPHER_TYPE, key, iv);
    const start = decipher.update(cText);

    // throws when tampered
    decipher.setAuthTag(authTag);
    const end = decipher.final();

    const res = Buffer.concat([start, end]);
    const stringified = res.toString('utf8');

    return JSON.parse(stringified);
};

/**
 * parse object from url hash params string
 */
export const urlHashParams = (hash: string) => {
    const result: { [param: string]: string } = {};
    if (!hash) return result;
    if (hash[0] === '#') {
        hash = hash.substring(1, hash.length);
    }
    const parts = hash.split('&');
    parts.forEach(part => {
        const [key, value] = part.split('=');
        result[key] = decodeURIComponent(value);
    });

    return result;
};

/**
 * parse object from url search params string
 */
export const urlSearchParams = (search: string) => {
    if (search[0] === '?') {
        search = search.substring(1);
    }

    return urlHashParams(search);
};

export const getFetchTrackingId = (
    dataType: DataType,
    clientId: MetadataProvider['clientId'],
    deviceState: Required<TrezorDevice>['state'],
): FetchIntervalTrackingId => {
    return `${dataType}-${clientId}-${deviceState}`;
};
