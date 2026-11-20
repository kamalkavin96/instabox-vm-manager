import { useMemo } from "react";
import { Box, Typography, Chip, useTheme } from "@mui/material";
import { useAppSelector } from "../../hooks/redux";

const getHeaderTokens = (isDark) => ({
    headerBg: isDark ? "#22272B" : "#FFFFFF",
    border: isDark ? "#38414A" : "#DFE1E6",
    textPrimary: isDark ? "#B6C2CF" : "#172B4D",
    textSecondary: isDark ? "#8C9BAB" : "#44546F",
    brandMain: isDark ? "#579DFF" : "#1868DB",
    brandBg: isDark ? "#1C2B41" : "#E9F2FF",
    brandBorder: isDark ? "#2C4870" : "#CCE0FF",
    stickyShadow: isDark
        ? "0 2px 8px rgba(3, 4, 4, 0.65)"
        : "0 2px 8px rgba(9, 30, 66, 0.12)",
});

export default function PageHeader({
    title,
    subtitle,
    count,
    countLabel = "Total",
    countIcon: CountIcon,
    action,
    sticky = false,
    tokens: externalTokens,
}) {
    const theme = useTheme();
    const mode = useAppSelector((state) => state.ui?.theme);
    const isDark = (mode || theme.palette.mode) === "dark";

    const tokens = useMemo(() => {
        const defaults = getHeaderTokens(isDark);
        return {
            ...defaults,
            ...(externalTokens || {}),
            headerBg:
                externalTokens?.headerBg ||
                externalTokens?.cardBg ||
                defaults.headerBg,
        };
    }, [externalTokens, isDark]);

    const hasCount = typeof count === "number";

    return (
        <Box
            component="header"
            sx={{
                minHeight: 60,
                px: 3,
                py: 1.25,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexShrink: 0,
                isolation: "isolate",
                backgroundColor: `${tokens.headerBg} !important`,
                opacity: 1,
                borderBottom: `1px solid ${tokens.border}`,
                ...(sticky && {
                    position: "sticky",
                    top: 0,
                    zIndex: 1100,
                    boxShadow: tokens.stickyShadow,
                }),
                transition: "background-color 0.2s ease, border-color 0.2s ease",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Typography
                            component="h1"
                            variant="h6"
                            noWrap
                            sx={{
                                fontWeight: 700,
                                fontSize: "1.125rem",
                                lineHeight: 1.3,
                                letterSpacing: "-0.01em",
                                color: tokens.textPrimary,
                            }}
                        >
                            {title}
                        </Typography>

                        {hasCount && (
                            <Chip
                                icon={
                                    CountIcon ? (
                                        <CountIcon
                                            sx={{
                                                fontSize: 14,
                                                color: `${tokens.brandMain} !important`,
                                            }}
                                        />
                                    ) : undefined
                                }
                                label={`${count} ${countLabel}`}
                                size="small"
                                sx={{
                                    height: 22,
                                    borderRadius: "3px",
                                    backgroundColor: tokens.brandBg,
                                    color: tokens.brandMain,
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                    border: `1px solid ${tokens.brandBorder}`,
                                    "& .MuiChip-label": {
                                        px: 0.75,
                                    },
                                }}
                            />
                        )}
                    </Box>

                    {subtitle && (
                        <Typography
                            variant="caption"
                            noWrap
                            sx={{
                                display: "block",
                                color: tokens.textSecondary,
                                fontSize: "0.75rem",
                                lineHeight: 1.3,
                                mt: 0.25,
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Box>

            {action && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        flexShrink: 0,
                    }}
                >
                    {action}
                </Box>
            )}
        </Box>
    );
}