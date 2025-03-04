import styled from 'styled-components';
import { analytics, EventType } from '@trezor/suite-analytics';

import { variables, H2, Button, Card, Image } from '@trezor/components';
import { Translation } from 'src/components/suite';
import { useDispatch } from 'src/hooks/suite';
import { Account } from 'src/types/wallet';
import { goto } from 'src/actions/suite/routerActions';
import { spacingsPx } from '@trezor/theme';

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const StyledCard = styled(Card)`
    width: 100%;
    align-items: center;
`;

const Title = styled(H2)`
    text-align: center;
    font-weight: 600;
    margin-bottom: ${spacingsPx.md};
`;

const Description = styled.span`
    font-size: ${variables.FONT_SIZE.NORMAL};
    font-weight: 500;
    text-align: center;
    color: ${({ theme }) => theme.TYPE_LIGHT_GREY};
`;

const StyledImage = styled(Image)`
    width: auto;
    height: 80px;
    margin-top: 60px;
    margin-bottom: 28px;
`;

const Actions = styled.div`
    display: flex;
    justify-content: center;
    width: 100%;
    margin-bottom: ${spacingsPx.lg};
    flex-flow: row wrap;
    gap: ${spacingsPx.md};
`;

const ActionButton = styled(Button)`
    min-width: 160px;
`;

const Divider = styled.div`
    width: 100%;
    height: 1px;
    background: ${({ theme }) => theme.STROKE_GREY};
    margin: 30px 0 36px;
`;

interface AccountEmptyProps {
    account: Account;
}

export const AccountEmpty = ({ account }: AccountEmptyProps) => {
    const dispatch = useDispatch();
    const networkSymbol = account.symbol.toUpperCase();

    const handleNavigateToReceivePage = () => {
        dispatch(goto('wallet-receive', { preserveParams: true }));
        analytics.report({
            type: EventType.AccountsEmptyAccountReceive,
            payload: {
                symbol: networkSymbol.toLowerCase(),
            },
        });
    };
    const handleNavigateToBuyPage = () => {
        dispatch(goto('wallet-coinmarket-buy', { preserveParams: true }));

        analytics.report({
            type: EventType.AccountsEmptyAccountBuy,
            payload: {
                symbol: networkSymbol.toLowerCase(),
            },
        });
    };

    return (
        <Wrapper>
            <StyledCard>
                <StyledImage image="CLOUDY" />

                <Title>
                    <Translation id="TR_ACCOUNT_IS_EMPTY_TITLE" />
                </Title>

                <Description>
                    <Translation
                        id="TR_ACCOUNT_IS_EMPTY_DESCRIPTION"
                        values={{ network: networkSymbol }}
                    />
                </Description>

                <Divider />

                <Actions>
                    <ActionButton
                        data-test="@accounts/empty-account/receive"
                        variant="primary"
                        onClick={handleNavigateToReceivePage}
                    >
                        <Translation id="TR_RECEIVE_NETWORK" values={{ network: networkSymbol }} />
                    </ActionButton>

                    <ActionButton
                        data-test="@accounts/empty-account/buy"
                        variant="primary"
                        onClick={handleNavigateToBuyPage}
                    >
                        <Translation id="TR_BUY_NETWORK" values={{ network: networkSymbol }} />
                    </ActionButton>
                </Actions>
            </StyledCard>
        </Wrapper>
    );
};
