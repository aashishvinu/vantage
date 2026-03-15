import { useContext } from "react";
import AppContext from "../../contexts/appContext";
import styles from "./Login.module.css";
import { signup } from "./services";
import { Link, useNavigate } from "react-router-dom";

const Signup = () => {
    const { supabase } = useContext(AppContext);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const email = (e.target as HTMLFormElement).email.value;
        const password = (e.target as HTMLFormElement).password.value;
        const fullName = (e.target as HTMLFormElement).fullName.value;
        const phoneNumber = (e.target as HTMLFormElement).phoneNumber.value || undefined;

        if (supabase) {
            signup(email, password, fullName, phoneNumber, supabase, navigate);
        }
    };

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

                    <div className={styles.heroBadge}>Set up once and move faster</div>
                    <p className={styles.leftSideFeatures}>Join • Organize • Track</p>
                    <h1 className={styles.authLeftText}>Create your account and step straight into live rooms.</h1>
                    <p className={styles.authLeftSubText}>
                        A simple signup flow that gets you from account creation to room access without extra clutter.
                    </p>
                </section>

                <section className={styles.authRightSide}>
                    <div className={styles.formEyebrow}>Create account</div>
                    <h1 className={styles.authHeader}>Set up your Vantage profile</h1>
                    <p className={styles.authSubHeader}>
                        Create your account to manage rooms, coordinate members, and start using Vantage.
                    </p>

                    <form onSubmit={handleSubmit} className={styles.formContainer}>
                        <div className={styles.inputContainer}>
                            <label className={styles.inputLabel} htmlFor="signup-email">
                                Email address
                            </label>
                            <input
                                id="signup-email"
                                type="email"
                                name="email"
                                placeholder="johndoe@gmail.com"
                                required
                                className={styles.authInput}
                            />
                        </div>

                        <div className={styles.inputContainer}>
                            <label className={styles.inputLabel} htmlFor="signup-password">
                                Password
                            </label>
                            <input
                                id="signup-password"
                                type="password"
                                name="password"
                                placeholder="******"
                                required
                                className={styles.authInput}
                            />
                        </div>

                        <div className={styles.inputContainer}>
                            <label className={styles.inputLabel} htmlFor="signup-name">
                                Full name
                            </label>
                            <input
                                id="signup-name"
                                type="text"
                                name="fullName"
                                placeholder="John Doe"
                                required
                                className={styles.authInput}
                            />
                        </div>

                        <div className={styles.inputContainer}>
                            <label className={styles.inputLabel} htmlFor="signup-phone">
                                Phone number
                            </label>
                            <input
                                id="signup-phone"
                                type="tel"
                                name="phoneNumber"
                                placeholder="9856748595"
                                className={styles.authInput}
                            />
                        </div>

                        <div className={styles.buttons}>
                            <button type="submit" className={styles.authButton}>
                                Create account
                            </button>
                            <Link to="/">
                                <button type="button" className={styles.secondaryAuthButton}>
                                    Back to login
                                </button>
                            </Link>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
};

export default Signup;
