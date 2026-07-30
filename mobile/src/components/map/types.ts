import type { LatLng } from '../../api/types';

export interface MapMarkerSpec {
  id: string;
  coordinate: LatLng;
  /** Shown inside the pin: a stop number, or a category glyph. */
  label?: string;
  glyph?: string;
  tint?: string;
  title?: string;
  subtitle?: string;
  kind?: 'place' | 'start' | 'user';
}

export interface MapCanvasProps {
  markers: MapMarkerSpec[];
  /** Route line, in order. */
  polyline?: LatLng[];
  /** Region to fit. Defaults to the bounds of all markers. */
  focus?: LatLng | null;
  onMarkerPress?: (id: string) => void;
  /** Enables "drop a pin" behaviour, used by the admin place editor. */
  onMapPress?: (coordinate: LatLng) => void;
  selectedMarkerId?: string | null;
  height?: number | string;
  interactive?: boolean;
  style?: object;
}

/**
 * The whole app talks to maps through this one component contract. Swapping
 * react-native-maps for Mapbox or MapLibre means replacing the implementation
 * files in this folder and nothing else.
 */
export type MapCanvasComponent = (props: MapCanvasProps) => React.ReactElement | null;
