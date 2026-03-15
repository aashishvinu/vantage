import {useContext, useEffect, useState} from "react";
import AppContext from "../../contexts/appContext";
import styles from "./Login.module.css";
import {login} from "./services";
import {Link, useNavigate} from "react-router-dom";
import {PulseLoader} from "react-spinners";

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const {supabase} = useContext(AppContext);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const username = (e.target as HTMLFormElement).username.value;
        const password = (e.target as HTMLFormElement).password.value;
        if (supabase) {
            login(username, password, supabase, navigate, setLoading);
        }
    };

    useEffect(() => {
        localStorage.removeItem("userObject");
    }, []);

    return (
        <div className={styles.themeContainer}>
            <div className={styles.loginShell}>
                <div className={styles.loginAmbientGlowOne}/>
                <div className={styles.loginAmbientGlowTwo}/>
                <div className={styles.loginGrid}/>

                <div className={styles.loginFrame}>
                    <div className={styles.authLeftSide}>
                        <div className={styles.leftTop}>
                            <div className={styles.loginBrandRow}>
                                <div className={styles.heroLogoWrap}>
                                    <img src="/logo_no_bg.png" alt="Vantage" className={styles.heroLogo}/>
                                </div>
                                <div>
                                    <p className={styles.loginBrandName}>Vantage</p>
                                    <p className={styles.loginBrandTag}>Realtime field coordination</p>
                                </div>
                            </div>

                            <div className={styles.heroBadge}>Futuristic tracking for teams on the move</div>

                            <p className={styles.leftSideFeatures}>Coordinate · Protect · Navigate</p>

                            <h1 className={styles.authLeftText}>
                                See the whole team in motion before problems spread.
                            </h1>

                            <p className={styles.authLeftSubText}>
                                Built for college trips, field ops, and group movement, Vantage brings
                                live location awareness, room-based coordination, and rapid response into
                                a single command surface.
                            </p>

                            <div className={styles.loginSignalStrip}>
                                <div className={styles.signalCard}>
                                    <span className={styles.signalLabel}>Status</span>
                                    <span className={styles.signalValue}>Live map sync</span>
                                </div>
                                <div className={styles.signalCard}>
                                    <span className={styles.signalLabel}>Coverage</span>
                                    <span className={styles.signalValue}>Admin and member rooms</span>
                                </div>
                                <div className={styles.signalCard}>
                                    <span className={styles.signalLabel}>Safety</span>
                                    <span className={styles.signalValue}>Alerts and geofence flow</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.leftBottom}>
                            <div className={styles.heroMetrics}>
                                <div className={styles.metricCard}>
                                    <span className={styles.metricValue}>01</span>
                                    <span className={styles.metricLabel}>Live visibility across active rooms</span>
                                </div>
                                <div className={styles.metricCard}>
                                    <span className={styles.metricValue}>02</span>
                                    <span className={styles.metricLabel}>Fast access for organizers and participants</span>
                                </div>
                                <div className={styles.metricCard}>
                                    <span className={styles.metricValue}>03</span>
                                    <span className={styles.metricLabel}>Cleaner response when someone drifts off path</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.authRightSide}>
                        <div className={styles.loginPanel}>
                            <div className={styles.loginPanelInner}>
                                <span className={styles.formEyebrow}>Mission access</span>
                                <h2 className={styles.authHeader}>Enter the Vantage control layer</h2>
                                <p className={styles.authSubHeader}>
                                    Log in to manage rooms, monitor movement, and keep your team aligned in real time.
                                </p>

                                <form onSubmit={handleSubmit} className={styles.formContainer}>
                                    <div className={styles.inputContainer}>
                                        <label className={styles.inputLabel} htmlFor="login-email">
                                            Email address
                                        </label>
                                        <input
                                            id="login-email"
                                            type="email"
                                            name="username"
                                            placeholder="you@example.com"
                                            required
                                            className={styles.authInput}
                                            autoComplete="email"
                                        />
                                    </div>

                                    <div className={styles.inputContainer}>
                                        <label className={styles.inputLabel} htmlFor="login-password">
                                            Password
                                        </label>
                                        <input
                                            id="login-password"
                                            type="password"
                                            name="password"
                                            placeholder="••••••••"
                                            required
                                            className={styles.authInput}
                                            autoComplete="current-password"
                                        />
                                    </div>

                                    <div className={styles.buttons}>
                                        <button
                                            type="submit"
                                            className={styles.authButton}
                                            disabled={loading}
                                        >
                                            {loading ? <PulseLoader color="#ffffff" size={7}/> : "Launch workspace"}
                                        </button>
                                        <Link to="/signup">
                                            <button type="button" className={styles.secondaryAuthButton}>
                                                Create account
                                            </button>
                                        </Link>
                                    </div>
                                </form>

                                <div className={styles.loginFooterRow}>
                                    <p className={styles.formFooterNote}>
                                        Secure room-based access for admins and participants.
                                    </p>
                                    <Link to="/signup" className={styles.loginInlineLink}>
                                        New here? Create your account
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
