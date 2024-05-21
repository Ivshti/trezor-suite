import { BigNumber } from '@trezor/utils/src/bigNumber';

import { Account, Rate, TokenAddress, RatesByKey } from '@suite-common/wallet-types';
import { TokenInfo } from '@trezor/connect';
import { getFiatRateKey } from '@suite-common/wallet-utils';
import { NetworkSymbol } from '@suite-common/wallet-config';
import { FiatCurrencyCode } from '@suite-common/suite-config';

interface TokensWithRates extends TokenInfo {
    fiatValue: BigNumber;
    fiatRate?: Rate;
}

// sort by 1. total fiat, 2. token price, 3. symbol length, 4. alphabetically
export const sortTokensWithRates = (a: TokensWithRates, b: TokensWithRates) => {
    const balanceSort =
        // Sort by balance multiplied by USD rate
        b.fiatValue.minus(a.fiatValue).toNumber() ||
        // If balance is equal, sort by USD rate
        (b.fiatRate?.rate || -1) - (a.fiatRate?.rate || -1) ||
        // If USD rate is equal or missing, sort by symbol length
        (a.symbol || '').length - (b.symbol || '').length ||
        // If symbol length is equal, sort by symbol name alphabetically
        (a.symbol || '').localeCompare(b.symbol || '');

    return balanceSort;
};

export const enhanceTokensWithRates = (
    tokens: Account['tokens'],
    fiatCurrency: FiatCurrencyCode,
    symbol: NetworkSymbol,
    rates?: RatesByKey,
) => {
    if (!tokens?.length) return [];

    const tokensWithRates = tokens.map(token => {
        const tokenFiatRateKey = getFiatRateKey(
            symbol,
            fiatCurrency,
            token.contract as TokenAddress,
        );
        const fiatRate = rates?.[tokenFiatRateKey];

        const fiatValue = new BigNumber(token.balance || 0).multipliedBy(fiatRate?.rate || 0);

        return {
            ...token,
            fiatRate,
            fiatValue,
        };
    });

    return tokensWithRates;
};

export const formatTokenSymbol = (symbol: string) => {
    const upperCasedSymbol = symbol.toUpperCase();
    const isTokenSymbolLong = upperCasedSymbol.length > 7;

    return isTokenSymbolLong ? `${upperCasedSymbol.slice(0, 7)}...` : upperCasedSymbol;
};

export const blurUrls = (text?: string): (string | JSX.Element)[] => {
    if (!text) return [];

    const urlRegex =
        /\b(?:https?:\/\/|www\.)[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+(?:\.[a-zA-Z]{2,})\b|[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/gi;

    const parts = text.split(urlRegex);

    const matches = [...text.matchAll(urlRegex)];

    const elements: (string | JSX.Element)[] = [];

    parts.forEach((part, index) => {
        elements.push(part);
        if (matches[index]) {
            elements.push(
                <StyledTooltip content={<Translation id="TR_URL_IN_TOKEN" />}>
                    <BlurWrapper key={index} $isBlurred>
                        {matches[index][0]}
                    </BlurWrapper>
                </StyledTooltip>,
            );
        }
    });

    return elements;
};

export const getShownTokens = (
    tokens: EnhancedTokenInfo[],
    symbol: NetworkSymbol,
    coinDefinitions?: TokenDefinition,
): EnhancedTokenInfo[] => {
    const hasCoinDefinitions = getNetworkFeatures(symbol).includes('coin-definitions');

    const shownTokens = tokens.filter(
        token =>
            !hasCoinDefinitions ||
            (isTokenDefinitionKnown(coinDefinitions?.data, symbol, token.contract) &&
                !coinDefinitions?.hide.includes(token.contract)) ||
            coinDefinitions?.show.some(contract => contract === token.contract),
    );

    return shownTokens;
};
