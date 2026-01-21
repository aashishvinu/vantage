import {createBrowserRouter} from "react-router-dom";
import GlobalWrapper from "./components/GlobalWrapper";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/SignUp";
import Rooms from "./pages/Auth/Rooms";
import UsersDashboard from "./pages/Dashboard/Users/UsersDashboard";
import AdminsDashboard from "./pages/Dashboard/Admins/AdminsDashboard";

// This component will be served for any unknown route → React Router takes over
const CatchAll = () => {
    // This will fallback to index.html and let React Router handle the route
    window.location.href = "/";
    return null;
};

const router = createBrowserRouter(
    [
        {
            path: "/",
            element: <GlobalWrapper/>,
            children: [
                {index: true, element: <Login/>}, // exact "/" route
                {path: "signup", element: <Signup/>},
                {path: "rooms", element: <Rooms/>},
                {path: "user/dashboard/:room_code", element: <UsersDashboard/>},
                {path: "admin/dashboard/:room_code", element: <AdminsDashboard/>},
            ],
        },
        // THIS IS THE KEY LINE – catches every unknown route when served from Nginx
        {path: "*", element: <CatchAll/>},
    ],
    {
        // This makes /user/dashboard/abc work without hash
        basename: "/",
    }
);

export default router;