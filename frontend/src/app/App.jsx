import { RouterProvider } from "react-router-dom";

import { router } from "./router";

import { SnackbarProvider } from "notistack";

export default function App() {
    return (
        <SnackbarProvider
            maxSnack={3}
            autoHideDuration={3000}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
            }}
        >
            <RouterProvider router={router} />
        </SnackbarProvider>
    );
}