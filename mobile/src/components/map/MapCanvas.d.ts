/**
 * Type surface for the platform-resolved implementations
 * (`MapCanvas.native.tsx` / `MapCanvas.web.tsx`). Metro picks the file at
 * bundle time; TypeScript reads the contract from here.
 */
import type { ReactElement } from 'react';
import type { MapCanvasProps } from './types';

export declare function MapCanvas(props: MapCanvasProps): ReactElement | null;
