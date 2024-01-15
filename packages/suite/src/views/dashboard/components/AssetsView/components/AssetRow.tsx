import { memo, ComponentProps } from 'react';
import styled, { css, useTheme } from 'styled-components';
import { Network } from 'src/types/wallet';
import {
    Icon,
    variables,
    motionAnimation,
    SkeletonCircle,
    SkeletonRectangle,
} from '@trezor/components';
import {
    AmountUnitSwitchWrapper,
    CoinBalance,
    FiatValue,
    PriceTicker,
    Translation,
    TrendTicker,
} from 'src/components/suite';
import { CoinmarketBuyButton } from 'src/views/dashboard/components/CoinmarketBuyButton';
import { isTestnet } from '@suite-common/wallet-utils';
import { goto } from 'src/actions/suite/routerActions';
import { useAccountSearch, useDispatch, useLoadingSkeleton } from 'src/hooks/suite';
import { motion } from 'framer-motion';
import { ArrowIcon, AssetInfo } from './AssetInfo';
import { spacingsPx, typography } from '@trezor/theme';
import { AssetFiatBalance } from '@suite-common/assets';
import { AssetTableRowGrid } from './AssetTableRowGrid';

const LogoWrapper = styled.div`
    padding-right: 12px;
    display: flex;
    align-items: center;
`;

const Coin = styled.div`
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
`;

const StyledCol = styled(motion.div)<{ $isLastRow?: boolean }>`
    display: flex;
    align-items: center;
    padding: 16px 0;
    color: ${({ theme }) => theme.TYPE_DARK_GREY};
    font-size: ${variables.FONT_SIZE.NORMAL};
    font-weight: ${variables.FONT_WEIGHT.MEDIUM};
    border-bottom: 1px solid ${({ theme }) => theme.borderOnElevation1};
    padding-right: 20px;

    ${({ $isLastRow }) =>
        $isLastRow &&
        css`
            border-bottom: none;
        `}
`;

const Col = (props: ComponentProps<typeof StyledCol>) => {
    const newProps = { ...props };
    delete newProps.isLastRow;

    return <StyledCol {...motionAnimation.expand} {...newProps} $isLastRow={props.isLastRow} />;
};

const CoinNameWrapper = styled(Col)`
    overflow: hidden;
    font-weight: ${variables.FONT_WEIGHT.DEMI_BOLD};
    padding-left: 18px;
    text-overflow: ellipsis;

    ${variables.SCREEN_QUERY.MOBILE} {
        grid-column: 1 / 4;
        padding-left: 20px;
        border-bottom: none;
    }

    :hover {
        ${Coin} {
            text-decoration: underline;
        }
    }
`;

const CoinBalanceContainer = styled.div`
    ${typography.hint}
`;

const FailedCol = styled(Col)`
    color: ${({ theme }) => theme.TYPE_RED};
    font-size: ${variables.FONT_SIZE.SMALL};
    font-weight: ${variables.FONT_WEIGHT.REGULAR};

    ${variables.SCREEN_QUERY.MOBILE} {
        grid-column: 1 / 3;
        margin-left: 20px;
    }
`;

const CryptoBalanceWrapper = styled(Col)`
    flex: 1;
    white-space: nowrap;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: ${spacingsPx.xxxs};

    ${variables.SCREEN_QUERY.MOBILE} {
        grid-column: 1 / 3;
        margin-left: 20px;
    }
`;

const FiatBalanceWrapper = styled.div`
    color: ${({ theme }) => theme.textSubdued};
`;

const ExchangeRateWrapper = styled(Col)`
    font-variant-numeric: tabular-nums;
    padding-right: 0;
`;

const BuyButtonWrapper = styled(Col)`
    justify-content: right;
`;

interface AssetTableProps {
    network: Network;
    failed: boolean;
    cryptoValue: string;
    isLastRow?: boolean;
    assetsFiatBalances: AssetFiatBalance[];
}

