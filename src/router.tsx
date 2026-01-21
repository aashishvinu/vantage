import { createBrowserRouter } from "react-router-dom";
import GlobalWrapper from "./components/GlobalWrapper";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/SignUp";
import UsersDashboard from "./pages/Dashboard/Users/UsersDashboard";
import AdminsDashboard from "./pages/Dashboard/Admins/AdminsDashboard";
import Rooms from "./pages/Auth/Rooms";

// 404 Catch-all component - handles refresh on ANY route
const NotFound = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">Page not found</p>
                <a
                    href="/"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                    Go Home
                </a>
            </div>
        </div>
    );
};

const router = createBrowserRouter([
    {
        path: "/",
        element: <GlobalWrapper />,
        children: [
            // Root path - shows Login
            { index: true, element: <Login /> },

            // Auth routes
            { path: "signup", element: <Signup /> },
            { path: "rooms", element: <Rooms /> },

            // Dashboard routes with params
            { path: "user/dashboard/:room_code", element: <UsersDashboard /> },
            { path: "admin/dashboard/:room_code", element: <AdminsDashboard /> },

            // Catch-all INSIDE GlobalWrapper - protects ALL sub-routes
            { path: "*", element: <NotFound /> },
        ],
    },
    // Top-level catch-all (backup protection)
    { path: "*", element: <NotFound /> },
], {
    basename: "/", // Ensures clean URLs without hash
});

export default router;