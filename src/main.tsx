import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import "./index.css";
import { Toaster } from "react-hot-toast";
import "leaflet/dist/leaflet.css";

import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import ru from "javascript-time-ago/locale/ru";
import Radar from "radar-sdk-js";
import "radar-sdk-js/dist/radar.css";
import { appConfig, configStatus } from "./config";

if (configStatus.hasRadar) {
    Radar.initialize(appConfig.radarPublishableKey);
} else {
    console.warn(
        "Missing VITE_RADAR_PUBLISHABLE_KEY. Radar SDK was not initialized."
    );
}

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(ru);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
        <Toaster position="bottom-center" />
    </React.StrictMode>
);
