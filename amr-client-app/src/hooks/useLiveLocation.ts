import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { RED_ZONES } from '../constants/zones';
import { useI18n } from '../i18n/LanguageContext';
import { notifyEscalation } from '../services/alertService';
import { Coordinate, Zone } from '../types/zone';
import { distanceInMeters } from '../utils/geo';

type PermissionResult = 'granted' | 'denied' | 'never_ask_again';

if (typeof Geolocation.setRNConfiguration === 'function') {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
    locationProvider: 'auto',
  });
}

async function requestLocationPermission(
  t: (key: string) => string,
): Promise<PermissionResult> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  const hasFine = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  const hasCoarse = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  );

  if (hasFine || hasCoarse) {
    return 'granted';
  }

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  const fine = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const coarse = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

  if (
    fine === PermissionsAndroid.RESULTS.GRANTED ||
    coarse === PermissionsAndroid.RESULTS.GRANTED
  ) {
    return 'granted';
  }

  if (
    fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
    coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
  ) {
    return 'never_ask_again';
  }

  return 'denied';
}

function showPermissionDialog(
  t: (key: string) => string,
  permission: PermissionResult,
) {
  if (permission === 'never_ask_again') {
    Alert.alert(
      t('permissionRequired'),
      `${t(
        'permissionRequiredMessage',
      )} Open app settings to enable location permission.`,
      [
        { text: t('deny'), style: 'cancel' },
        {
          text: t('allow'),
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    );
  } else {
    Alert.alert(t('permissionRequired'), t('permissionRequiredMessage'));
  }
}

function setFromPosition(
  setCurrentLocation: (value: Coordinate | null) => void,
  position: any,
) {
  setCurrentLocation({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
}

function requestInitialLocation(
  setCurrentLocation: (value: Coordinate | null) => void,
) {
  Geolocation.getCurrentPosition(
    position => {
      setFromPosition(setCurrentLocation, position);
    },
    () => {
      // Fallback for devices/emulators where high-accuracy fix is unavailable.
      Geolocation.getCurrentPosition(
        position => {
          setFromPosition(setCurrentLocation, position);
        },
        () => {
          // Keep tracking active and rely on watch updates.
        },
        {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 15000,
        },
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    },
  );
}

function findActiveZone(
  currentLocation: Coordinate | null,
  zones: Zone[],
): Zone | null {
  if (!currentLocation) {
    return null;
  }

  return (
    zones.find(zone => {
      const distance = distanceInMeters(currentLocation, {
        latitude: zone.latitude,
        longitude: zone.longitude,
      });

      return distance <= zone.radiusMeters;
    }) ?? null
  );
}

export function useLiveLocation(zones: Zone[] = RED_ZONES) {
  const { t } = useI18n();
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(
    null,
  );
  const [isTracking, setIsTracking] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(
    Platform.OS !== 'android',
  );
  const [permissionStatus, setPermissionStatus] = useState<
    PermissionResult | 'unknown'
  >(Platform.OS !== 'android' ? 'granted' : 'unknown');
  const [lastAlertMessage, setLastAlertMessage] = useState(t('noBreach'));
  const [notifiedZoneId, setNotifiedZoneId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!notifiedZoneId) {
      setLastAlertMessage(t('noBreach'));
    }
  }, [notifiedZoneId, t]);

  const activeZone = useMemo(
    () => findActiveZone(currentLocation, zones.length > 0 ? zones : RED_ZONES),
    [currentLocation, zones],
  );

  useEffect(() => {
    if (
      !activeZone ||
      activeZone.severity !== 'red' ||
      notifiedZoneId === activeZone.id
    ) {
      return;
    }

    const message = t('alertMessage', { zone: activeZone.label });

    setNotifiedZoneId(activeZone.id);
    setLastAlertMessage(message);
    Alert.alert(t('redZoneEntered'), message);

    void notifyEscalation({
      message,
      zoneId: activeZone.id,
      zoneLabel: activeZone.label,
      timestamp: new Date().toISOString(),
      location: currentLocation ?? { latitude: 0, longitude: 0 },
    }).catch(() => {
      // Keep app stable even if escalation endpoint is down.
    });
  }, [activeZone, currentLocation, notifiedZoneId, t]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const startTracking = useCallback(async () => {
    const permission = await requestLocationPermission(t);

    if (permission !== 'granted') {
      setHasLocationPermission(false);
      setPermissionStatus(permission);
      showPermissionDialog(t, permission);

      return;
    }

    setHasLocationPermission(true);
    setPermissionStatus('granted');

    if (watchIdRef.current !== null) {
      return;
    }

    requestInitialLocation(setCurrentLocation);

    setIsTracking(true);
    watchIdRef.current = Geolocation.watchPosition(
      position => {
        setFromPosition(setCurrentLocation, position);
      },
      () => {
        // Do not stop tracking. Some devices may intermittently fail high-accuracy GPS.
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        timeout: 15000,
        maximumAge: 5000,
        interval: 3000,
        fastestInterval: 2000,
      },
    );
  }, [t]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(false);
    setNotifiedZoneId(null);
  }, []);

  return {
    currentLocation,
    isTracking,
    hasLocationPermission,
    permissionStatus,
    activeZone,
    lastAlertMessage,
    startTracking,
    stopTracking,
  };
}
