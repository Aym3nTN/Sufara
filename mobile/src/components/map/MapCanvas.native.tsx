import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { colors, radius, typography } from '../../theme';
import type { MapCanvasProps } from './types';

/**
 * Native map implementation: Google Maps on Android, Apple Maps on iOS.
 * Provider choice stays here so screens remain provider-agnostic.
 */
function regionFor(coordinates: Array<{ latitude: number; longitude: number }>): Region {
  if (coordinates.length === 0) {
    return { latitude: 24.4686, longitude: 39.6142, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  }

  const latitudes = coordinates.map((c) => c.latitude);
  const longitudes = coordinates.map((c) => c.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.6),
  };
}

export function MapCanvas({
  markers,
  polyline,
  focus,
  onMarkerPress,
  onMapPress,
  selectedMarkerId,
  height = 260,
  interactive = true,
  style,
}: MapCanvasProps) {
  const mapRef = useRef<MapView | null>(null);

  const region = useMemo(
    () => regionFor(focus ? [focus] : [...markers.map((m) => m.coordinate), ...(polyline ?? [])]),
    [focus, markers, polyline],
  );

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 450);
  }, [region]);

  return (
    <View style={[{ height, borderRadius: radius.lg, overflow: 'hidden' }, style as object]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation
        onPress={
          onMapPress
            ? (event) => onMapPress(event.nativeEvent.coordinate)
            : undefined
        }
      >
        {polyline && polyline.length > 1 ? (
          <Polyline
            coordinates={polyline}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineDashPattern={[1]}
          />
        ) : null}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.subtitle}
            onPress={onMarkerPress ? () => onMarkerPress(marker.id) : undefined}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.pin,
                { backgroundColor: marker.tint ?? colors.primary },
                marker.kind === 'start' && styles.pinStart,
                selectedMarkerId === marker.id && styles.pinSelected,
              ]}
            >
              <Text style={[typography.small, styles.pinLabel]}>
                {marker.label ?? marker.glyph ?? '•'}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinStart: { backgroundColor: colors.gold },
  pinSelected: { transform: [{ scale: 1.25 }] },
  pinLabel: { color: '#FFFFFF', fontWeight: '700' },
});