export const AssetRow = memo(
    ({ network, failed, cryptoValue, isLastRow, assetsFiatBalances }: AssetTableProps) => {
        const { symbol } = network;
        const dispatch = useDispatch();
        const theme = useTheme();
        const { setCoinFilter, setSearchString } = useAccountSearch();

        const handleRowClick = () => {
            dispatch(
                goto('wallet-index', {
                    params: {
                        symbol,
                        accountIndex: 0,
                        accountType: 'normal',
                    },
                }),
            );
            // activate coin filter and reset account search string
            setCoinFilter(symbol);
            setSearchString(undefined);
        };

        return (
            <AssetTableRowGrid onClick={handleRowClick}>
                <CoinNameWrapper isLastRow={isLastRow}>
                    <AssetInfo network={network} assetsFiatBalances={assetsFiatBalances} />
                </CoinNameWrapper>

                {!failed ? (
                    <CryptoBalanceWrapper
                        isLastRow={isLastRow}
                        data-test={`@asset-card/${symbol}/balance`}
                    >
                        <FiatBalanceWrapper>
                            <FiatValue amount={cryptoValue} symbol={symbol} />
                        </FiatBalanceWrapper>

                        <CoinBalanceContainer>
                            <AmountUnitSwitchWrapper symbol={symbol}>
                                <CoinBalance value={cryptoValue} symbol={symbol} />
                            </AmountUnitSwitchWrapper>
                        </CoinBalanceContainer>
                    </CryptoBalanceWrapper>
                ) : (
                    <FailedCol isLastRow={isLastRow}>
                        <Translation id="TR_DASHBOARD_ASSET_FAILED" />

                        <Icon
                            style={{ paddingLeft: '4px', paddingBottom: '2px' }}
                            icon="WARNING"
                            color={theme.TYPE_RED}
                            size={14}
                        />
                    </FailedCol>
                )}
                <ExchangeRateWrapper isLastRow={isLastRow}>
                    {!isTestnet(symbol) && <PriceTicker symbol={symbol} />}
                </ExchangeRateWrapper>
                <ExchangeRateWrapper isLastRow={isLastRow}>
                    {!isTestnet(symbol) && <TrendTicker symbol={symbol} />}
                </ExchangeRateWrapper>
                <BuyButtonWrapper isLastRow={isLastRow}>
                    {!isTestnet(symbol) && (
                        <CoinmarketBuyButton
                            symbol={symbol}
                            dataTest={`@dashboard/assets/table/${symbol}/buy-button`}
                        />
                    )}
                    <ArrowIcon size={16} icon="ARROW_RIGHT_LONG" color={theme.iconPrimaryDefault} />
                </BuyButtonWrapper>
            </AssetTableRowGrid>
        );
    },
);

export const AssetRowSkeleton = (props: { animate?: boolean }) => {
    const { shouldAnimate } = useLoadingSkeleton();

    const animate = props.animate ?? shouldAnimate;

    return (
        <AssetTableRowGrid>
            <CoinNameWrapper isLastRow>
                <LogoWrapper>
                    <SkeletonCircle size={48} />
                </LogoWrapper>
                <Coin>
                    <SkeletonRectangle animate={animate} width={150} />
                </Coin>
            </CoinNameWrapper>
            <CryptoBalanceWrapper isLastRow>
                <SkeletonRectangle animate={animate} width={100} />
            </CryptoBalanceWrapper>

            <ExchangeRateWrapper isLastRow>
                <SkeletonRectangle animate={animate} />
            </ExchangeRateWrapper>
            <ExchangeRateWrapper isLastRow>
                <SkeletonRectangle animate={animate} width={50} />
            </ExchangeRateWrapper>
            <BuyButtonWrapper isLastRow>
                <SkeletonRectangle animate={animate} width={58} height={38} borderRadius={19} />
            </BuyButtonWrapper>
        </AssetTableRowGrid>
    );
};
