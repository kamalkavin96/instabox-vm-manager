import {
    Box,
    Typography,
    Button,
    Paper,
} from "@mui/material";

import {
    Home,
    ArrowBack,
} from "@mui/icons-material";

import { useNavigate } from "react-router-dom";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                minHeight: "80vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 5,
                    maxWidth: 450,
                    bgcolor: "background.paper",
                }}
            >
                <Typography
                    variant="h1"
                    fontWeight={800}
                    color="primary"
                >
                    404
                </Typography>

                <Typography variant="h5" fontWeight={700}>
                    Page Not Found
                </Typography>

                <Typography
                    color="text.secondary"
                    sx={{ mt: 1, mb: 3 }}
                >
                    The page you're looking for doesn't exist
                    or may have been moved.
                </Typography>

                <Box
                    display="flex"
                    justifyContent="center"
                    gap={2}
                >
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBack />}
                        onClick={() => navigate(-1)}
                    >
                        Go Back
                    </Button>

                    <Button
                        variant="contained"
                        startIcon={<Home />}
                        onClick={() => navigate("/dashboard")}
                    >
                        Dashboard
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}