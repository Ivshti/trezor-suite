import { useState } from 'react';
import Lottie from 'lottie-react';
import styled from 'styled-components';
import animationStart from './animationData/refresh-spinner-start.json';
import animationMiddle from './animationData/refresh-spinner-middle.json';
import animationEnd from './animationData/refresh-spinner-end-success.json';
import animationWarn from './animationData/refresh-spinner-end-warning.json';
import { TransientFrameProps, withFrameProps, FrameProps } from '../../common/frameProps';

const StyledLottie = styled(Lottie)<
    {
        size: SpinnerProps['size'];
        $isGrey: SpinnerProps['isGrey'];
    } & TransientFrameProps
>`
    width: ${({ size }) => `${size}px`};
    height: ${({ size }) => `${size}px`};
    filter: ${({ $isGrey }) => ($isGrey ? 'grayscale(1) opacity(0.6)' : 'none')};

    ${withFrameProps}
`;

export interface SpinnerProps {
    size?: number;
    isGrey?: boolean;
    hasStartAnimation?: boolean;
    hasFinished?: boolean;
    hasError?: boolean;
    className?: string;
    dataTest?: string;
    margin?: FrameProps['margin'];
}

export const Spinner = ({
    size = 100,
    isGrey = true,
    hasStartAnimation,
    hasFinished,
    hasError,
    className,
    dataTest,
    margin,
}: SpinnerProps) => {
    const [hasStarted, setHasStarted] = useState(false);
    const [hasFinishedRotation, setHasFinishedRotation] = useState(false);

    const onLoopComplete = () => {
        setHasFinishedRotation(true);
    };

    const getProps = () => {
        if (hasFinished && hasFinishedRotation) {
            return {
                animationData: animationEnd,
                loop: false,
            };
        }

        if (hasError && hasFinishedRotation) {
            return {
                animationData: animationWarn,
                loop: false,
            };
        }

        if (hasStarted || !hasStartAnimation) {
            return {
                animationData: animationMiddle,
                onLoopComplete,
            };
        }

        return {
            animationData: animationStart,
            onComplete: () => setHasStarted(true),
            loop: false,
        };
    };

    return (
        <StyledLottie
            size={size}
            $isGrey={isGrey}
            className={className}
            $margin={margin}
            {...getProps()}
            data-test={dataTest}
        />
    );
};
