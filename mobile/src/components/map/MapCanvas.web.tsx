import React, { useEffect, useState } from 'react';
import { SchematicMapCanvas } from './SchematicMapCanvas.web';
import { TiledMapCanvas } from './TiledMapCanvas.web';
import type { MapCanvasProps } from './types';

/**
 * Web map dispatcher.
 *
 * When EXPO_PUBLIC_MAPTILER_API_KEY is set at build time, the app renders a
 * real tiled basemap via MapLibre GL against MapTiler. Otherwise it falls
 * back to the schematic plan view, so every planning screen still works with
 * zero setup.
 *
 * MapLibre GL's CSS is loaded lazily from its own package to keep the initial
 * bundle small when the tiled view is unused, and to avoid pulling a browser-
 * only CSS import into the native builds.
 */
const MAPTILER_API_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY ?? '';

export function MapCanvas(props: MapCanvasProps) {
  const [cssReady, setCssReady] = useState(!MAPTILER_API_KEY);

  useEffect(() => {
    if (!MAPTILER_API_KEY || cssReady) return;
    if (typeof document === 'undefined') return;

    // Idempotent: multiple map instances share the one stylesheet.
    const existing = document.querySelector('link[data-sufara-maplibre]');
    if (existing) {
      setCssReady(true);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@6.1.0/dist/maplibre-gl.css';
    link.setAttribute('data-sufara-maplibre', 'true');
    link.onload = () => setCssReady(true);
    document.head.appendChild(link);
  }, [cssReady]);

  if (MAPTILER_API_KEY && cssReady) {
    return <TiledMapCanvas {...props} apiKey={MAPTILER_API_KEY} />;
  }
  return <SchematicMapCanvas {...props} />;
}
