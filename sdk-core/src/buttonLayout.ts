import { useCallback, useMemo, useState } from 'react';
import type { DimensionValue, LayoutChangeEvent } from 'react-native';

type PercentageHeightMeasurement = {
    source: object;
    value?: number;
};

export type ButtonHeightResolution = {
    /** The native child fills the outer wrapper until its pixel height is known. */
    nativeHeight: DimensionValue | undefined;
    /** Numeric height for the iOS Paper bridge; null explicitly clears it. */
    preferredHeight: number | null;
    /** Attached only while the outer wrapper owns a percentage height. */
    onLayout: ((event: LayoutChangeEvent) => void) | undefined;
};

const isPercentageHeight = (height: DimensionValue | undefined): height is `${number}%` =>
    typeof height === 'string' && height.endsWith('%');

/**
 * Resolve a percentage exactly once against the outer React Native View.
 *
 * A nested native child must not receive the same percentage, otherwise Yoga
 * resolves it again against the already-resolved outer height. Numeric and
 * intrinsic heights stay on their existing paths.
 */
export const useButtonHeightResolution = (height: DimensionValue | undefined): ButtonHeightResolution => {
    const percentageHeight = isPercentageHeight(height) ? height : null;
    const source = useMemo(() => ({}), [percentageHeight]);
    const [measurement, setMeasurement] = useState<PercentageHeightMeasurement>({ source });
    const resolvedHeight = measurement.source === source ? measurement.value : undefined;

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        if (!percentageHeight) return;
        const nextHeight = event.nativeEvent.layout.height;
        if (!Number.isFinite(nextHeight) || nextHeight < 0) return;
        const resolvedValue = nextHeight > 0 ? nextHeight : undefined;
        setMeasurement(previous => (
            previous.source === source && previous.value === resolvedValue
                ? previous
                : { source, value: resolvedValue }
        ));
    }, [percentageHeight, source]);

    const nativeHeight = percentageHeight ? (resolvedHeight ?? '100%') : height;
    const preferredHeight = percentageHeight
        ? (resolvedHeight ?? null)
        : typeof height === 'number' && Number.isFinite(height)
            ? Math.max(48, height)
            : null;

    return {
        nativeHeight,
        preferredHeight,
        onLayout: percentageHeight ? onLayout : undefined,
    };
};
