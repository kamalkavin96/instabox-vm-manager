import {
    Box,
    Typography,
    Button,
    Paper,
} from "@mui/material";

import { Refresh } from "@mui/icons-material";

import {
    useRouteError,
    isRouteErrorResponse,
} from "react-router-dom";

export default function RouteError() {
    const error = useRouteError();

    const status = isRouteErrorResponse(error)
        ? error.status
        : 500;

    const message = isRouteErrorResponse(error)
        ? error.statusText || error.data?.message
        : error?.message || "Something went wrong.";

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                p: 3,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 5,
                    textAlign: "center",
                    maxWidth: 450,
                }}
            >
                <Typography
                    variant="h2"
                    fontWeight={800}
                    color="error"
                >
                    {status}
                </Typography>

                <Typography variant="h5" fontWeight={700}>
                    Something went wrong
                </Typography>

                <Typography
                    color="text.secondary"
                    sx={{ my: 2 }}
                >
                    {message}
                </Typography>

                <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={() => window.location.reload()}
                >
                    Reload Application
                </Button>
            </Paper>
        </Box>
    );
}