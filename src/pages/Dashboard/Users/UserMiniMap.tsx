import { useEffect, useRef } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { appConfig, configStatus } from "../../../config";

type Props = {
  userPosition: [number, number] | null;
  adminPosition: [number, number] | null;
  geofenceCenter: [number, number] | null;
  geofenceRadius: number;
};

const containerStyle = {
  width: "100%",
  height: "260px",
  borderRadius: "10px",
};

const UserMiniMap = ({
  userPosition,
  adminPosition,
  geofenceCenter,
  geofenceRadius,
}: Props) => {
  const { isLoaded } = useJsApiLoader({
    id: "user-mini-map-script",
    googleMapsApiKey: appConfig.googleMapsApiKey,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const geofenceCircleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();

    if (geofenceCenter) {
      if (!geofenceCircleRef.current) {
        geofenceCircleRef.current = new google.maps.Circle({
          map: mapRef.current,
        });
      }

      geofenceCircleRef.current.setOptions({
        center: {
          lat: geofenceCenter[0],
          lng: geofenceCenter[1],
        },
        radius: geofenceRadius,
        fillColor: "#FF0000",
        fillOpacity: 0.12,
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });

      const geofenceBounds = geofenceCircleRef.current.getBounds();
      if (geofenceBounds) {
        bounds.union(geofenceBounds);
      }
    } else if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setMap(null);
      geofenceCircleRef.current = null;
    }

    if (userPosition) {
      bounds.extend({
        lat: userPosition[0],
        lng: userPosition[1],
      });
    }

    if (adminPosition) {
      bounds.extend({
        lat: adminPosition[0],
        lng: adminPosition[1],
      });
    }

    if (!bounds.isEmpty()) {
      if ((userPosition && adminPosition) || geofenceCenter) {
        mapRef.current.fitBounds(bounds, 56);
      } else {
        mapRef.current.setCenter(
          userPosition
            ? { lat: userPosition[0], lng: userPosition[1] }
            : { lat: adminPosition![0], lng: adminPosition![1] }
        );
        mapRef.current.setZoom(16);
      }
    }
  }, [adminPosition, geofenceCenter, geofenceRadius, isLoaded, userPosition]);

  useEffect(() => {
    return () => {
      geofenceCircleRef.current?.setMap(null);
      geofenceCircleRef.current = null;
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
        userPosition
          ? { lat: userPosition[0], lng: userPosition[1] }
          : adminPosition
            ? { lat: adminPosition[0], lng: adminPosition[1] }
            : undefined
      }
      zoom={15}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      mapTypeId="roadmap"
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        scaleControl: true,
      }}
    >
      {userPosition && (
        <Marker
          position={{ lat: userPosition[0], lng: userPosition[1] }}
          title="Your location"
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          }}
        />
      )}

      {adminPosition && (
        <Marker
          position={{ lat: adminPosition[0], lng: adminPosition[1] }}
          title="Admin location"
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          }}
        />
      )}
    </GoogleMap>
  );
};

export default UserMiniMap;
