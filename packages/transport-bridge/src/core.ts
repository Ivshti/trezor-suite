import { WebUSB } from 'usb';

import { v1 as protocolV1, bridge as protocolBridge } from '@trezor/protocol';
import { receive as receiveUtil } from '@trezor/transport/src/utils/receive';
import { createChunks } from '@trezor/transport/src/utils/send';
import { SessionsBackground } from '@trezor/transport/src/sessions/background';
import { SessionsClient } from '@trezor/transport/src/sessions/client';
import { UsbApi } from '@trezor/transport/src/api/usb';
import { UdpApi } from '@trezor/transport/src/api/udp';
import { AcquireInput, ReleaseInput } from '@trezor/transport/src/transports/abstract';
import { Session } from '@trezor/transport/src/types';
import { Log } from '@trezor/utils';
import { AbstractApi } from '@trezor/transport/src/api/abstract';

export const createApi = (apiArg: 'usb' | 'udp' | AbstractApi, logger?: Log) => {
    let api: AbstractApi;

    const abortController = new AbortController();
    const sessionsBackground = new SessionsBackground({ signal: abortController.signal });

    const sessionsClient = new SessionsClient({
        requestFn: args => sessionsBackground.handleMessage(args),
        registerBackgroundCallbacks: () => {},
    });

    sessionsBackground.on('descriptors', descriptors => {
        sessionsClient.emit('descriptors', descriptors);
    });

    if (typeof apiArg === 'string') {
        api =
            apiArg === 'udp'
                ? new UdpApi({ logger })
                : new UsbApi({
                      logger,
                      usbInterface: new WebUSB({
                          allowAllDevices: true, // return all devices, not only authorized
                      }),

                      // todo: possibly only for windows
                      forceReadSerialOnConnect: true,
                  });
    } else {
        api = apiArg;
    }

    api.listen();

    // whenever low-level api reports changes to descriptors, report them to sessions module
    api.on('transport-interface-change', descriptors => {
        logger?.debug(`core: transport-interface-change ${JSON.stringify(descriptors)}`);
        sessionsClient.enumerateDone({ descriptors });
    });

    const writeUtil = async ({
        path,
        data,
        signal,
    }: {
        path: string;
        data: string;
        signal: AbortSignal;
    }) => {
        const { messageType, payload } = protocolBridge.decode(
            new Uint8Array(Buffer.from(data, 'hex')),
        );

        const encodedMessage = protocolV1.encode(payload, { messageType });
        const buffers = createChunks(
            encodedMessage,
            protocolV1.getChunkHeader(encodedMessage),
            api.chunkSize,
        );

        for (let i = 0; i < buffers.length; i++) {
            const bufferSegment = buffers[i];

            const result = await api.write(path, bufferSegment, signal);
            if (!result.success) {
                return result;
            }
        }

        return { success: true as const };
    };

    const readUtil = async ({ path, signal }: { path: string; signal: AbortSignal }) => {
        try {
            const { messageType, payload } = await receiveUtil(() => {
                logger?.debug(`core: readUtil: api.read: reading next chunk`);

                return api.read(path, signal).then(result => {
                    if (result.success) {
                        logger?.debug(
                            `core: readUtil partial result: byteLength: ${result.payload.byteLength}`,
                        );

                        return result.payload;
                    }
                    logger?.debug(`core: readUtil partial result: error: ${result.error}`);
                    throw new Error(result.error);
                });
            }, protocolV1);

            logger?.debug(
                `core: readUtil result: messageType: ${messageType} byteLength: ${payload?.byteLength}`,
            );

            return {
                success: true as const,
                payload: protocolBridge.encode(payload, { messageType }).toString('hex'),
            };
        } catch (err) {
            logger?.debug(`core: readUtil catch: ${err.message}`);

            return { success: false as const, error: err.message as string };
        }
    };

    const enumerate = async ({ signal }: { signal: AbortSignal }) => {
        const enumerateResult = await api.enumerate(signal);

        if (!enumerateResult.success) {
            return enumerateResult;
        }

        const enumerateDoneResponse = await sessionsClient.enumerateDone({
            descriptors: enumerateResult.payload,
        });

        return enumerateDoneResponse;
    };

    const acquire = async (
        acquireInput: Omit<AcquireInput, 'previous'> & {
            previous: Session | 'null';
            signal: AbortSignal;
        },
    ) => {
        const acquireIntentResult = await sessionsClient.acquireIntent({
            path: acquireInput.path,
            previous: acquireInput.previous === 'null' ? null : acquireInput.previous,
        });
        if (!acquireIntentResult.success) {
            return acquireIntentResult;
        }

        const openDeviceResult = await api.openDevice(acquireInput.path, true, acquireInput.signal);
        logger?.debug(`core: openDevice: result: ${JSON.stringify(openDeviceResult)}`);

        if (!openDeviceResult.success) {
            return openDeviceResult;
        }
        await sessionsClient.acquireDone({ path: acquireInput.path });

        return acquireIntentResult;
    };

    const release = async ({ session }: Omit<ReleaseInput, 'path'>) => {
        await sessionsClient.releaseIntent({ session });

        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }

        const closeRes = await api.closeDevice(sessionsResult.payload.path);

        if (!closeRes.success) {
            logger?.error(`core: release: api.closeDevice error: ${closeRes.error}`);
        }

        return sessionsClient.releaseDone({ path: sessionsResult.payload.path });
    };

    const call = async ({
        session,
        data,
        signal,
    }: {
        session: Session;
        data: string;
        signal: AbortSignal;
    }) => {
        logger?.debug(`core: call: session: ${session}`);

        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });
        if (!sessionsResult.success) {
            logger?.error(`core: call: retrieving path error: ${sessionsResult.error}`);

            return sessionsResult;
        }
        const { path } = sessionsResult.payload;
        logger?.debug(`core: call: retrieved path ${path} for session ${session}`);

        const openResult = await api.openDevice(path, false, signal);

        if (!openResult.success) {
            logger?.error(`core: call: api.openDevice error: ${openResult.error}`);

            return openResult;
        }
        logger?.debug(`core: call: api.openDevice done`);

        logger?.debug('core: call: writeUtil');
        const writeResult = await writeUtil({ path, data, signal });
        if (!writeResult.success) {
            logger?.error(`core: call: writeUtil ${writeResult.error}`);

            return writeResult;
        }
        logger?.debug('core: call: readUtil');

        return readUtil({ path, signal });
    };

    const send = async ({
        session,
        data,
        signal,
    }: {
        session: Session;
        data: string;
        signal: AbortSignal;
    }) => {
        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }
        const { path } = sessionsResult.payload;

        const openResult = await api.openDevice(path, false, signal);
        if (!openResult.success) {
            return openResult;
        }

        return writeUtil({ path, data, signal });
    };

    const receive = async ({ session, signal }: { session: Session; signal: AbortSignal }) => {
        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }
        const { path } = sessionsResult.payload;

        const openResult = await api.openDevice(path, false, signal);
        if (!openResult.success) {
            return openResult;
        }

        return readUtil({ path, signal });
    };

    const dispose = () => {
        api.dispose();
    };

    return {
        enumerate,
        acquire,
        release,
        call,
        send,
        receive,
        dispose,
        sessionsClient,
    };
};
