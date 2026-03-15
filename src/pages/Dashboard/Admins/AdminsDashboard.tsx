import { useContext, useEffect, useRef, useState } from "react";
import AppContext from "../../../contexts/appContext";
import styles from "./AdminsDashboard.module.css";
import MapComponent from "./MapComponent";

import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { calculateDistance, checkAuth } from "../../utils";
import Navbar from "../../../components/Navbar/Navbar";
import ReactTimeAgo from "react-time-ago";

const LIVE_LOCATION_WINDOW_MS = 60 * 1000;

const isLiveLocation = (updatedAt?: string) => {
  if (!updatedAt) return false;

  const updatedTime = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTime)) return false;

  return Date.now() - updatedTime <= LIVE_LOCATION_WINDOW_MS;
};

const getDistanceInMeters = (
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number
) => {
  const earthRadiusInMeters = 6371000;
  const dLat = ((latitude - centerLatitude) * Math.PI) / 180;
  const dLng = ((longitude - centerLongitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((centerLatitude * Math.PI) / 180) *
      Math.cos((latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusInMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const AdminsDashboard = () => {
  const { supabase } = useContext(AppContext);
  const { room_code } = useParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState<any[]>([]);
  const [usersLocation, setUsersLocation] = useState<any[]>([]);
  const [roomUserIds, setRoomUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [geofenceCenter, setGeofenceCenter] = useState<[number, number] | null>(null);
  const [geofenceRadius, setGeofenceRadius] = useState(200);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const geofenceAlertChannelRef = useRef<any>(null);
  const geofenceStateChannelRef = useRef<any>(null);
  const memberMessageChannelRef = useRef<any>(null);
  const previousOutsideUserIdsRef = useRef<string[]>([]);
  const currentAdminId = JSON.parse(localStorage.getItem("userObject") || "{}")?.id || "";

  const updateGeofenceRadius = (value: number) => {
    const safeValue = Number.isNaN(value) ? 200 : value;
    setGeofenceRadius(Math.min(2000, Math.max(50, safeValue)));
  };

  const updateAdminLocation = async (latitude: number, longitude: number) => {
    if (!supabase) return;

    const userObject = JSON.parse(localStorage.getItem("userObject") || "{}");
    if (!userObject?.id) return;

    const { error } = await supabase
      .from("user_location")
      .upsert(
        {
          user_id: userObject.id,
          latitude,
          longitude,
          email: userObject.email,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      console.error("Error updating admin location:", error);
    }
  };

  useEffect(() => {
    checkAuth({ navigate, toast });

    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        setGeofenceCenter((currentCenter) =>
          currentCenter || [latitude, longitude]
        );
        updateAdminLocation(latitude, longitude);
      },
      (error) => {
        console.error("Error getting location:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [supabase]);

  /* =============================
     FETCH USER LOCATIONS
  ============================== */
  const getUserLocation = async (userIds: string[]) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("user_location")
      .select("*")
      .in("user_id", userIds);

    if (error) {
      toast.error("Error fetching user location");
      return;
    }

    setUsersLocation(data || []);
  };

  /* =============================
     FETCH USERS + LOCATIONS
  ============================== */
  const fetchUsersAndLocations = async (roomId: string) => {
    if (!supabase) return;

    const { data: memberData, error: memberError } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId);

    if (memberError) {
      toast.error("Error fetching room members");
      return;
    }

    const userIds = memberData.map((member) => member.user_id);
    setRoomUserIds(userIds);

    await getUserLocation(userIds);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .in("id", userIds);

    if (userError) {
      toast.error("Error fetching users");
      return;
    }

    setUsers(userData || []);
  };

  /* =============================
     ROOM INIT + REALTIME
  ============================== */
  useEffect(() => {
    if (!supabase) return;

    let memberSubscription: any;
    let userLocationSubscription: any;

    const fetchData = async () => {
      const { data: roomData, error } = await supabase
        .from("rooms")
        .select("id")
        .eq("room_code", room_code)
        .single();

      if (error) {
        toast.error("Room not found");
        navigate("/");
        return;
      }

      const roomId = roomData.id;

      await fetchUsersAndLocations(roomId);

      memberSubscription = supabase
        .channel(`room_members:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "room_members",
            filter: `room_id=eq.${roomId}`,
          },
          async () => {
            await fetchUsersAndLocations(roomId);
            new Audio("/ting.mp3").play();
          }
        )
        .subscribe();

      userLocationSubscription = supabase
        .channel(`user_location:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_location",
          },
          async (payload) => {
            const nextRow = payload.new as { user_id?: string } | null;
            const previousRow = payload.old as { user_id?: string } | null;
            const changedUserId = nextRow?.user_id ?? previousRow?.user_id;
            if (!changedUserId || !roomUserIds.includes(changedUserId)) return;

            await getUserLocation(roomUserIds);
          }
        )
        .subscribe();
    };

    fetchData();

    return () => {
      if (memberSubscription) memberSubscription.unsubscribe();
      if (userLocationSubscription) userLocationSubscription.unsubscribe();
    };
  }, [roomUserIds, room_code, supabase]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setUsersLocation((currentLocations) =>
        currentLocations.filter((location) => isLiveLocation(location.updated_at))
      );
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!supabase || !room_code) return;

    const geofenceAlertChannel = supabase
      .channel(`geofence-alerts:${room_code}`)
      .subscribe();

    geofenceAlertChannelRef.current = geofenceAlertChannel;

    return () => {
      geofenceAlertChannel.unsubscribe();
      geofenceAlertChannelRef.current = null;
    };
  }, [room_code, supabase]);

  useEffect(() => {
    if (!supabase || !room_code) return;

    const memberMessageChannel = supabase
      .channel(`member-messages:${room_code}`)
      .subscribe();

    memberMessageChannelRef.current = memberMessageChannel;

    return () => {
      memberMessageChannel.unsubscribe();
      memberMessageChannelRef.current = null;
    };
  }, [room_code, supabase]);

  useEffect(() => {
    if (!supabase || !room_code) return;

    const geofenceStateChannel = supabase
      .channel(`geofence-state:${room_code}`)
      .subscribe();

    geofenceStateChannelRef.current = geofenceStateChannel;

    return () => {
      geofenceStateChannel.unsubscribe();
      geofenceStateChannelRef.current = null;
    };
  }, [room_code, supabase]);

  useEffect(() => {
    if (!geofenceCenter || !geofenceStateChannelRef.current) return;

    geofenceStateChannelRef.current.send({
      type: "broadcast",
      event: "geofence-sync",
      payload: {
        center: {
          latitude: geofenceCenter[0],
          longitude: geofenceCenter[1],
        },
        radius: geofenceRadius,
        createdAt: new Date().toISOString(),
      },
    });
  }, [geofenceCenter, geofenceRadius]);

  /* =============================
     FORMAT DATA FOR GOOGLE MAP
  ============================== */
  const memberUsers = users.filter((user) => user.id !== currentAdminId);

  const liveUsersLocation = usersLocation.filter(
    (location) =>
      isLiveLocation(location.updated_at) && location.user_id !== currentAdminId
  );

  const formattedUsersLocation =
    liveUsersLocation.length && memberUsers.length
      ? liveUsersLocation
          .map((location) => {
            const user = memberUsers.find((u) => u.id === location.user_id);
            if (!user) return null;

            return {
              id: user.id,
              latitude: location.latitude,
              longitude: location.longitude,
              email: user.email,
            };
          })
          .filter(
            (location): location is {
              id: string;
              latitude: number;
              longitude: number;
              email: string;
            } => Boolean(location)
          )
      : [];

  const visibleUsers = users
    .filter((user) => user.id !== currentAdminId)
    .filter(
      (user) =>
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.name.toLowerCase().includes(search.toLowerCase())
    )
    .filter((user) =>
      liveUsersLocation.some((location) => location.user_id === user.id)
    );

  const visibleUsersWithLocation = visibleUsers
    .map((user) => {
      const location = liveUsersLocation.find((loc) => loc.user_id === user.id);
      if (!location) return null;

      const distanceFromAdmin =
        position && location
          ? calculateDistance(
              {
                latitude: position[0],
                longitude: position[1],
              },
              {
                latitude: location.latitude,
                longitude: location.longitude,
              }
            )
          : null;

      const distanceFromGeofenceCenter =
        geofenceCenter && location
          ? getDistanceInMeters(
              location.latitude,
              location.longitude,
              geofenceCenter[0],
              geofenceCenter[1]
            )
          : null;

      const isOutside =
        distanceFromGeofenceCenter !== null
          ? distanceFromGeofenceCenter > geofenceRadius
          : false;

      return {
        user,
        location,
        distanceFromAdmin,
        distanceFromGeofenceCenter,
        isOutside,
      };
    })
    .filter(
      (
        entry
      ): entry is {
        user: any;
        location: any;
        distanceFromAdmin: number | null;
        distanceFromGeofenceCenter: number | null;
        isOutside: boolean;
      } => Boolean(entry)
    );

  const outsideUsers = visibleUsersWithLocation.filter((entry) => entry.isOutside);

  const handleSendMessage = () => {
    const trimmedMessage = memberMessage.trim();
    if (!selectedMemberId || !trimmedMessage) {
      toast.error("Select a member and enter a message.");
      return;
    }

    const selectedMember = visibleUsersWithLocation.find(
      (entry) => entry.user.id === selectedMemberId
    );

    memberMessageChannelRef.current?.send({
      type: "broadcast",
      event: "member-message",
      payload: {
        targetUserId: selectedMemberId,
        roomCode: room_code,
        senderName: "Admin",
        message: trimmedMessage,
        createdAt: new Date().toISOString(),
      },
    });

    toast.success(
      `Message sent${selectedMember ? ` to ${selectedMember.user.name}` : ""}.`
    );
    setMemberMessage("");
  };

  const handleRefresh = () => {
    const userIds = roomUserIds.length ? roomUserIds : users.map((user) => user.id);
    getUserLocation(userIds);
    toast.success("Data refreshed");
  };

  useEffect(() => {
    const currentOutsideUserIds = outsideUsers.map((entry) => entry.user.id);
    const previousOutsideUserIds = previousOutsideUserIdsRef.current;

    outsideUsers.forEach((entry) => {
      if (previousOutsideUserIds.includes(entry.user.id)) return;

      toast.error(`${entry.user.name} is outside the geofence.`);

      geofenceAlertChannelRef.current?.send({
        type: "broadcast",
        event: "geofence-warning",
        payload: {
          targetUserId: entry.user.id,
          roomCode: room_code,
          message: "You are outside the geofence. Please come back inside the fence.",
          createdAt: new Date().toISOString(),
        },
      });
    });

    previousOutsideUserIdsRef.current = currentOutsideUserIds;
  }, [outsideUsers, room_code]);

  return (
    <div className={styles.adminDashboardContainer}>
      <Navbar />

      <div className={styles.dashboard}>
        <div className={styles.leftSideContainer}>
          <div className={styles.roomInformation}>
            <div className={styles.roomHeading}>
              <p className={styles.roomName}>Room Name</p>
              <p className={styles.roomCode}>{room_code}</p>
            </div>

            <div className={styles.roomDetails}>
              <p>{users.length} Members</p>
            </div>
          </div>

          <div className={styles.nearbyStudentContainer}>
            <div className={styles.nearbyHeading}>
              <div>
                <p className={styles.nearByStudents}>Nearby Members</p>
                <p className={styles.nearBySubText}>
                  list of members near you
                </p>
              </div>

              <button
                className={styles.refreshButton}
                onClick={handleRefresh}
              >
                Refresh
              </button>
            </div>

            <input
              type="text"
              placeholder="Search"
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={styles.geofenceControlContainer}>
              <div className={styles.geofenceControlHeader}>
                <p className={styles.geofenceTitle}>Geofence Radius</p>
                <p className={styles.geofenceValue}>{geofenceRadius} m</p>
              </div>

              <input
                type="range"
                min={50}
                max={2000}
                step={50}
                value={geofenceRadius}
                onChange={(e) =>
                  updateGeofenceRadius(Number(e.target.value))
                }
                className={styles.geofenceSlider}
              />

              <div className={styles.geofenceInputRow}>
                <label
                  htmlFor="geofence-radius-input"
                  className={styles.geofenceInputLabel}
                >
                  Radius (meters)
                </label>
                <input
                  id="geofence-radius-input"
                  type="number"
                  min={50}
                  max={2000}
                  step={50}
                  value={geofenceRadius}
                  onChange={(e) =>
                    updateGeofenceRadius(Number(e.target.value))
                  }
                  className={styles.geofenceNumberInput}
                />
              </div>

              <button
                type="button"
                className={styles.geofenceResetButton}
                onClick={() => {
                  if (!position) return;
                  setGeofenceCenter(position);
                }}
                disabled={!position}
              >
                Set geofence to my current location
              </button>
            </div>

            <div className={styles.messageComposer}>
              <p className={styles.messageComposerTitle}>Send Message</p>
              <select
                className={styles.memberSelect}
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
              >
                <option value="">Select a member</option>
                {visibleUsersWithLocation.map(({ user }) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <textarea
                className={styles.memberMessageInput}
                placeholder="Send a note to this member..."
                value={memberMessage}
                onChange={(e) => setMemberMessage(e.target.value)}
                rows={3}
              />
              <button
                type="button"
                className={styles.sendMessageButton}
                onClick={handleSendMessage}
              >
                Send
              </button>
            </div>

            {outsideUsers.length > 0 && (
              <div className={styles.geofenceAlertPanel}>
                <p className={styles.geofenceAlertTitle}>
                  {outsideUsers.length} member
                  {outsideUsers.length > 1 ? "s are" : " is"} outside the geofence
                </p>
                {outsideUsers.map((entry) => (
                  <p
                    key={entry.user.id}
                    className={styles.geofenceAlertItem}
                  >
                    {entry.user.name} is {Math.round(entry.distanceFromGeofenceCenter || 0)} m
                    from the geofence center
                  </p>
                ))}
              </div>
            )}

            <div className={styles.nearbyStudentList}>
              {visibleUsersWithLocation.map(({ user, location, distanceFromAdmin, isOutside }) => {
                return (
                  <div
                    key={user.id}
                    className={styles.nearbyStudent}
                  >
                    <div>
                      <p>{user.name}</p>
                      <p>{user.email}</p>
                      <p>{user.phone}</p>
                      <p
                        className={
                          isOutside ? styles.statusOutside : styles.statusInside
                        }
                      >
                        {isOutside ? "Outside geofence" : "Inside geofence"}
                      </p>
                    </div>

                    {position && (
                      <div>
                        <p>
                          <ReactTimeAgo
                            date={location.updated_at}
                            locale="en-US"
                          />
                        </p>

                        <p>
                          {(distanceFromAdmin || 0).toFixed(2)}{" "}
                          meters
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* GOOGLE MAP */}
        <div className={styles.mapContainer}>
          <MapComponent
            usersLocation={formattedUsersLocation}
            position={position}
            geofenceCenter={geofenceCenter}
            geofenceRadius={geofenceRadius}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminsDashboard;
