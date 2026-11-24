import { useMemo } from "react";
import { Box, Typography, IconButton, Tooltip, useTheme } from "@mui/material";
import { Cloud, Menu } from "@mui/icons-material";

import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { toggleSidebar } from "../../store/uiSlice";
import { getJiraSidebarTokens } from "./Sidebar";

export default function SidebarHeader({ tokens: externalTokens }) {
    const theme = useTheme();
    const dispatch = useAppDispatch();
    const open = useAppSelector((state) => state.ui.sidebarOpen);
    const mode = useAppSelector((state) => state.ui.theme);

    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(
        () => externalTokens || getJiraSidebarTokens(isDark),
        [externalTokens, isDark]
    );

    return (
        <Box
            sx={{
                height: 60,
                px: 1.75,
                display: "flex",
                alignItems: "center",
                justifyContent: open ? "space-between" : "center",
                gap: 1,
                borderBottom: `1px solid ${tokens.border}`,
                bgcolor: tokens.sidebarBg,
            }}
        >
            {open && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                    <Box
                        sx={{
                            width: 30,
                            height: 30,
                            borderRadius: "4px",
                            bgcolor: tokens.brandBg,
                            color: tokens.brandMain,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Cloud sx={{ fontSize: 18 }} />
                    </Box>

                    <Typography
                        variant="subtitle1"
                        noWrap
                        sx={{
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            letterSpacing: "-0.01em",
                            color: tokens.textPrimary,
                        }}
                    >
                        Instabox
                    </Typography>
                </Box>
            )}

            <Tooltip title={open ? "Collapse sidebar" : "Expand sidebar"} placement="right" arrow>
                <IconButton
                    onClick={() => dispatch(toggleSidebar())}
                    size="small"
                    sx={{
                        width: 30,
                        height: 30,
                        borderRadius: "3px",
                        color: tokens.textSecondary,
                        border: `1px solid transparent`,
                        "&:hover": {
                            bgcolor: tokens.surfaceHover,
                            color: tokens.textPrimary,
                            borderColor: tokens.border,
                        },
                    }}
                >
                    <Menu fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}