import { Descriptor } from '@trezor/transport/src/types';

interface DeviceProps {
    device: Descriptor;
}

export const Device = ({ device }: DeviceProps) => {
    const modelName = (() => {
        switch (device.type) {
            case 0:
                return 'Trezor One (HID)';
            case 1:
                return 'Trezor One (WebUSB)';
            case 2:
                return 'Trezor One (WebUSB Bootloader)';
            case 3:
                return 'Trezor model T/R';
            case 4:
                return 'Trezor model T/R Bootloader';
            case 5:
                return 'Emulator';
        }
    })();

    return (
        <div>
            {/* I am inclined not to translate model, path and session */}
            <div>model: {modelName}</div>
            <div>path: {device.path}</div>
            <div>session: {device.session ? device.session : 'none'}</div>
        </div>
    );
};
