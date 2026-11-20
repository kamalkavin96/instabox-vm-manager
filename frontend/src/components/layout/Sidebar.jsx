import { useMemo } from "react";
import { Box, useTheme } from "@mui/material";

import SidebarHeader from "./SidebarHeader";
import SidebarNavigation from "./SidebarNavigation";
import SidebarFooter from "./SidebarFooter";

import { useAppSelector } from "../../hooks/redux";

export const getJiraSidebarTokens = (isDark) => ({
    sidebarBg: isDark ? "#1D2125" : "#FFFFFF",
    surfaceSubtle: isDark ? "#22272B" : "#F7F8F9",
    surfaceHover: isDark ? "#282E33" : "#F1F2F4",
    border: isDark ? "#38414A" : "#DFE1E6",
    textPrimary: isDark ? "#B6C2CF" : "#172B4D",
    textSecondary: isDark ? "#8C9BAB" : "#44546F",
    textSubtle: isDark ? "#738496" : "#626F86",
    activeBg: isDark ? "#1C2B41" : "#E9F2FF",
    activeText: isDark ? "#579DFF" : "#0055CC",
    activeBar: isDark ? "#579DFF" : "#1868DB",
    brandMain: isDark ? "#579DFF" : "#1868DB",
    brandBg: isDark ? "#1C2B41" : "#E9F2FF",
    avatarBg: isDark ? "#1C2B41" : "#E9F2FF",
    avatarText: isDark ? "#85B8FF" : "#0055CC",
    avatarBorder: isDark ? "#2C4870" : "#CCE0FF",
    scrollbarThumb: isDark ? "#454F59" : "#C1C7D0",
});

export default function Sidebar() {
    const theme = useTheme();
    const open = useAppSelector((state) => state.ui.sidebarOpen);
    const mode = useAppSelector((state) => state.ui.theme);

    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(() => getJiraSidebarTokens(isDark), [isDark]);

    return (
        <Box
            component="aside"
            sx={{
                width: open ? 260 : 72,
                minWidth: open ? 260 : 72,
                height: "100vh",
                position: "sticky",
                top: 0,
                display: "flex",
                flexDirection: "column",
                bgcolor: tokens.sidebarBg,
                color: tokens.textPrimary,
                borderRight: `1px solid ${tokens.border}`,
                transition: "width 0.18s ease, min-width 0.18s ease, background-color 0.2s ease",
                overflow: "hidden",
            }}
        >
            <SidebarHeader tokens={tokens} />
            <SidebarNavigation tokens={tokens} />
            <SidebarFooter tokens={tokens} isDark={isDark} />
        </Box>
    );
}