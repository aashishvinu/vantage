import { useEffect, useRef } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { appConfig, configStatus } from "../../../config";

type UserLocation = {
  id: string;
  latitude: number;
  longitude: number;
  email: string;
};

type Props = {
  usersLocation: UserLocation[];
  position: [number, number] | null;
  geofenceCenter: [number, number] | null;
  geofenceRadius: number;
};

const containerStyle = {
  width: "100%",
  height: "83vh",
  borderRadius: "10px",
};

const isValid = (lat: unknown, lng: unknown) =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  !isNaN(lat) &&
  !isNaN(lng);

const isOutsideGeofence = (
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radius: number
) => {
  const earthRadiusInMeters = 6371000;
  const dLat = ((lat - centerLat) * Math.PI) / 180;
  const dLng = ((lng - centerLng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((centerLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadiusInMeters * c;

  return distance > radius;
};

const MapComponent = ({
  usersLocation,
  position,
  geofenceCenter,
  geofenceRadius,
}: Props) => {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: appConfig.googleMapsApiKey,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const geofenceCircleRef = useRef<google.maps.Circle | null>(null);
  const lastFittedGeofenceRef = useRef<string | null>(null);

  const myLat = position?.[0];
  const myLng = position?.[1];
  const hasAdminPosition = isValid(myLat, myLng);
  const hasGeofenceCenter = isValid(geofenceCenter?.[0], geofenceCenter?.[1]);
  const geofenceCenterPoint = hasGeofenceCenter
    ? { lat: geofenceCenter![0], lng: geofenceCenter![1] }
    : null;

  useEffect(() => {
    if (!mapRef.current || !position || geofenceCenterPoint) return;

    mapRef.current.panTo({
      lat: position[0],
      lng: position[1],
    });
  }, [geofenceCenterPoint, position]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;

    if (!geofenceCenterPoint) {
      if (geofenceCircleRef.current) {
        geofenceCircleRef.current.setMap(null);
        geofenceCircleRef.current = null;
      }
      lastFittedGeofenceRef.current = null;
      return;
    }

    if (!geofenceCircleRef.current) {
      geofenceCircleRef.current = new google.maps.Circle({
        map: mapRef.current,
      });
    }

    geofenceCircleRef.current.setOptions({
      center: geofenceCenterPoint,
      radius: geofenceRadius,
      fillColor: "#FF0000",
      fillOpacity: 0.15,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
    });

    const geofenceKey = `${geofenceCenterPoint.lat}:${geofenceCenterPoint.lng}:${geofenceRadius}`;
    if (lastFittedGeofenceRef.current !== geofenceKey) {
      const bounds = new google.maps.LatLngBounds();
      const geofenceBounds = geofenceCircleRef.current.getBounds();

      if (geofenceBounds) {
        bounds.union(geofenceBounds);
      }

      if (hasAdminPosition) {
        bounds.extend({ lat: myLat!, lng: myLng! });
      }

      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, 48);
      }

      lastFittedGeofenceRef.current = geofenceKey;
    }
  }, [geofenceCenterPoint, geofenceRadius, hasAdminPosition, isLoaded, myLat, myLng]);

  useEffect(() => {
    if (!hasAdminPosition || !geofenceCenterPoint) return;

    const outside = isOutsideGeofence(
      myLat!,
      myLng!,
      geofenceCenterPoint.lat,
      geofenceCenterPoint.lng,
      geofenceRadius
    );

    if (outside) {
      console.log("Admin left geofence");
    }
  }, [hasAdminPosition, geofenceCenterPoint, geofenceRadius, myLat, myLng]);

  useEffect(() => {
    if (!usersLocation || !geofenceCenterPoint) return;

    usersLocation.forEach((user) => {
      if (!isValid(user.latitude, user.longitude)) return;

      const outside = isOutsideGeofence(
        user.latitude,
        user.longitude,
        geofenceCenterPoint.lat,
        geofenceCenterPoint.lng,
        geofenceRadius
      );

      if (outside) {
        console.log(`${user.email} left geofence`);
      }
    });
  }, [usersLocation, geofenceCenterPoint, geofenceRadius]);

  useEffect(() => {
    return () => {
      if (geofenceCircleRef.current) {
        geofenceCircleRef.current.setMap(null);
        geofenceCircleRef.current = null;
      }
    };
  }, []);

  if (!configStatus.hasGoogleMaps) {
    return <div>Google Maps is unavailable because VITE_GOOGLE_MAPS_API_KEY is missing.</div>;
  }

  if (!isLoaded) {
    return <div>Loading map...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={
        geofenceCenterPoint ||
        (hasAdminPosition ? { lat: myLat!, lng: myLng! } : undefined)
      }
      zoom={15}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      mapTypeId="satellite"
      options={{
        scaleControl: true,
      }}
    >
      {hasAdminPosition && (
        <Marker
          position={{ lat: myLat!, lng: myLng! }}
          title="Your current location"
          zIndex={1000}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          }}
        />
      )}

      {usersLocation?.map((user) =>
        isValid(user.latitude, user.longitude) ? (
          <Marker
            key={user.id}
            position={{
              lat: user.latitude,
              lng: user.longitude,
            }}
            title={user.email}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
            }}
          />
        ) : null
      )}
    </GoogleMap>
  );
};

export default MapComponent;
