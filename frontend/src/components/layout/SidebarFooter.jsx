import { useState, useEffect, useMemo } from "react";
import {
    Box,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Avatar,
    Typography,
    Tooltip,
    useTheme,
} from "@mui/material";
import {
    DarkMode,
    LightMode,
    Fullscreen,
    FullscreenExit,
} from "@mui/icons-material";

import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { toggleTheme } from "../../store/uiSlice";
import { getJiraSidebarTokens } from "./Sidebar";

export default function SidebarFooter({ tokens: externalTokens, isDark: externalIsDark }) {
    const theme = useTheme();
    const dispatch = useAppDispatch();

    const open = useAppSelector((state) => state.ui.sidebarOpen);
    const mode = useAppSelector((state) => state.ui.theme);

    const isDark =
        typeof externalIsDark === "boolean"
            ? externalIsDark
            : (mode || theme.palette.mode) === "dark";

    const tokens = useMemo(
        () => externalTokens || getJiraSidebarTokens(isDark),
        [externalTokens, isDark]
    );

    const [isFullscreen, setIsFullscreen] = useState(
        Boolean(document.fullscreenElement)
    );

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error("Fullscreen error:", error);
        }
    };

    const footerItems = [
        {
            label: isFullscreen ? "Exit Full Screen" : "Full Screen",
            icon: isFullscreen ? FullscreenExit : Fullscreen,
            action: toggleFullscreen,
        },
        {
            label: isDark ? "Light Theme" : "Dark Theme",
            icon: isDark ? LightMode : DarkMode,
            action: () => dispatch(toggleTheme()),
        },
    ];

    return (
        <Box sx={{ mt: "auto", bgcolor: tokens.sidebarBg }}>
            <List
                sx={{
                    px: 1.25,
                    py: 1,
                    borderTop: `1px solid ${tokens.border}`,
                }}
            >
                {footerItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <Tooltip
                            key={item.label}
                            title={!open ? item.label : ""}
                            placement="right"
                            arrow
                        >
                            <ListItemButton
                                onClick={item.action}
                                sx={{
                                    borderRadius: "3px",
                                    minHeight: 36,
                                    mb: 0.25,
                                    px: 1.25,
                                    justifyContent: open ? "initial" : "center",
                                    color: tokens.textSecondary,
                                    "&:hover": {
                                        bgcolor: tokens.surfaceHover,
                                        color: tokens.textPrimary,
                                    },
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: open ? 32 : 0,
                                        justifyContent: "center",
                                        color: "inherit",
                                    }}
                                >
                                    <Icon sx={{ fontSize: 18 }} />
                                </ListItemIcon>

                                {open && (
                                    <ListItemText
                                        primary={item.label}
                                        slotProps={{
                                            primary: {
                                                fontSize: "0.85rem",
                                                fontWeight: 500,
                                                noWrap: true,
                                            },
                                        }}
                                    />
                                )}
                            </ListItemButton>
                        </Tooltip>
                    );
                })}
            </List>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    px: 1.75,
                    py: 1.5,
                    gap: 1.25,
                    justifyContent: open ? "flex-start" : "center",
                    borderTop: `1px solid ${tokens.border}`,
                    bgcolor: tokens.surfaceSubtle,
                }}
            >
                <Avatar
                    variant="rounded"
                    sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "3px",
                        bgcolor: tokens.avatarBg,
                        color: tokens.avatarText,
                        border: `1px solid ${tokens.avatarBorder}`,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                    }}
                >
                    K
                </Avatar>

                {open && (
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            noWrap
                            sx={{
                                fontSize: "0.8125rem",
                                fontWeight: 700,
                                color: tokens.textPrimary,
                                lineHeight: 1.25,
                            }}
                        >
                            Kavin
                        </Typography>

                        <Typography
                            noWrap
                            sx={{
                                fontSize: "0.75rem",
                                color: tokens.textSubtle,
                                lineHeight: 1.25,
                            }}
                        >
                            Administrator
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}