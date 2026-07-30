import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import * as maplibregl from 'maplibre-gl';
import type { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { colors, radius, typography } from '../../theme';
import type { MapCanvasProps } from './types';

/**
 * Real tiled basemap on web, using MapLibre GL against MapTiler.
 *
 * MapLibre GL is the open-source fork of Mapbox GL, so the tile provider is
 * swappable: only the style URL changes. MapTiler is picked for the free tier
 * (100k tile loads per month, no credit card at signup). Get a key from
 * https://cloud.maptiler.com/account/keys/ and expose it as
 * `EXPO_PUBLIC_MAPTILER_API_KEY` at build time.
 *
 * Attribution is required by both MapTiler and OpenStreetMap and is added by
 * MapLibre automatically via `AttributionControl`.
 */
export function TiledMapCanvas({
  markers,
  polyline,
  focus,
  onMarkerPress,
  onMapPress,
  selectedMarkerId,
  height = 260,
  style,
  apiKey,
}: MapCanvasProps & { apiKey: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Map<string, Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height: measured } = event.nativeEvent.layout;
    setSize({ width, height: measured });
  };

  // Compute an initial camera that fits every marker + the polyline + the focus.
  const initialBounds = useMemo<LngLatBoundsLike | null>(() => {
    const points: Array<[number, number]> = [
      ...markers.map((m) => [m.coordinate.longitude, m.coordinate.latitude] as [number, number]),
      ...(polyline?.map((p) => [p.longitude, p.latitude] as [number, number]) ?? []),
    ];
    if (focus) points.push([focus.longitude, focus.latitude]);
    if (points.length === 0) return null;

    const lons = points.map(([lon]) => lon);
    const lats = points.map(([, lat]) => lat);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    // Only computed once for the initial fit; further updates use fitBounds below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init map once the container is mounted.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(apiKey)}`;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      // Single-place fallback when nothing has bounds yet: Madinah — the sole
      // location the app hard-codes anywhere, matching the schematic view.
      center: [39.6142, 24.4686],
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      setReady(true);
      if (initialBounds) {
        map.fitBounds(initialBounds, { padding: 40, animate: false, maxZoom: 15 });
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Wire the map-press callback whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapPress) return;
    const handler = (event: maplibregl.MapMouseEvent) => {
      onMapPress({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [onMapPress]);

  // Sync markers into MapLibre. We reuse Marker instances by id so React
  // re-renders don't recreate every marker element every time.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(markers.map((m) => m.id));

    // Remove markers that are no longer in the list.
    for (const [id, marker] of markerRefs.current.entries()) {
      if (!nextIds.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }

    for (const marker of markers) {
      const tint = marker.kind === 'start' ? colors.gold : marker.tint ?? colors.primary;
      const label = marker.label ?? marker.glyph ?? '•';
      const selected = selectedMarkerId === marker.id;

      const el = document.createElement('div');
      el.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'min-width:30px',
        'height:30px',
        'padding:0 6px',
        'border-radius:15px',
        `background:${tint}`,
        'color:#FFFFFF',
        'font-weight:700',
        'font-size:13px',
        'border:2px solid #FFFFFF',
        `box-shadow:0 2px 6px rgba(15,61,46,${selected ? '0.4' : '0.25'})`,
        `transform:scale(${selected ? '1.15' : '1'})`,
        'cursor:pointer',
        'transition:transform 120ms ease',
      ].join(';');
      el.textContent = label;
      el.setAttribute('role', 'button');
      if (marker.title) el.setAttribute('aria-label', marker.title);
      if (onMarkerPress) {
        el.addEventListener('click', (event) => {
          event.stopPropagation(); // Never fires onMapPress at the same time.
          onMarkerPress(marker.id);
        });
      }

      const existing = markerRefs.current.get(marker.id);
      if (existing) existing.remove();

      const instance = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([marker.coordinate.longitude, marker.coordinate.latitude])
        .addTo(map);
      markerRefs.current.set(marker.id, instance);
    }
  }, [ready, markers, selectedMarkerId, onMarkerPress]);

  // Draw the route polyline as a GeoJSON source + line layer.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'sufara-route';
    const layerId = 'sufara-route-line';
    const glowId = 'sufara-route-glow';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geojson: any = polyline && polyline.length >= 2
      ? {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: polyline.map((p) => [p.longitude, p.latitude]),
          },
        }
      : null;

    if (!geojson) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(glowId)) map.removeLayer(glowId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }

    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({
        id: glowId,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#FFFFFF', 'line-width': 8 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': colors.primary, 'line-width': 4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }
  }, [ready, polyline]);

  // Keep the map fitting the content when the marker set changes materially.
  // Bounded to a max zoom so a single marker doesn't zoom to a street corner.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    if (markers.length === 0) return;

    const lons = markers.map((m) => m.coordinate.longitude);
    const lats = markers.map((m) => m.coordinate.latitude);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    map.fitBounds(bounds, { padding: 60, animate: true, maxZoom: 15, duration: 400 });
  }, [ready, markers]);

  // Repaint when the viewport size changes (rotation, split view, tab open).
  useEffect(() => {
    const map = mapRef.current;
    if (map && size.width > 0) map.resize();
  }, [size]);

  return (
    <View
      onLayout={onLayout}
      style={[{ height: height as number, borderRadius: radius.lg, overflow: 'hidden' }, styles.canvas, style as object]}
    >
      {/* MapLibre attaches to a DOM element, which react-native-web renders. */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!ready ? (
        <View style={styles.loader} pointerEvents="none">
          <Text style={[typography.small, { color: colors.textMuted }]}>…</Text>
        </View>
      ) : null}
      {onMapPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Drop a pin on the map"
          style={styles.hint}
          pointerEvents="none"
        >
          <Text style={[typography.small, { color: colors.textFaint, fontSize: 10 }]}>
            Tap to drop a pin
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  loader: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  hint: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(250,246,239,0.88)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
