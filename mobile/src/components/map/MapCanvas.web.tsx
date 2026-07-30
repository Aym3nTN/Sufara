import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors, radius, typography } from '../../theme';
import type { LatLng } from '../../api/types';
import type { MapCanvasProps } from './types';

/**
 * Web implementation of the map contract.
 *
 * Tiled basemaps need a keyed provider, so on web the canvas draws a schematic
 * plan view instead: true relative positions, the route line and numbered
 * stops, on a neutral grid. It is honest about being a diagram rather than
 * imitating satellite imagery, and it keeps every planning screen reviewable in
 * a browser. Native builds get the real basemap.
 */
const PADDING = 26;

interface Projection {
  toPoint: (coordinate: LatLng) => { x: number; y: number };
  toCoordinate: (x: number, y: number) => LatLng;
}

function buildProjection(
  coordinates: LatLng[],
  width: number,
  height: number,
): Projection {
  const latitudes = coordinates.map((c) => c.latitude);
  const longitudes = coordinates.map((c) => c.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  // Keep a minimum span so a single marker does not divide by zero, and
  // preserve aspect ratio so shapes are not stretched.
  const latSpan = Math.max(0.004, maxLat - minLat);
  const lonSpan = Math.max(0.004, maxLon - minLon);
  const centreLat = (minLat + maxLat) / 2;
  const centreLon = (minLon + maxLon) / 2;

  const metresPerDegreeLon = Math.cos((centreLat * Math.PI) / 180);
  const usableWidth = Math.max(1, width - PADDING * 2);
  const usableHeight = Math.max(1, height - PADDING * 2);

  const scale = Math.min(
    usableWidth / (lonSpan * metresPerDegreeLon),
    usableHeight / latSpan,
  );

  const toPoint = (coordinate: LatLng) => ({
    x: width / 2 + (coordinate.longitude - centreLon) * metresPerDegreeLon * scale,
    y: height / 2 - (coordinate.latitude - centreLat) * scale,
  });

  const toCoordinate = (x: number, y: number) => ({
    latitude: centreLat - (y - height / 2) / scale,
    longitude: centreLon + (x - width / 2) / (metresPerDegreeLon * scale),
  });

  return { toPoint, toCoordinate };
}

export function MapCanvas({
  markers,
  polyline,
  focus,
  onMarkerPress,
  onMapPress,
  selectedMarkerId,
  height = 260,
  style,
}: MapCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height: measured } = event.nativeEvent.layout;
    setSize({ width, height: measured });
  };

  const points = useMemo(() => {
    const all = [...markers.map((marker) => marker.coordinate), ...(polyline ?? [])];
    if (focus) all.push(focus);
    return all.length > 0 ? all : [{ latitude: 24.4686, longitude: 39.6142 }];
  }, [markers, polyline, focus]);

  const projection = useMemo(
    () => (size.width > 0 ? buildProjection(points, size.width, size.height) : null),
    [points, size],
  );

  /**
   * Screen positions for the pins, nudged apart when they would overlap.
   *
   * Heritage sites cluster tightly (al-Baqi is 400 m from the Prophet's Mosque),
   * and a plan view fitted to an 8 km route collapses them into one blob. The
   * route line still uses true positions; only the pin badges are offset, just
   * enough to stay individually readable and tappable.
   */
  const pinPositions = useMemo(() => {
    if (!projection) return new Map<string, { x: number; y: number }>();

    const MIN_GAP = 30;
    const placed: Array<{ id: string; x: number; y: number }> = [];

    for (const marker of markers) {
      const base = projection.toPoint(marker.coordinate);
      let { x, y } = base;

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const clash = placed.find(
          (other) => Math.hypot(other.x - x, other.y - y) < MIN_GAP,
        );
        if (!clash) break;
        // Walk outwards on a spiral from the true position.
        const angle = (attempt * 2 * Math.PI) / 6;
        const radius = MIN_GAP * (1 + Math.floor(attempt / 6)) * 0.9;
        x = base.x + Math.cos(angle) * radius;
        y = base.y + Math.sin(angle) * radius;
      }

      placed.push({ id: marker.id, x, y });
    }

    return new Map(placed.map((entry) => [entry.id, { x: entry.x, y: entry.y }]));
  }, [projection, markers]);

  const routePath = useMemo(() => {
    if (!projection || !polyline || polyline.length < 2) return null;
    return polyline
      .map((coordinate, index) => {
        const { x, y } = projection.toPoint(coordinate);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [projection, polyline]);

  const gridLines = useMemo(() => {
    if (size.width === 0) return [];
    const step = 44;
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let x = step; x < size.width; x += step) {
      lines.push({ x1: x, y1: 0, x2: x, y2: size.height });
    }
    for (let y = step; y < size.height; y += step) {
      lines.push({ x1: 0, y1: y, x2: size.width, y2: y });
    }
    return lines;
  }, [size]);

  return (
    <View
      onLayout={onLayout}
      style={[{ height: height as number, borderRadius: radius.lg, overflow: 'hidden' }, styles.canvas, style as object]}
    >
      {projection ? (
        <>
          <Svg width="100%" height="100%">
            <Rect x={0} y={0} width={size.width} height={size.height} fill={colors.surfaceMuted} />
            {gridLines.map((line, index) => (
              <Line
                key={index}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}

            {routePath ? (
              <>
                <Path d={routePath} stroke="#FFFFFF" strokeWidth={7} fill="none" strokeLinejoin="round" />
                <Path
                  d={routePath}
                  stroke={colors.primary}
                  strokeWidth={3.5}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            ) : null}

            {markers.map((marker) => {
              const truePoint = projection.toPoint(marker.coordinate);
              const pin = pinPositions.get(marker.id) ?? truePoint;
              const nudged = Math.hypot(pin.x - truePoint.x, pin.y - truePoint.y) > 1;
              const tint = marker.kind === 'start' ? colors.gold : marker.tint ?? colors.primary;

              return (
                <React.Fragment key={`halo-${marker.id}`}>
                  {/* A displaced pin keeps a leader line back to the real spot. */}
                  {nudged ? (
                    <>
                      <Line
                        x1={truePoint.x}
                        y1={truePoint.y}
                        x2={pin.x}
                        y2={pin.y}
                        stroke={tint}
                        strokeWidth={1.5}
                        strokeOpacity={0.5}
                      />
                      <Circle cx={truePoint.x} cy={truePoint.y} r={3} fill={tint} />
                    </>
                  ) : null}
                  <Circle
                    cx={pin.x}
                    cy={pin.y}
                    r={selectedMarkerId === marker.id ? 20 : 15}
                    fill={tint}
                    fillOpacity={0.18}
                  />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Pin labels sit above the SVG so text rendering matches the rest of the UI. */}
          {markers.map((marker) => {
            const { x, y } = pinPositions.get(marker.id) ?? projection.toPoint(marker.coordinate);
            const selected = selectedMarkerId === marker.id;
            return (
              <Pressable
                key={marker.id}
                accessibilityRole="button"
                accessibilityLabel={marker.title ?? marker.label ?? 'Map marker'}
                onPress={onMarkerPress ? () => onMarkerPress(marker.id) : undefined}
                style={[
                  styles.pin,
                  {
                    left: x - 15,
                    top: y - 15,
                    backgroundColor: marker.kind === 'start' ? colors.gold : marker.tint ?? colors.primary,
                  },
                  selected && styles.pinSelected,
                ]}
              >
                <Text style={[typography.small, styles.pinLabel]}>
                  {marker.label ?? marker.glyph ?? '•'}
                </Text>
              </Pressable>
            );
          })}

          {onMapPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Drop a pin on the map"
              onPress={(event) => {
                const { locationX, locationY } = event.nativeEvent;
                onMapPress(projection.toCoordinate(locationX, locationY));
              }}
              style={styles.pressLayer}
            />
          ) : null}

          <View style={styles.attribution} pointerEvents="none">
            <Text style={[typography.small, { color: colors.textFaint, fontSize: 10 }]}>
              Schematic plan view · basemap on device
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  pin: {
    position: 'absolute',
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinSelected: { transform: [{ scale: 1.2 }] },
  pinLabel: { color: '#FFFFFF', fontWeight: '700' },
  // Behind the pins, so tapping a pin still selects it rather than dropping one.
  pressLayer: { position: 'absolute', inset: 0, zIndex: -1 },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    // Sits on a chip so it stays legible without covering a pin.
    backgroundColor: 'rgba(250,246,239,0.88)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
