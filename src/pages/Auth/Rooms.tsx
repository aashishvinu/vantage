import { useContext, useEffect, useState } from "react";
import AppContext from "../../contexts/appContext";
import styles from "./Login.module.css";
import { PulseLoader } from "react-spinners";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { checkAuth } from "../utils";

const getFreshCoordinates = () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000,
            }
        );
    });

const Rooms = () => {
    const { supabase } = useContext(AppContext);
    const [roomCode, setRoomCode] = useState("");
    const [myRooms, setMyRooms] = useState<any>([]);
    const navigate = useNavigate();

    const [coordinates, setCoordinates] = useState({
        latitude: 0,
        longitude: 0,
    });

    const [loading, setLoading] = useState({
        createRoom: false,
        addUserToRoom: false,
    });

    useEffect(() => {
        checkAuth({ navigate, toast });

        let localCoordinates = {
            latitude: 0,
            longitude: 0,
        };
        navigator.geolocation.getCurrentPosition(
            (position) => {
                localCoordinates = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                setCoordinates(localCoordinates);
            },
            (error) => {
                console.error("Error getting location:", error);
                toast.error("Error getting location. Please try again.");
            }
        );

        getMyRooms();
    }, []);

    const getMyRooms = async () => {
        if (!supabase) return;
        const { data: rooms, error } = await supabase
            .from("rooms")
            .select("room_code")
            .eq("admin_user_id", JSON.parse(localStorage.getItem("userObject")!).id);

        if (error) {
            console.error("Error fetching rooms:", error);
        } else {
            setMyRooms(rooms);
        }
    };

    const createRoom = async () => {
        if (supabase) {
            setLoading({
                createRoom: true,
                addUserToRoom: false,
            });
            const generatedRoomCode = generateRoomCode();
            const { error } = await supabase
                .from("rooms")
                .insert({
                    room_code: generatedRoomCode,
                    admin_user_id: JSON.parse(localStorage.getItem("userObject")!).id,
                })
                .single();

            if (error) {
                console.error("Error creating room:", error);
                toast.error("Error creating room. Please try again.");
            } else {
                toast.success("Room created successfully!");
                navigate("/admin/dashboard/" + generatedRoomCode);
            }

            setLoading({
                createRoom: false,
                addUserToRoom: false,
            });
        }
    };

    const updateLocation = async (nextCoordinates?: { latitude: number; longitude: number }) => {
        if (!supabase) return;

        const userId = JSON.parse(localStorage.getItem("userObject")!).id;
        const latitude = nextCoordinates?.latitude ?? coordinates.latitude;
        const longitude = nextCoordinates?.longitude ?? coordinates.longitude;
        const userData = JSON.parse(localStorage.getItem("userObject")!);

        const { error } = await supabase
            .from("user_location")
            .upsert(
                {
                    user_id: userId,
                    latitude,
                    longitude,
                    email: userData.email,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "user_id",
                }
            );

        if (error) {
            toast.error("Error updating user location. Please try again.");
        }
    };

    const addUserToRoom = async () => {
        const normalizedRoomCode = roomCode.trim();

        if (!normalizedRoomCode) {
            toast.error("Please enter a room code.");
            return;
        }

        if (!supabase) return;
        setLoading({
            createRoom: false,
            addUserToRoom: true,
        });
        const { data: rooms, error: roomError } = await supabase
            .from("rooms")
            .select("id")
            .eq("room_code", normalizedRoomCode)
            .single();

        if (roomError) {
            toast.error("Error retrieving room. Please try again.");
            setLoading({
                createRoom: false,
                addUserToRoom: false,
            });
            return;
        }

        const roomId = rooms.id;
        const userId = JSON.parse(localStorage.getItem("userObject")!).id;

        let latestCoordinates = coordinates;
        try {
            latestCoordinates = await getFreshCoordinates();
            setCoordinates(latestCoordinates);
        } catch (error) {
            console.error("Error getting fresh location:", error);
        }

        const { data: existingMembership, error: existingMembershipError } = await supabase
            .from("room_members")
            .select("room_id")
            .eq("room_id", roomId)
            .eq("user_id", userId)
            .maybeSingle();

        if (existingMembershipError) {
            console.error("Error checking room membership:", existingMembershipError);
            toast.error("Error checking room membership. Please try again.");
            setLoading({
                createRoom: false,
                addUserToRoom: false,
            });
            return;
        }

        if (existingMembership) {
            await updateLocation(latestCoordinates);
            navigate("/user/dashboard/" + normalizedRoomCode);
            setLoading({
                createRoom: false,
                addUserToRoom: false,
            });
            return;
        }

        const { error: membershipError } = await supabase
            .from("room_members")
            .insert({
                room_id: roomId,
                user_id: userId,
            });

        if (membershipError) {
            if (membershipError.code === "23505") {
                await updateLocation(latestCoordinates);
                navigate("/user/dashboard/" + normalizedRoomCode);
            } else {
                console.error("Error adding user to room:", membershipError);
                toast.error("Error adding user to room. Please try again.");
            }
        } else {
            toast.success("User added to room successfully!");
            await updateLocation(latestCoordinates);
            navigate("/user/dashboard/" + normalizedRoomCode);
        }

        setLoading({
            createRoom: false,
            addUserToRoom: false,
        });
    };

    const generateRoomCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    return (
        <div className={styles.themeContainer}>
            <div className={styles.roomsLayout}>
                <section className={styles.roomsManagerCard}>
                    <div className={styles.brandRow}>
                        <img src="/logo_no_bg.png" alt="Vantage logo" className={styles.brandLogo} />
                        <div>
                            <p className={styles.brandName}>Vantage</p>
                            <p className={styles.brandTag}>Room management</p>
                        </div>
                    </div>

                    <div className={styles.formEyebrow}>Room manager</div>
                    <h1 className={styles.authHeader}>Create a room or join an existing one</h1>
                    <p className={styles.authSubHeader}>
                        Keep the important actions in one place. Start a new room or enter a code to join one instantly.
                    </p>

                    <div className={styles.formContainer}>
                        <button className={styles.authButton} onClick={createRoom}>
                            Create room
                            <PulseLoader loading={loading.createRoom} color="#ffffff" size={8} />
                        </button>

                        <div className={styles.orDivider}>
                            <hr />
                            <span>OR</span>
                            <hr />
                        </div>

                        <form className={styles.joinRoom}>
                            <div className={styles.inputContainer}>
                                <label className={styles.inputLabel} htmlFor="room-code">
                                    Room code
                                </label>
                                <input
                                    id="room-code"
                                    type="text"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value)}
                                    placeholder="Enter room code"
                                    className={styles.authInput}
                                />
                            </div>
                            <button
                                type="button"
                                className={styles.authButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    addUserToRoom();
                                }}
                            >
                                Join room
                                <PulseLoader loading={loading.addUserToRoom} color="#ffffff" size={8} />
                            </button>
                        </form>
                    </div>

                    <div className={styles.loginFooterRow}>
                        <p className={styles.formFooterNote}>
                            Your existing rooms stay visible alongside the manager for quick access.
                        </p>
                    </div>
                </section>

                <section className={styles.roomsListCard}>
                    <div className={styles.roomsHeaderRow}>
                        <div>
                            <div className={styles.formEyebrow}>My rooms</div>
                            <h2 className={styles.roomsTitle}>Jump back into your active spaces</h2>
                            <p className={styles.roomsSubtitle}>
                                Open any room you already manage without scrolling away from the main screen.
                            </p>
                        </div>
                    </div>

                    {myRooms && myRooms.length > 0 ? (
                        <div className={styles.myRooms}>
                            {myRooms.map((room: any, index: number) => (
                                <div key={index} className={styles.myRoom}>
                                    <div>
                                        <p>{room.room_code}</p>
                                        <span className={styles.roomMeta}>Admin dashboard</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigate("/admin/dashboard/" + room.room_code);
                                        }}
                                    >
                                        Open
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.roomsEmpty}>
                            <p className={styles.roomsEmptyTitle}>No rooms yet</p>
                            <p className={styles.roomsEmptyText}>
                                Create your first room on the left and it will appear here.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Rooms;
