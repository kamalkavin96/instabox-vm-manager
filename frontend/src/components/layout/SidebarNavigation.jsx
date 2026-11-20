import { useMemo } from "react";
import {
    Box,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Tooltip,
    useTheme,
} from "@mui/material";
import {
    Dashboard,
    Business,
    Dns,
    MonitorHeart,
    Terminal,
    Folder,
    Settings,
} from "@mui/icons-material";
import { NavLink } from "react-router-dom";

import { useAppSelector } from "../../hooks/redux";
import { getJiraSidebarTokens } from "./Sidebar";

const navigationGroups = [
    {
        title: "MAIN",
        items: [
            { label: "Dashboard", path: "/dashboard", icon: Dashboard },
            { label: "Organizations", path: "/organizations", icon: Business },
            { label: "Machines", path: "/machines", icon: Dns },
        ],
    },
    {
        title: "MANAGEMENT",
        items: [
            { label: "Monitoring", path: "/monitoring", icon: MonitorHeart },
            { label: "SSH Terminal", path: "/terminal", icon: Terminal },
            { label: "Files", path: "/files", icon: Folder },
        ],
    },
    {
        title: "PREFERENCES",
        items: [{ label: "Settings", path: "/settings", icon: Settings }],
    },
];

export default function SidebarNavigation({ tokens: externalTokens }) {
    const theme = useTheme();
    const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
    const mode = useAppSelector((state) => state.ui.theme);

    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(
        () => externalTokens || getJiraSidebarTokens(isDark),
        [externalTokens, isDark]
    );

    return (
        <Box
            sx={{
                flexGrow: 1,
                overflowY: "auto",
                overflowX: "hidden",
                px: 1.25,
                py: 1.75,
                "&::-webkit-scrollbar": {
                    width: 5,
                },
                "&::-webkit-scrollbar-thumb": {
                    bgcolor: tokens.scrollbarThumb,
                    borderRadius: "3px",
                },
            }}
        >
            {navigationGroups.map((group) => (
                <Box key={group.title} sx={{ mb: 2.25 }}>
                    {sidebarOpen && (
                        <Typography
                            variant="caption"
                            sx={{
                                display: "block",
                                px: 1.25,
                                mb: 0.75,
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                color: tokens.textSubtle,
                            }}
                        >
                            {group.title}
                        </Typography>
                    )}

                    <List disablePadding>
                        {group.items.map((item) => {
                            const Icon = item.icon;

                            return (
                                <Tooltip
                                    key={item.path}
                                    title={sidebarOpen ? "" : item.label}
                                    placement="right"
                                    arrow
                                >
                                    <ListItemButton
                                        component={NavLink}
                                        to={item.path}
                                        end={item.path === "/dashboard"}
                                        sx={{
                                            position: "relative",
                                            minHeight: 38,
                                            mb: 0.35,
                                            px: 1.25,
                                            borderRadius: "3px",
                                            justifyContent: sidebarOpen ? "initial" : "center",
                                            color: tokens.textSecondary,
                                            transition: "background-color 0.14s ease, color 0.14s ease",
                                            "&:hover": {
                                                bgcolor: tokens.surfaceHover,
                                                color: tokens.textPrimary,
                                            },
                                            "&.active": {
                                                bgcolor: tokens.activeBg,
                                                color: tokens.activeText,
                                                fontWeight: 600,
                                                "&::before": {
                                                    content: '""',
                                                    position: "absolute",
                                                    left: 0,
                                                    top: 6,
                                                    bottom: 6,
                                                    width: 3,
                                                    borderRadius: "0 2px 2px 0",
                                                    bgcolor: tokens.activeBar,
                                                },
                                                "& .MuiListItemIcon-root": {
                                                    color: tokens.activeText,
                                                },
                                            },
                                        }}
                                    >
                                        <ListItemIcon
                                            sx={{
                                                minWidth: sidebarOpen ? 32 : 0,
                                                justifyContent: "center",
                                                color: "inherit",
                                            }}
                                        >
                                            <Icon sx={{ fontSize: 18 }} />
                                        </ListItemIcon>

                                        {sidebarOpen && (
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
                </Box>
            ))}
        </Box>
    );
}