import { useContext, useEffect, useRef, useState } from "react";
import styles from "./UsersDashboard.module.css";
import AppContext from "../../../contexts/appContext";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { checkAuth, convertTimestamp, getFormattedDate } from "../../utils";
import Navbar from "../../../components/Navbar/Navbar";
import Footer from "../../../components/Footer/Footer";
import UserMiniMap from "./UserMiniMap";

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

    const { room_code } = useParams();

    const updateLocation = async (showToast = true) => {
        if (!supabase) return;
        const userEmail = JSON.parse(localStorage.getItem("userObject")!).email;
        const userId = JSON.parse(localStorage.getItem("userObject")!).id;
        userIdRef.current = userId;

        if (!latitude || !longitude) return;

        const { error } = await supabase
            .from("user_location")
            .update({
                user_id: userId,
                latitude: latitude,
                longitude: longitude,
                email: userEmail,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

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
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
            },
            (error) => {
                console.error("Error getting user location:", error.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [supabase]);

    useEffect(() => {
        if (!latitude || !longitude) return;

        updateLocation(false);

        const intervalId = window.setInterval(() => {
            updateLocation(false);
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

                toast.error(nextNotification.message);
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
                <Navbar />
                <div className={styles.userDashboardContainer}>
                    <div className={styles.userProfileContainer}>
                        <div className={styles.userProfile}>
                            <img src="https://via.placeholder.com/75" alt="user" />
                            {userData && (
                                <div className={styles.userProileTexts}>
                                    <p className={styles.userName}>{userData?.full_name}</p>
                                    <p className={styles.userEmail}>{userData?.email}</p>
                                    <p className={styles.userPhone}>
                                        {userData?.phone_number || "No Phone Number Provided"}
                                    </p>
                                </div>
                            )}
                        </div>
                        {adminData && (
                            <div
                                className={styles.adminContainer}
                                style={{
                                    textAlign: "right",
                                }}
                            >
                                <p className={styles.adminName}>Admin Info</p>
                                <p className={styles.adminHeading}>{adminData.full_name}</p>
                                <p className={styles.userEmail}>{adminData.email}</p>
                                <p className={styles.userEmail}>{adminData.phone_number}</p>
                            </div>
                        )}
                    </div>
                    <div className={styles.userLocationContainer}>
                        <div className={styles.userLocation}>
                            <p className={styles.lastUpdated}>Last Updated: {lastUpdated}</p>
                            <p className={styles.locationHeading}>Update Location</p>

                            {notifications.length > 0 && (
                                <div className={styles.warningBanner}>
                                    {notifications[0].message}
                                </div>
                            )}

                            <button
                                onClick={() => updateLocation(true)}
                                className={styles.updateLocationButton}
                            >
                                Update Location
                            </button>
                        </div>

                        <div className={styles.userMiniMapCard}>
                            <p className={styles.userMiniMapHeading}>Live Map</p>
                            <p className={styles.userMiniMapSubtext}>
                                Your location, the admin, and your geofence
                            </p>
                            <div className={styles.userMiniMap}>
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
                    </div>
                    <div className={styles.notificationsContainer}>
                        <p className={styles.notificationsHeading}>Notifications</p>
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
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default UsersDashboard;
