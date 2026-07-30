/**
 * Map facade. Metro resolves `MapCanvas.native.tsx` on device and
 * `MapCanvas.web.tsx` in the browser; callers import from here only.
 */
export { MapCanvas } from './MapCanvas';
export type { MapCanvasProps, MapMarkerSpec } from './types';
