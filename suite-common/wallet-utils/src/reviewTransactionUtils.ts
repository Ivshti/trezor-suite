import { fromWei, toWei } from 'web3-utils';

import { CardanoOutput } from '@trezor/connect';
import { getFirmwareVersion } from '@trezor/device-utils';
import { versionUtils } from '@trezor/utils';
import {
    Account,
    FormState,
    GeneralPrecomposedTransactionFinal,
    ReviewOutputState,
} from '@suite-common/wallet-types';
import { StakeFormState, ReviewOutput } from '@suite-common/wallet-types';
import { TrezorDevice } from '@suite-common/suite-types';

import { getShortFingerprint, isCardanoTx } from './cardanoUtils';

export const getTransactionReviewOutputState = (
    index: number,
    buttonRequestsCount: number,
): ReviewOutputState => {
    if (index === buttonRequestsCount - 1) return 'active';
    if (index < buttonRequestsCount - 1) return 'success';

    return undefined;
};

export const getIsUpdatedSendFlow = (device: TrezorDevice) => {
    const firmwareVersion = getFirmwareVersion(device);

    return versionUtils.isNewerOrEqual(firmwareVersion, '2.6.0');
};

export const getIsUpdatedEthereumSendFlow = (
    device: TrezorDevice,
    network: Account['networkType'],
) => {
    if (network !== 'ethereum') return false;

    const firmwareVersion = getFirmwareVersion(device);

    // publicly introduced in 2.6.3, versions 2.6.1 and 2.6.2 were internal
    return versionUtils.isNewer(firmwareVersion, '2.6.0');
};

const getCardanoTokenBundle = (account: Account, output: CardanoOutput) => {
    // Transforms cardano's tokenBundle into outputs, 1 output per one token
    // since suite supports only 1 token per output it will return just one item
    if (!output.tokenBundle || output.tokenBundle.length === 0 || 'addressParameters' in output)
        return undefined;

    if (account.tokens) {
        return output.tokenBundle
            .map(policyGroup =>
                policyGroup.tokenAmounts.map(token => {
                    const accountToken = account.tokens!.find(
                        currentToken =>
                            currentToken.contract ===
                            `${policyGroup.policyId}${token.assetNameBytes}`,
                    );
                    if (!accountToken) return;

                    const fingerprint = accountToken.name
                        ? getShortFingerprint(accountToken.name)
                        : undefined;

                    return {
                        type: 'cardano',
                        contract: output.address,
                        balance: token.amount,
                        symbol: token.assetNameBytes
                            ? Buffer.from(token.assetNameBytes, 'hex').toString('utf8')
                            : fingerprint,
                        decimals: accountToken.decimals,
                    };
                }),
            )
            .flat();
    }
};

type ConstructOutputsParams = {
    precomposedTx: GeneralPrecomposedTransactionFinal;
    decreaseOutputId: number | undefined;
    account: Account;
    precomposedForm: FormState | StakeFormState;
};

const constructOldFlow = ({
    precomposedTx,
    decreaseOutputId,
    account,
    precomposedForm,
}: ConstructOutputsParams) => {
    const outputs: ReviewOutput[] = [];

    const isCardano = isCardanoTx(account, precomposedTx);
    const { networkType } = account;

    const hasBitcoinLockTime = 'bitcoinLockTime' in precomposedForm;
    const hasRippleDestinationTag = 'rippleDestinationTag' in precomposedForm;

    // used in the bumb fee flow
    if (typeof precomposedTx.useNativeRbf === 'boolean' && precomposedTx.useNativeRbf) {
        outputs.push(
            {
                type: 'txid',
                value: precomposedTx.prevTxid!,
            },
            {
                type: 'fee-replace',
                value: precomposedTx.feeDifference,
                value2: precomposedTx.fee,
            },
        );

        // add decrease output confirmation step between txid and fee
        if (typeof decreaseOutputId === 'number') {
            outputs.splice(1, 0, {
                type: 'reduce-output',
                label: precomposedTx.outputs[decreaseOutputId].address!,
                value: precomposedTx.feeDifference,
                value2: precomposedTx.outputs[decreaseOutputId].amount.toString(),
            });
        }
    } else if (isCardano) {
        precomposedTx.outputs.forEach(o => {
            // iterate only through "external" outputs (change output has addressParameters field instead of address)
            if ('address' in o) {
                const tokenBundle = getCardanoTokenBundle(account, o)?.[0]; // send form supports one token per output

                // each output will include certain amount of ADA (cardano token outputs require ADA)
                outputs.push({
                    type: 'regular_legacy',
                    value: o.address,
                });

                // if the output also includes a token then we need to render another row with the token
                if (tokenBundle) {
                    outputs.push({
                        type: 'regular_legacy',
                        label: o.address,
                        value: tokenBundle.balance ?? '0',
                        token: tokenBundle,
                    });
                }
            }
        });
    } else {
        precomposedTx.outputs.forEach(o => {
            if (typeof o.address === 'string') {
                outputs.push({
                    type: 'regular_legacy',
                    value: o.address,
                });
            } else if (o.script_type === 'PAYTOOPRETURN') {
                outputs.push({
                    type: 'opreturn',
                    value: o.op_return_data,
                });
            }
        });
    }

    if (hasBitcoinLockTime && precomposedForm.bitcoinLockTime) {
        outputs.push({ type: 'locktime', value: precomposedForm.bitcoinLockTime });
    }

    if (precomposedForm.ethereumDataHex && !precomposedTx.token) {
        outputs.push({ type: 'data', value: precomposedForm.ethereumDataHex });
    }

    if (networkType === 'ripple') {
        // ripple displays requests on device in different order:
        // 1. destination tag
        // 2. fee
        // 3. output
        outputs.unshift({ type: 'fee', value: precomposedTx.fee });
        if (hasRippleDestinationTag && precomposedForm.rippleDestinationTag) {
            outputs.unshift({
                type: 'destination-tag',
                value: precomposedForm.rippleDestinationTag,
            });
        }
    } else if (!precomposedTx.useNativeRbf) {
        outputs.push({ type: 'fee', value: precomposedTx.fee });
    }

    return outputs;
};

