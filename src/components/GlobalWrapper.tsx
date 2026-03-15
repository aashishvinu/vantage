import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import AppContext from "../contexts/appContext";
import { createClient } from "@supabase/supabase-js";
import { appConfig, missingRequiredEnvVars } from "../config";

const supabase =
  missingRequiredEnvVars.length === 0
    ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey)
    : null;

const GlobalWrapper = () => {
  if (!supabase) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          backgroundColor: "#f9f9f9",
          color: "#333",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "12px" }}>App Configuration Missing</h1>
          <p style={{ maxWidth: "540px", lineHeight: 1.5 }}>
            Set the required Vite environment variables in Vercel Project
            Settings, then redeploy.
          </p>
          <p style={{ maxWidth: "540px", lineHeight: 1.5 }}>
            Missing: <code>{missingRequiredEnvVars.join(", ")}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        supabase,
      }}
    >
      <Suspense fallback={<p>Loading...</p>}>
        <Outlet />
      </Suspense>
    </AppContext.Provider>
  );
};

export default GlobalWrapper;
