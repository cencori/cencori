// Type declarations for react-simple-maps
// This package doesn't have official TypeScript types

declare module 'react-simple-maps' {
    import { ComponentType, ReactNode, CSSProperties } from 'react';

    interface ProjectionConfig {
        scale?: number;
        center?: [number, number];
        rotate?: [number, number, number];
    }

    interface ComposableMapProps {
        projection?: string;
        projectionConfig?: ProjectionConfig;
        width?: number;
        height?: number;
        style?: CSSProperties;
        children?: ReactNode;
    }

    interface ZoomableGroupProps {
        center?: [number, number];
        zoom?: number;
        minZoom?: number;
        maxZoom?: number;
        translateExtent?: [[number, number], [number, number]];
        onMoveStart?: (event: any) => void;
        onMove?: (event: any) => void;
        onMoveEnd?: (event: any) => void;
        children?: ReactNode;
    }

    interface GeographiesProps {
        geography: string | object;
        children: (props: { geographies: Geography[] }) => ReactNode;
    }

    interface Geography {
        rsmKey: string;
        properties: {
            name?: string;
            NAME?: string;
            ISO_A2?: string;
            iso_a2?: string;
            [key: string]: any;
        };
        geometry: any;
    }

    interface GeographyStyle {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        outline?: string;
        cursor?: string;
    }

    interface GeographyProps {
        geography: Geography;
        onMouseEnter?: (event?: React.MouseEvent) => void;
        onMouseLeave?: (event?: React.MouseEvent) => void;
        onClick?: (event?: React.MouseEvent) => void;
        style?: {
            default?: GeographyStyle;
            hover?: GeographyStyle;
            pressed?: GeographyStyle;
        };
    }

    export const ComposableMap: ComponentType<ComposableMapProps>;
    export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
    export const Geographies: ComponentType<GeographiesProps>;
    export const Geography: ComponentType<GeographyProps>;
}
