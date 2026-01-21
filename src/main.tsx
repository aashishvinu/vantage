import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import "./index.css";
import { Toaster } from "react-hot-toast";
import "leaflet/dist/leaflet.css";

import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";
import ru from "javascript-time-ago/locale/ru.json";

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(ru);

// Fix for Leaflet default icons in Vite/React
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: icon,
    iconUrl: icon,
    shadowUrl: iconShadow,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
        <Toaster position="bottom-center" />
    </React.StrictMode>
);