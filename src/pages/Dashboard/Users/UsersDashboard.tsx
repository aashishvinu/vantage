import { useContext, useEffect, useRef, useState } from "react";
import styles from "./UsersDashboard.module.css";
import AppContext from "../../../contexts/appContext";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { checkAuth, convertTimestamp, getFormattedDate } from "../../utils";
import Footer from "../../../components/Footer/Footer";
import UserMiniMap from "./UserMiniMap";
import avatar3d from "../../../assets/avatar-3d.svg";

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

const UsersDashboard = () => {
    const { supabase } = useContext(AppContext);
    const [userData, setUserData] = useState<any>();
    const [adminData, setAdminData] = useState<any>();
    const [adminLocation, setAdminLocation] = useState<[number, number] | null>(null);
    const [geofenceCenter, setGeofenceCenter] = useState<[number, number] | null>(null);
    const [geofenceRadius, setGeofenceRadius] = useState(200);
    const navigate = useNavigate();
    const [latitude, setLatitude] = useState(0);
    const [longitude, setLongitude] = useState(0);
    const [lastUpdated, setLastUpdated] = useState("");
    const [notifications, setNotifications] = useState<
        { id: string; message: string; createdAt: string; type: "warning" | "info" }[]
    >([]);
    const userIdRef = useRef("");
    const adminUserIdRef = useRef("");
    const hasShownOutsideToastRef = useRef(false);
    const bestAccuracyRef = useRef<number | null>(null);

    const { room_code } = useParams();

    const updateLocation = async (showToast = true, nextLatitude?: number, nextLongitude?: number) => {
        if (!supabase) return;
        const userEmail = JSON.parse(localStorage.getItem("userObject")!).email;
        const userId = JSON.parse(localStorage.getItem("userObject")!).id;
        userIdRef.current = userId;

        const latitudeToUse = nextLatitude ?? latitude;
        const longitudeToUse = nextLongitude ?? longitude;

        if (!latitudeToUse || !longitudeToUse) return;

        const { error } = await supabase
            .from("user_location")
            .upsert(
                {
                    user_id: userId,
                    latitude: latitudeToUse,
                    longitude: longitudeToUse,
                    email: userEmail,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "user_id",
                }
            );

        if (error) {
            if (showToast) {
                toast.error("Error updating user location. Please try again.");
            }
        } else {
            if (showToast) {
                toast.success("Location updated successfully!");
            }

            setLastUpdated(getFormattedDate());
        }
    };

    const getUser = async () => {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            toast.error("Error fetching user data");
        } else {
            setUserData(data.user.user_metadata);
            userIdRef.current = data.user.id;
        }

        const { data: roomData, error: roomError } = await supabase
            .from("rooms")
            .select("admin_user_id")
            .eq("room_code", room_code)
            .single();
        if (roomError) {
            console.error("Error fetching room data:", roomError);
            return;
        }
        adminUserIdRef.current = roomData.admin_user_id;
        const { data: adminData, error: adminError } = await supabase
            .from("users")
            .select("*")
            .eq("id", roomData.admin_user_id);
        if (adminError) {
            console.error("Error fetching admin data:", adminError);
            return;
        }
        setAdminData(adminData[0].raw_user_meta_data);

        const { data: adminLocationData, error: adminLocationError } = await supabase
            .from("user_location")
            .select("latitude, longitude")
            .eq("user_id", roomData.admin_user_id)
            .single();

        if (adminLocationError) {
            console.error("Error fetching admin location:", adminLocationError);
            return;
        }

        if (adminLocationData) {
            setAdminLocation([
                adminLocationData.latitude,
                adminLocationData.longitude,
            ]);
        }
    };
    useEffect(() => {
        checkAuth({ navigate, toast });
        getUser();

        if (!navigator.geolocation) {
            console.error("Geolocation is not supported by this browser.");
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const nextAccuracy = position.coords.accuracy;
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

                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
            },
            (error) => {
                console.error("Error getting user location:", error.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [supabase]);

    useEffect(() => {
        if (!latitude || !longitude) return;

        updateLocation(false, latitude, longitude);

        const intervalId = window.setInterval(() => {
            updateLocation(false, latitude, longitude);
        }, 15000);

        return () => window.clearInterval(intervalId);
    }, [latitude, longitude]);

    useEffect(() => {
        if (!supabase || !room_code) return;

        const geofenceAlertChannel = supabase
            .channel(`geofence-alerts:${room_code}`)
            .on("broadcast", { event: "geofence-warning" }, ({ payload }) => {
                if (payload?.targetUserId !== userIdRef.current) return;

                const nextNotification = {
                    id: `${payload.createdAt}-${payload.targetUserId}`,
                    message:
                        payload.message ||
                        "You are outside the geofence. Please come back inside the fence.",
                    createdAt: payload.createdAt || new Date().toISOString(),
                    type: "warning" as const,
                };

                setNotifications((currentNotifications) => {
                    if (
                        currentNotifications.some(
                            (notification) => notification.id === nextNotification.id
                        )
                    ) {
                        return currentNotifications;
                    }

                    return [nextNotification, ...currentNotifications].slice(0, 10);
                });

                if (!hasShownOutsideToastRef.current) {
                    toast.error(nextNotification.message);
                    hasShownOutsideToastRef.current = true;
                }
            })
            .subscribe();

        return () => {
            geofenceAlertChannel.unsubscribe();
        };
    }, [room_code, supabase]);

    useEffect(() => {
        if (!supabase || !room_code) return;

        const memberMessageChannel = supabase
            .channel(`member-messages:${room_code}`)
            .on("broadcast", { event: "member-message" }, ({ payload }) => {
                if (payload?.targetUserId !== userIdRef.current) return;

                const nextNotification = {
                    id: `${payload.createdAt}-${payload.targetUserId}-message`,
                    message: payload.message || "You received a message from the admin.",
                    createdAt: payload.createdAt || new Date().toISOString(),
                    type: "info" as const,
                };

                setNotifications((currentNotifications) => {
                    if (
                        currentNotifications.some(
                            (notification) => notification.id === nextNotification.id
                        )
                    ) {
                        return currentNotifications;
                    }

                    return [nextNotification, ...currentNotifications].slice(0, 10);
                });

                toast.success(`Admin: ${nextNotification.message}`);
            })
            .subscribe();

        return () => {
            memberMessageChannel.unsubscribe();
        };
    }, [room_code, supabase]);

    useEffect(() => {
        if (!supabase || !room_code) return;

        const geofenceStateChannel = supabase
            .channel(`geofence-state:${room_code}`)
            .on("broadcast", { event: "geofence-sync" }, ({ payload }) => {
                if (
                    typeof payload?.center?.latitude !== "number" ||
                    typeof payload?.center?.longitude !== "number"
                ) {
                    return;
                }

                setGeofenceCenter([
                    payload.center.latitude,
                    payload.center.longitude,
                ]);

                if (typeof payload?.radius === "number") {
                    setGeofenceRadius(payload.radius);
                }
            })
            .subscribe();

        return () => {
            geofenceStateChannel.unsubscribe();
        };
    }, [room_code, supabase]);

    useEffect(() => {
        if (!adminLocation || geofenceCenter) return;

        setGeofenceCenter(adminLocation);
    }, [adminLocation, geofenceCenter]);

    const distanceFromGeofenceCenter =
        latitude &&
        longitude &&
        geofenceCenter
            ? getDistanceInMeters(
                  latitude,
                  longitude,
                  geofenceCenter[0],
                  geofenceCenter[1]
              )
            : null;

    const isOutsideGeofence =
        distanceFromGeofenceCenter !== null
            ? distanceFromGeofenceCenter > geofenceRadius
            : false;

    useEffect(() => {
        if (!isOutsideGeofence) {
            hasShownOutsideToastRef.current = false;
            return;
        }

        if (hasShownOutsideToastRef.current) return;

        toast.error("You are outside the geofence. Please come back inside the fence.");
        hasShownOutsideToastRef.current = true;
    }, [isOutsideGeofence]);

    useEffect(() => {
        if (!supabase || !room_code || !adminUserIdRef.current) return;

        const adminLocationChannel = supabase
            .channel(`admin-location:${room_code}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "user_location",
                    filter: `user_id=eq.${adminUserIdRef.current}`,
                },
                async (payload) => {
                    const nextRow = payload.new as
                        | { latitude?: number; longitude?: number }
                        | null;

                    if (
                        typeof nextRow?.latitude === "number" &&
                        typeof nextRow?.longitude === "number"
                    ) {
                        setAdminLocation([nextRow.latitude, nextRow.longitude]);
                    }
                }
            )
            .subscribe();

        return () => {
            adminLocationChannel.unsubscribe();
        };
    }, [room_code, supabase]);

    return (
        <>
            <div className={styles.themeContainer}>
                <div className={styles.userDashboardContainer}>
                    <section className={styles.heroCard}>
                        <div>
                            <div className={styles.brandRow}>
                                <img src="/logo_no_bg.png" alt="Vantage logo" className={styles.brandLogo} />
                                <div>
                                    <p className={styles.brandName}>Vantage</p>
                                    <p className={styles.brandTag}>Member dashboard</p>
                                </div>
                            </div>

                            <div className={styles.heroEyebrow}>Live participant view</div>
                            <h1 className={styles.heroTitle}>Stay synced with your room and your boundary.</h1>
                            <p className={styles.heroSubtitle}>
                                See your admin contact, current geofence state, and live map details in the same visual language as the landing flow.
                            </p>

                            <div className={styles.heroStats}>
                                <div className={styles.statCard}>
                                    <p className={styles.statValue}>{room_code}</p>
                                    <p className={styles.metaText}>Current room code.</p>
                                </div>
                                <div className={styles.statCard}>
                                    <p className={styles.statValue}>{geofenceRadius} m</p>
                                    <p className={styles.metaText}>Shared geofence radius.</p>
                                </div>
                                <div className={styles.statCard}>
                                    <p className={styles.statValue}>{notifications.length}</p>
                                    <p className={styles.metaText}>Recent notifications in your feed.</p>
                                </div>
                            </div>
                        </div>

                        <div className={styles.userProfileContainer}>
                            {userData && (
                                <div className={styles.profileCard}>
                                    <img src={avatar3d} alt="3D avatar" className={styles.profileAvatar} />
                                    <div className={styles.userProileTexts}>
                                        <div className={styles.identityTag}>Your profile</div>
                                        <p className={styles.userName}>{userData?.full_name}</p>
                                        <p className={styles.userEmail}>{userData?.email}</p>
                                        <p className={styles.userPhone}>
                                            {userData?.phone_number || "No Phone Number Provided"}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {adminData && (
                                <div className={styles.profileCard}>
                                    <img src={avatar3d} alt="3D avatar" className={styles.profileAvatar} />
                                    <div className={styles.adminDetails}>
                                        <div className={styles.identityTag}>Admin contact</div>
                                        <p className={styles.adminHeading}>{adminData.full_name}</p>
                                        <p className={styles.adminName}>{adminData.email}</p>
                                        <p className={styles.userPhone}>{adminData.phone_number || "No Phone Number Provided"}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <div className={styles.mainGrid}>
                        <div className={styles.stack}>
                            <section className={styles.surfaceCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardEyebrow}>Location status</div>
                                    <h2 className={styles.cardTitle}>Keep your position current</h2>
                                    <p className={styles.cardSubtitle}>
                                        Refresh your live coordinates and check whether you are still inside the active boundary.
                                    </p>
                                </div>

                                <div className={styles.statusPanel}>
                                    <p className={styles.lastUpdated}>
                                        Last updated: {lastUpdated || "Waiting for first sync"}
                                    </p>

                                    {notifications.length > 0 && (
                                        <div className={styles.warningBanner}>
                                            {notifications[0].message}
                                        </div>
                                    )}

                                    <div
                                        className={`${styles.geofenceStatus} ${
                                            isOutsideGeofence
                                                ? styles.geofenceStatusOutside
                                                : styles.geofenceStatusInside
                                        }`}
                                    >
                                        {isOutsideGeofence
                                            ? "Outside geofence"
                                            : "Inside geofence"}
                                    </div>

                                    <div className={styles.statsRow}>
                                        <div className={styles.smallStat}>
                                            <p className={styles.smallStatLabel}>Room</p>
                                            <p className={styles.smallStatValue}>{room_code}</p>
                                        </div>
                                        <div className={styles.smallStat}>
                                            <p className={styles.smallStatLabel}>Fence radius</p>
                                            <p className={styles.smallStatValue}>{geofenceRadius} meters</p>
                                        </div>
                                        <div className={styles.smallStat}>
                                            <p className={styles.smallStatLabel}>Admin location</p>
                                            <p className={styles.smallStatValue}>{adminLocation ? "Connected" : "Waiting for sync"}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => updateLocation(true)}
                                        className={styles.updateLocationButton}
                                    >
                                        Update location now
                                    </button>
                                </div>
                            </section>
                        </div>

                        <section className={styles.surfaceCard}>
                            <div className={styles.mapCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardEyebrow}>Live map</div>
                                    <h2 className={styles.cardTitle}>Your room on the map</h2>
                                    <p className={styles.cardSubtitle}>
                                        Compare your position with the admin and the shared geofence in one glance.
                                    </p>
                                </div>

                                <div className={styles.mapMetaBar}>
                                    <div className={styles.mapMetaChip}>
                                        {latitude && longitude ? "Your location live" : "Waiting for your location"}
                                    </div>
                                    <div className={styles.mapMetaChip}>
                                        {adminLocation ? "Admin location live" : "Admin location unavailable"}
                                    </div>
                                    <div className={styles.mapMetaChip}>
                                        {geofenceCenter ? "Geofence synced" : "Using admin location as fallback"}
                                    </div>
                                </div>

                                <div className={styles.userMiniMapCard}>
                                    <UserMiniMap
                                        userPosition={
                                            latitude && longitude ? [latitude, longitude] : null
                                        }
                                        adminPosition={adminLocation}
                                        geofenceCenter={geofenceCenter || adminLocation}
                                        geofenceRadius={geofenceRadius}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className={`${styles.notificationCard} ${styles.notificationsContainer}`}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardEyebrow}>Notifications</div>
                            <h2 className={styles.cardTitle}>Recent room updates</h2>
                            <p className={styles.cardSubtitle}>
                                Warning alerts and admin messages appear here in a cleaner activity feed.
                            </p>
                        </div>

                        <div className={styles.notifications}>
                            {notifications.length > 0 ? (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`${styles.notification} ${
                                            notification.type === "warning"
                                                ? styles.warningNotification
                                                : styles.infoNotification
                                        }`}
                                    >
                                        <p className={styles.notificationText}>
                                            {notification.message}
                                        </p>
                                        <p className={styles.notificationTime}>
                                            {convertTimestamp(notification.createdAt)}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.notification}>
                                    <p className={styles.notificationText}>
                                        No geofence alerts right now.
                                    </p>
                                    <p className={styles.notificationTime}>Live feed standing by</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default UsersDashboard;