const constructNewFlow = ({
    precomposedTx,
    decreaseOutputId,
    account,
    precomposedForm,
    isUpdatedEthereumSendFlow,
}: ConstructOutputsParams & { isUpdatedEthereumSendFlow: boolean }) => {
    const outputs: ReviewOutput[] = [];

    const isCardano = isCardanoTx(account, precomposedTx);
    const isSolana = account.networkType === 'solana';
    const { networkType } = account;

    const hasBitcoinLockTime = 'bitcoinLockTime' in precomposedForm;
    const hasRippleDestinationTag = 'rippleDestinationTag' in precomposedForm;

    if (precomposedForm.ethereumDataHex && !precomposedTx.token) {
        outputs.push({ type: 'data', value: precomposedForm.ethereumDataHex });
    }

    // used in the bump fee flow
    if (typeof precomposedTx.useNativeRbf === 'boolean' && precomposedTx.useNativeRbf) {
        outputs.push(
            {
                type: 'txid',
                value: precomposedTx.prevTxid!,
            },
            {
                type: 'fee-replace',
                value: precomposedTx.feeDifference,
                value2: precomposedTx.fee,
            },
        );

        // add decrease output confirmation step between txid and fee
        if (typeof decreaseOutputId === 'number') {
            outputs.splice(1, 0, {
                type: 'reduce-output',
                label: precomposedTx.outputs[decreaseOutputId].address!,
                value: precomposedTx.feeDifference,
                value2: precomposedTx.outputs[decreaseOutputId].amount.toString(),
            });
        }
    } else if (isCardano) {
        precomposedTx.outputs.forEach(o => {
            // iterate only through "external" outputs (change output has addressParameters field instead of address)
            if ('address' in o) {
                const tokenBundle = getCardanoTokenBundle(account, o)?.[0]; // send form supports one token per output

                // each output will include certain amount of ADA (cardano token outputs require ADA)
                outputs.push({
                    type: 'regular_legacy',
                    value: o.address,
                });

                // if the output also includes a token then we need to render another row with the token
                if (tokenBundle) {
                    outputs.push({
                        type: 'regular_legacy',
                        label: o.address,
                        value: tokenBundle.balance ?? '0',
                        token: tokenBundle,
                    });
                }
            }
        });
    } else {
        precomposedTx.outputs.forEach(o => {
            if (typeof o.address === 'string') {
                const tokenOutput: ReviewOutput = {
                    type: 'contract',
                    value: precomposedTx.token ? precomposedTx.token.contract : '',
                };

                // this is displayed only for tokens without definitions
                if (precomposedTx.token && !precomposedTx.isTokenKnown && !isSolana) {
                    outputs.push(tokenOutput);
                }

                outputs.push({ type: 'address', value: o.address });
                if (!isSolana && !isUpdatedEthereumSendFlow) {
                    outputs.push({
                        type: 'amount',
                        value: o.amount.toString(),
                        token: precomposedTx.token,
                    });
                }

                // Solana tokens are displayed *after* the address
                if (precomposedTx.token && !precomposedTx.isTokenKnown && isSolana) {
                    outputs.push(tokenOutput);
                }
            } else if (o.script_type === 'PAYTOOPRETURN') {
                outputs.push({
                    type: 'opreturn',
                    value: o.op_return_data,
                });
            }
        });
    }

    if (networkType === 'ethereum' && !isUpdatedEthereumSendFlow) {
        // device shows ether, precomposedTx.feePerByte is in gwei
        const wei = toWei(precomposedTx.feePerByte, 'gwei'); // from gwei to wei
        const ether = fromWei(wei, 'ether'); // from wei to ether

        outputs.push({
            type: 'gas',
            value: ether,
        });
    }

    if (hasBitcoinLockTime && precomposedForm.bitcoinLockTime) {
        outputs.push({ type: 'locktime', value: precomposedForm.bitcoinLockTime });
    }

    if (
        networkType === 'ripple' &&
        hasRippleDestinationTag &&
        precomposedForm.rippleDestinationTag
    ) {
        outputs.unshift({
            type: 'destination-tag',
            value: precomposedForm.rippleDestinationTag,
        });
    }

    return outputs;
};

export const constructTransactionReviewOutputs = ({
    device,
    ...params
}: ConstructOutputsParams & { device: TrezorDevice }) => {
    const isUpdatedSendFlow = getIsUpdatedSendFlow(device); // >= 2.6.0
    const isUpdatedEthereumSendFlow = getIsUpdatedEthereumSendFlow(
        device,
        params.account.networkType,
    ); // > 2.6.0 && isEthereum

    if (!isUpdatedSendFlow) {
        return constructOldFlow(params);
    }

    return constructNewFlow({ isUpdatedEthereumSendFlow, ...params });
};
