import { useContext, useEffect, useState } from "react";
import AppContext from "../../contexts/appContext";
import styles from "./Login.module.css";
import { login } from "./services";
import { Link, useNavigate } from "react-router-dom";
import { PulseLoader } from "react-spinners";

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { supabase } = useContext(AppContext);

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
            <div className={styles.authContainer}>
                <section className={styles.authLeftSide}>
                    <div className={styles.brandRow}>
                        <img src="/logo_no_bg.png" alt="Vantage logo" className={styles.brandLogo} />
                        <div>
                            <p className={styles.brandName}>Vantage</p>
                            <p className={styles.brandTag}>Realtime field coordination</p>
                        </div>
                    </div>

                    <div className={styles.heroBadge}>Minimal tracking for teams on the move</div>
                    <p className={styles.leftSideFeatures}>Coordinate • Monitor • Respond</p>
                    <h1 className={styles.authLeftText}>A cleaner control room for live group movement.</h1>
                    <p className={styles.authLeftSubText}>
                        Manage rooms, monitor team members, and react faster without fighting a cluttered UI.
                    </p>

                    <div className={styles.heroMetrics}>
                        <div className={styles.metricCard}>
                            <p className={styles.metricValue}>Live rooms</p>
                            <p className={styles.metricLabel}>Track active groups from one place.</p>
                        </div>
                        <div className={styles.metricCard}>
                            <p className={styles.metricValue}>Fast access</p>
                            <p className={styles.metricLabel}>Get from login to room management quickly.</p>
                        </div>
                        <div className={styles.metricCard}>
                            <p className={styles.metricValue}>Clear alerts</p>
                            <p className={styles.metricLabel}>See the important signals without noise.</p>
                        </div>
                    </div>
                </section>

                <section className={styles.authRightSide}>
                    <div className={styles.formEyebrow}>Welcome back</div>
                    <h1 className={styles.authHeader}>Sign in to your workspace</h1>
                    <p className={styles.authSubHeader}>
                        Access your rooms and continue managing your group in real time.
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
                            <button type="submit" className={styles.authButton} disabled={loading}>
                                {loading ? <PulseLoader color="#ffffff" size={7} /> : "Sign in"}
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
                            Room-based access for both admins and participants.
                        </p>
                        <Link to="/signup" className={styles.loginInlineLink}>
                            New here? Create your account
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Login;
