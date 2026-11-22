import {
    createBrowserRouter,
    Navigate,
} from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";

import Dashboard from "../features/dashboard/pages/Dashboard";

import NotFound from "../components/common/NotFound";
import RouteError from "../components/common/RouteError";
import Organizations from "../features/organizations/pages/Organizations";
import Machines from "../features/machines/pages/Machines";
import ManageMachine from "../features/machines/pages/ManageMachine";
import ManageMachinePreview from "../preview/ManageMachinePreview";

function Placeholder({ title }) {
    return <h2>{title}</h2>;
}

function Page({ children }) {
    return (
        <AppLayout>
            {children}
        </AppLayout>
    );
}

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Navigate to="/dashboard" replace />,
        errorElement: <RouteError />,
    },
    {
        path: "/dashboard",
        element: <Page><Dashboard /></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/organizations",
        element: <Page><Organizations></Organizations></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/machines",
        element: <Page><Machines></Machines></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/manage-machines",
        element: <Page><ManageMachinePreview></ManageMachinePreview></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/manage-machines/:id",
        element: <Page><ManageMachine></ManageMachine></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/monitoring",
        element: <Page><Placeholder title="Monitoring" /></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/terminal",
        element: <Page><Placeholder title="SSH Terminal" /></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/files",
        element: <Page><Placeholder title="Files" /></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "/settings",
        element: <Page><Placeholder title="Settings" /></Page>,
        errorElement: <RouteError />,
    },
    {
        path: "*",
        element: <Page><NotFound /></Page>,
    },
]);