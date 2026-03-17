import { useContext, useEffect, useRef, useState } from "react";
import AppContext from "../../../contexts/appContext";
import styles from "./AdminsDashboard.module.css";
import MapComponent from "./MapComponent";

import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { calculateDistance, checkAuth, formatDistance } from "../../utils";
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
  const roomUserIdsRef = useRef<string[]>([]);
  const warnedOutsideUserIdsRef = useRef<Set<string>>(new Set());
  const bestAccuracyRef = useRef<number | null>(null);
  const currentAdminId = JSON.parse(localStorage.getItem("userObject") || "{}")?.id || "";

  const updateGeofenceRadius = (value: number) => {
    const safeValue = Number.isNaN(value) ? 200 : value;
    setGeofenceRadius(Math.min(5000, Math.max(50, safeValue)));
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
        const nextAccuracy = pos.coords.accuracy;
        const bestAccuracy = bestAccuracyRef.current;
        const isClearlyWorseReading =
          typeof nextAccuracy === "number" &&
          typeof bestAccuracy === "number" &&
          nextAccuracy > Math.max(bestAccuracy * 3, 1000);

        if (isClearlyWorseReading) {
          return;
        }

        bestAccuracyRef.current =
          typeof nextAccuracy === "number"
            ? bestAccuracy === null
              ? nextAccuracy
              : Math.min(bestAccuracy, nextAccuracy)
            : bestAccuracy;

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
        maximumAge: 0,
        timeout: 10000,
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
    roomUserIdsRef.current = userIds;

    if (!userIds.length) {
      setUsers([]);
      setUsersLocation([]);
      return;
    }

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
            if (
              !changedUserId ||
              !roomUserIdsRef.current.includes(changedUserId)
            ) {
              return;
            }

            await getUserLocation(roomUserIdsRef.current);
          }
        )
        .subscribe();
    };

    fetchData();

    return () => {
      if (memberSubscription) memberSubscription.unsubscribe();
      if (userLocationSubscription) userLocationSubscription.unsubscribe();
    };
  }, [navigate, room_code, supabase]);

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
  const memberCount = liveUsersLocation.length + 1;
  const selectedMember = visibleUsersWithLocation.find(
    (entry) => entry.user.id === selectedMemberId
  );

  const handleSendMessage = () => {
    const trimmedMessage = memberMessage.trim();
    if (!selectedMemberId || !trimmedMessage) {
      toast.error("Select a member and enter a message.");
      return;
    }

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
    if (!selectedMemberId) return;

    const isSelectedMemberVisible = visibleUsersWithLocation.some(
      (entry) => entry.user.id === selectedMemberId
    );

    if (!isSelectedMemberVisible) {
      setSelectedMemberId("");
      setMemberMessage("");
    }
  }, [selectedMemberId, visibleUsersWithLocation]);

  useEffect(() => {
    const currentOutsideUserIds = new Set(outsideUsers.map((entry) => entry.user.id));

    outsideUsers.forEach((entry) => {
      if (warnedOutsideUserIdsRef.current.has(entry.user.id)) return;

      toast.error(`${entry.user.name} is outside the geofence.`);
      warnedOutsideUserIdsRef.current.add(entry.user.id);

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

    Array.from(warnedOutsideUserIdsRef.current).forEach((userId) => {
      if (currentOutsideUserIds.has(userId)) return;

      const matchingEntry = visibleUsersWithLocation.find(
        (entry) => entry.user.id === userId
      );
      if (matchingEntry && !matchingEntry.isOutside) {
        warnedOutsideUserIdsRef.current.delete(userId);
      }
    });
  }, [outsideUsers, room_code, visibleUsersWithLocation]);

  return (
    <div className={styles.themeContainer}>
      <div className={styles.adminDashboardContainer}>
        <section className={styles.heroCard}>
          <div>
            <div className={styles.brandRow}>
              <img src="/logo_no_bg.png" alt="Vantage logo" className={styles.brandLogo} />
              <div>
                <p className={styles.brandName}>Vantage</p>
                <p className={styles.brandTag}>Admin control room</p>
              </div>
            </div>

            <div className={styles.heroEyebrow}>Live oversight</div>
            <h1 className={styles.heroTitle}>Manage the room without losing the visual clarity.</h1>
            <p className={styles.heroSubtitle}>
              Keep geofence control, member presence, and live location updates in one dashboard that matches the rest of the product.
            </p>

            <div className={styles.heroMetrics}>
              <div className={styles.metricCard}>
                <p className={styles.metricValue}>{memberCount}</p>
                <p className={styles.statLabel}>Active members tracked right now.</p>
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricValue}>{geofenceRadius} m</p>
                <p className={styles.statLabel}>Current geofence radius shared to participants.</p>
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricValue}>{outsideUsers.length}</p>
                <p className={styles.statLabel}>Members currently outside the fence.</p>
              </div>
            </div>
          </div>

          <div className={styles.roomInformation}>
            <div className={styles.roomHeading}>
              <div>
                <p className={styles.roomCodeLabel}>Room overview</p>
                <p className={styles.roomName}>Room {room_code}</p>
                <p className={styles.roomCode}>Realtime admin dashboard</p>
              </div>
            </div>

            <div className={styles.roomDetails}>
              <div className={styles.roomDetailBlock}>
                <p className={styles.roomDetailHeading}>Members online</p>
                <p className={styles.roomDetailValue}>{liveUsersLocation.length}</p>
              </div>
              <div className={styles.roomDetailBlock}>
                <p className={styles.roomDetailHeading}>Admin location</p>
                <p className={styles.roomDetailValue}>{position ? "Live" : "Waiting"}</p>
              </div>
              <div className={styles.roomDetailBlock}>
                <p className={styles.roomDetailHeading}>Fence center</p>
                <p className={styles.roomDetailValue}>{geofenceCenter ? "Synced" : "Not set"}</p>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.dashboard}>
          <div className={styles.leftSideContainer}>
            <section className={styles.controlCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionEyebrow}>Member panel</div>
                  <h2 className={styles.sectionTitle}>Nearby members</h2>
                  <p className={styles.sectionSubtitle}>
                    Search live members, adjust the geofence, and message anyone in the room.
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
                placeholder="Search members"
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className={styles.geofenceControlContainer}>
                <div className={styles.geofenceControlHeader}>
                  <p className={styles.geofenceTitle}>Geofence radius</p>
                  <p className={styles.geofenceValue}>{geofenceRadius} m</p>
                </div>

                <input
                  type="range"
                  min={50}
                  max={5000}
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
                    Radius in meters
                  </label>
                  <input
                    id="geofence-radius-input"
                    type="number"
                    min={50}
                    max={5000}
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
                <p className={styles.messageComposerTitle}>Send a message</p>
                <p className={styles.memberSelectHint}>
                  {selectedMember
                    ? `Messaging ${selectedMember.user.name}`
                    : "Select a member card below to start writing."}
                </p>
                <textarea
                  className={styles.memberMessageInput}
                  placeholder={
                    selectedMember
                      ? `Send a note to ${selectedMember.user.name}...`
                      : "Select a member card below first..."
                  }
                  value={memberMessage}
                  onChange={(e) => setMemberMessage(e.target.value)}
                  rows={3}
                  disabled={!selectedMember}
                />
                <button
                  type="button"
                  className={styles.sendMessageButton}
                  onClick={handleSendMessage}
                  disabled={!selectedMember}
                >
                  Send message
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
                      {entry.user.name} is {formatDistance(entry.distanceFromGeofenceCenter || 0)}
                      {" "}from the geofence center.
                    </p>
                  ))}
                </div>
              )}

              <div className={styles.nearbyStudentList}>
                {visibleUsersWithLocation.length > 0 ? visibleUsersWithLocation.map(({ user, location, distanceFromAdmin, isOutside }) => {
                  return (
                    <button
                      type="button"
                      key={user.id}
                      className={`${styles.nearbyStudent} ${
                        isOutside ? styles.nearbyStudentOutside : ""
                      } ${
                        selectedMemberId === user.id ? styles.nearbyStudentSelected : ""
                      }`}
                      onClick={() => setSelectedMemberId(user.id)}
                    >
                      <div className={styles.memberIdentity}>
                        <div className={styles.userImageContainer}>
                          <p className={styles.userImage}>
                            {user.name?.slice(0, 1)?.toUpperCase() || "M"}
                          </p>
                        </div>

                        <div>
                          <p className={styles.memberName}>{user.name}</p>
                          <p className={styles.memberEmail}>{user.email}</p>
                          <p className={styles.memberPhone}>{user.phone}</p>
                          <div className={styles.memberStatusRow}>
                            <p
                              className={
                                isOutside ? styles.statusOutside : styles.statusInside
                              }
                            >
                              {isOutside ? "Outside geofence" : "Inside geofence"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {position && (
                        <div className={styles.studentLocationData}>
                          <p className={styles.studentLocation}>
                            <ReactTimeAgo
                              date={location.updated_at}
                              locale="en-US"
                            />
                          </p>

                          <p className={styles.studentLocationValue}>
                            {formatDistance(distanceFromAdmin || 0)}
                          </p>
                          <p className={styles.memberMeta}>from you</p>
                        </div>
                      )}
                    </button>
                  );
                }) : (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateTitle}>No live members found</p>
                    <p className={styles.emptyStateText}>
                      Members appear here once their live location is available and matches your search.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className={styles.mapCard}>
            <div className={styles.mapCardHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Live map</div>
                <h2 className={styles.sectionTitle}>Spatial view of your room</h2>
                <p className={styles.sectionSubtitle}>
                  Satellite map with the admin position, participant locations, and the current geofence.
                </p>
              </div>
            </div>

            <div className={styles.mapContainer}>
              <MapComponent
                usersLocation={formattedUsersLocation}
                position={position}
                geofenceCenter={geofenceCenter}
                geofenceRadius={geofenceRadius}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminsDashboard;
