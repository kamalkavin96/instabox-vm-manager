import { Box } from "@mui/material";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }) {
    return (
        <Box
            sx={{
                display: "flex",
                width: "100%",
                height: "100vh",
                overflow: "hidden",
                bgcolor: "background.default",
            }}
        >
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    height: "100vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    bgcolor: "background.default",
                }}
            >
                {children}
            </Box>
        </Box>
    );
}