import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../constants/colors';
import { RED_ZONES } from '../constants/zones';
import { Zone } from '../types/zone';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { getRiskMapPoints, RiskMapPoint } from '../services/dashboardService';

export function LiveTrackerScreen() {
  const [riskPoints, setRiskPoints] = React.useState<RiskMapPoint[]>([]);
  const [isRiskMapLoading, setIsRiskMapLoading] = React.useState(true);
  const [isRiskMapOffline, setIsRiskMapOffline] = React.useState(false);
  const [dismissedZoneId, setDismissedZoneId] = useState<string | null>(null);
  const trackerZones: Zone[] = useMemo(() => {
    const backendZones = riskPoints
      .filter(
        point =>
          typeof point.latitude === 'number' &&
          typeof point.longitude === 'number',
      )
      .map(point => ({
        id: point.pincode,
        label: point.locationLabel?.trim() || `Pincode ${point.pincode}`,
        locationLabel: point.locationLabel?.trim() || undefined,
        latitude: point.latitude as number,
        longitude: point.longitude as number,
        radiusMeters: Math.min(2500, Math.max(700, point.score * 35)),
        severity: point.riskLevel === 'high' ? 'red' : 'amber',
        diseaseName:
          (point as any).diseaseName || (point as any).disease || (point as any).topDisease || undefined,
      }));

    return backendZones.length > 0 ? backendZones : RED_ZONES;
  }, [riskPoints]);
  const {
    currentLocation,
    hasLocationPermission,
    activeZone,
    lastAlertMessage,
    startTracking,
  } = useLiveLocation(trackerZones);

  useEffect(() => {
    if (!activeZone || activeZone.severity !== 'red') {
      setDismissedZoneId(null);
      return;
    }

    if (dismissedZoneId && dismissedZoneId !== activeZone.id) {
      setDismissedZoneId(null);
    }
  }, [activeZone, dismissedZoneId]);

  useEffect(() => {
    startTracking().catch(() => {
      // keep screen stable if permission flow fails
    });
  }, [startTracking]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const response = await getRiskMapPoints();
      if (!active) {
        return;
      }

      setRiskPoints(response.points);
      setIsRiskMapOffline(
        response.source !== 'ai-server' && response.source !== 'supabase',
      );
      setIsRiskMapLoading(false);
    };

    load().catch(() => {
      if (active) {
        setIsRiskMapOffline(true);
        setIsRiskMapLoading(false);
      }
    });
    const timer = setInterval(() => {
      load().catch(() => {
        if (active) {
          setIsRiskMapOffline(true);
        }
      });
    }, 60000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const html = useMemo(() => {
    const zonesJson = JSON.stringify(
      trackerZones.map(zone => ({
        ...zone,
        label: zone.locationLabel || zone.label,
        diseaseName: (zone as any).diseaseName,
      })),
    );
    const centerLat = currentLocation?.latitude ?? 20.5937;
    const centerLng = currentLocation?.longitude ?? 78.9629;
    const zoomLevel = currentLocation ? 15 : 4;
    const hasLocation = Boolean(currentLocation);
    const userLat = currentLocation?.latitude ?? null;
    const userLng = currentLocation?.longitude ?? null;

    return `
      <!doctype html>
      <html>
      <head>
        <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #map { height: 100%; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          .user-dot {
            width: 14px;
            height: 14px;
            background: #1d4ed8;
            border: 2px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 0 4px rgba(29, 78, 216, 0.24);
          }
          .layer-toggle {
            position: absolute;
            top: 12px;
            right: 12px;
            z-index: 1000;
            display: flex;
            background: rgba(255,255,255,0.96);
            border-radius: 10px;
            border: 1px solid rgba(15, 23, 42, 0.12);
            overflow: hidden;
            box-shadow: 0 4px 14px rgba(2, 6, 23, 0.12);
          }
          .layer-btn {
            border: 0;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 700;
            color: #334155;
            background: transparent;
          }
          .layer-btn.active {
            background: #1d4ed8;
            color: white;
          }
          .map-note {
            position: absolute;
            bottom: 8px;
            left: 8px;
            z-index: 1000;
            background: rgba(255,255,255,0.9);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="layer-toggle">
          <button id="streetBtn" class="layer-btn active">Street</button>
          <button id="satBtn" class="layer-btn">Satellite</button>
        </div>
        <div class="map-note">Imagery: Esri, Maxar, Earthstar Geographics</div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const map = L.map('map', { 
            zoomControl: true, 
            scrollWheelZoom: true,
            touchZoom: true,
            doubleClickZoom: true
          }).setView([${centerLat}, ${centerLng}], ${zoomLevel});

          const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          });

          const satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
              attribution:
                'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            }
          );

          streetLayer.addTo(map);

          const streetBtn = document.getElementById('streetBtn');
          const satBtn = document.getElementById('satBtn');

          function setActiveLayer(type) {
            if (type === 'street') {
              if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
              if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
              streetBtn.classList.add('active');
              satBtn.classList.remove('active');
            } else {
              if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
              if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
              satBtn.classList.add('active');
              streetBtn.classList.remove('active');
            }
          }

          streetBtn.addEventListener('click', () => setActiveLayer('street'));
          satBtn.addEventListener('click', () => setActiveLayer('satellite'));

          const zones = ${zonesJson};
          zones.forEach(zone => {
            const isRed = zone.severity === 'red';
            L.circle([zone.latitude, zone.longitude], {
              color: isRed ? '#B42318' : '#B54708',
              fillColor: isRed ? '#B42318' : '#B54708',
              fillOpacity: 0.24,
              radius: zone.radiusMeters,
              weight: 2
            }).addTo(map).bindPopup(
              '<strong>' + zone.label + '</strong>' +
                (zone.diseaseName ? '<br/>Disease: ' + zone.diseaseName : '') +
                '<br/>Severity: ' + zone.severity.toUpperCase()
            );
          });

          const hasLocation = ${JSON.stringify(hasLocation)};

          if (hasLocation) {
            const userIcon = L.divIcon({ className: 'user-dot', iconSize: [14, 14] });
            const userMarker = L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(map);
            userMarker.bindPopup('<strong>Your Live Location</strong>', { autoClose: false });
          }
          
          // Smooth auto-zoom animation to user location
          if (hasLocation) {
            setTimeout(() => {
              map.flyTo([${userLat}, ${userLng}], ${zoomLevel}, { duration: 2 });
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
  }, [currentLocation, trackerZones]);

  return (
    <View style={styles.container}>
      <WebView
        style={styles.map}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
      />

      {!hasLocationPermission ? (
        <View style={styles.overlayMessage}>
          <Text style={styles.overlayTitle}>Location permission required</Text>
          <Text style={styles.overlaySubTitle}>
            Please enable location access in system settings to show your live
            position.
          </Text>
        </View>
      ) : null}

      {hasLocationPermission && !currentLocation ? (
        <View style={styles.overlayMessage}>
          <Text style={styles.overlayTitle}>
            Fetching your live location...
          </Text>
          <Text style={styles.overlaySubTitle}>
            Hold on, we are locking GPS and updating your marker.
          </Text>
        </View>
      ) : null}

      {isRiskMapLoading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color="#1d4ed8" />
          <Text style={styles.loadingText}>Loading safety zones...</Text>
        </View>
      ) : null}

      {isRiskMapOffline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineTitle}>Offline mode</Text>
          <Text style={styles.offlineText}>
            Showing the last known zones. GPS red-zone warnings still work on
            this device.
          </Text>
        </View>
      ) : null}

      {activeZone &&
      activeZone.severity === 'red' &&
      dismissedZoneId !== activeZone.id ? (
        <View style={[styles.overlayMessage, styles.redZoneMessage]}>
          <View style={styles.redZoneHeader}>
            <View style={styles.redZoneHeaderText}>
              <Text style={styles.redZoneKicker}>RED ZONE</Text>
              <Text style={styles.redZoneHeading}>Stay alert and safe</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss red zone warning"
              onPress={() => setDismissedZoneId(activeZone.id)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.redZoneArea}>
            Area: {activeZone.locationLabel || activeZone.label}
          </Text>
          <Text style={styles.redZoneBody}>{lastAlertMessage}</Text>
          <Text style={styles.redZoneBodyMuted}>
            Please move to a safer nearby area and follow local health guidance.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  overlayMessage: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 22,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  loadingPill: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(29, 78, 216, 0.16)',
  },
  loadingText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },
  offlineBanner: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  offlineTitle: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  offlineText: {
    marginTop: 4,
    color: '#7C2D12',
    fontSize: 12,
    lineHeight: 16,
  },
  redZoneKicker: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  redZoneHeading: {
    color: '#FFF7ED',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  overlayTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  overlaySubTitle: {
    marginTop: 4,
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  redZoneMessage: {
    bottom: 96,
    backgroundColor: 'rgba(127, 29, 29, 0.96)',
    borderColor: 'rgba(248, 113, 113, 0.5)',
    paddingTop: 14,
  },
});
