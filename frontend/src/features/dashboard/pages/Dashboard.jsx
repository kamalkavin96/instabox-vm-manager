import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Grid,
    Typography,
    Card,
    CardContent,
    LinearProgress,
    Stack,
    Button,
    Divider,
    useTheme,
} from "@mui/material";
import {
    Dns,
    CheckCircle,
    Cancel,
    Memory,
    Add,
    Refresh,
    Storage,
    Speed,
    ArrowForward,
    SettingsEthernet,
    Key,
    FolderShared,
    Inventory2,
    Layers,
    Album,
    Hub,
} from "@mui/icons-material";

import PageHeader from "../../../components/common/PageHeader";
import { useAppSelector } from "../../../hooks/redux";
import { fetchDashboardOverview } from "../dashboardApi";

const getJiraDashboardTokens = (isDark) => ({
    canvasBg: isDark ? "#1D2125" : "#F7F8F9",
    cardBg: isDark ? "#22272B" : "#FFFFFF",
    subtleSurface: isDark ? "#161A1D" : "#F7F8F9",
    hoverSurface: isDark ? "#282E33" : "#F1F2F4",
    border: isDark ? "#38414A" : "#DFE1E6",
    borderHover: isDark ? "#579DFF" : "#B3D4FF",
    textPrimary: isDark ? "#B6C2CF" : "#172B4D",
    textSecondary: isDark ? "#8C9BAB" : "#44546F",
    textSubtle: isDark ? "#738496" : "#626F86",
    brandMain: isDark ? "#579DFF" : "#1868DB",
    brandHover: isDark ? "#85B8FF" : "#0055CC",
    brandBg: isDark ? "#1C2B41" : "#E9F2FF",
    brandBorder: isDark ? "#2C4870" : "#CCE0FF",
    blue: isDark
        ? { main: "#579DFF", bg: "#1C2B41", text: "#85B8FF" }
        : { main: "#1868DB", bg: "#E9F2FF", text: "#0055CC" },
    green: isDark
        ? { main: "#4BCE97", bg: "#163326", text: "#7EE2B8" }
        : { main: "#22A06B", bg: "#DCFFF1", text: "#216E4E" },
    red: isDark
        ? { main: "#F87168", bg: "#3B1C1A", text: "#FD9891" }
        : { main: "#C9372C", bg: "#FFECEB", text: "#AE2E24" },
    orange: isDark
        ? { main: "#FEA362", bg: "#382516", text: "#FEC195" }
        : { main: "#E56910", bg: "#FFF3EB", text: "#A54800" },
    purple: isDark
        ? { main: "#9F8FEF", bg: "#2B244D", text: "#B8ACF6" }
        : { main: "#8270DB", bg: "#F3F0FF", text: "#5E4DB2" },
    teal: isDark
        ? { main: "#6CC3E0", bg: "#16323B", text: "#9DD9EE" }
        : { main: "#1D9AAA", bg: "#E7F9FF", text: "#206A83" },
    neutral: isDark
        ? { main: "#8C9BAB", bg: "#2C333A", text: "#B6C2CF" }
        : { main: "#626F86", bg: "#F1F2F4", text: "#44546F" },
    cardShadowHover: isDark
        ? "0 6px 12px -2px rgba(3, 4, 4, 0.55), 0 0 1px rgba(255, 255, 255, 0.12)"
        : "0 4px 8px -2px rgba(9, 30, 66, 0.12), 0 0 1px rgba(9, 30, 66, 0.31)",
});

const INITIAL_DATA = {
    kpis: { totalMachines: 0, onlineMachines: 0, offlineMachines: 0, avgCpu: 0 },
    resources: {
        memory: { percent: 0, label: "0%", caption: "0% average memory utilization" },
        storage: { percent: 0, label: "0%", caption: "0% average storage utilization" },
        cpu: { percent: 0, label: "0%", caption: "Average cluster CPU utilization" },
    },
    orgMetrics: {
        totalPorts: 0,
        sshConfiguredCount: 0,
        sftpConfiguredCount: 0,
        totalContainers: 0,
        runningContainers: 0,
        totalImages: 0,
        totalVolumes: 0,
        totalNetworks: 0,
    },
    machines: [],
};

export default function Dashboard() {
    const theme = useTheme();
    const navigate = useNavigate();
    const mode = useAppSelector((state) => state.ui?.theme);
    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(() => getJiraDashboardTokens(isDark), [isDark]);

    const [data, setData] = useState(INITIAL_DATA);
    const [loading, setLoading] = useState(false);

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            const overview = await fetchDashboardOverview();
            setData(overview);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    const statCards = [
        {
            title: "Total Machines",
            value: String(data.kpis.totalMachines),
            subtitle: "Registered instances",
            icon: Dns,
            accent: tokens.blue,
        },
        {
            title: "Online Machines",
            value: String(data.kpis.onlineMachines),
            subtitle: "Currently running",
            icon: CheckCircle,
            accent: tokens.green,
        },
        {
            title: "Offline Machines",
            value: String(data.kpis.offlineMachines),
            subtitle: "Currently stopped",
            icon: Cancel,
            accent: tokens.red,
        },
        {
            title: "Average CPU",
            value: `${data.kpis.avgCpu}%`,
            subtitle: "Across registered nodes",
            icon: Memory,
            accent: tokens.orange,
        },
    ];

    const resourceCards = [
        {
            title: "Memory Usage",
            value: data.resources.memory.label,
            percent: data.resources.memory.percent,
            caption: data.resources.memory.caption,
            icon: Memory,
            accent: tokens.purple,
        },
        {
            title: "Storage Usage",
            value: data.resources.storage.label,
            percent: data.resources.storage.percent,
            caption: data.resources.storage.caption,
            icon: Storage,
            accent: tokens.teal,
        },
        {
            title: "CPU Utilization",
            value: data.resources.cpu.label,
            percent: data.resources.cpu.percent,
            caption: data.resources.cpu.caption,
            icon: Speed,
            accent: tokens.blue,
        },
    ];

    const orgBreakdownCards = [
        {
            label: "Mapped Ports",
            value: data.orgMetrics.totalPorts,
            sub: "Across all VMs",
            icon: SettingsEthernet,
            accent: tokens.blue,
        },
        {
            label: "SSH Configs",
            value: data.orgMetrics.sshConfiguredCount,
            sub: `of ${data.kpis.totalMachines} VMs`,
            icon: Key,
            accent: tokens.green,
        },
        {
            label: "SFTP Configs",
            value: data.orgMetrics.sftpConfiguredCount,
            sub: `of ${data.kpis.totalMachines} VMs`,
            icon: FolderShared,
            accent: tokens.teal,
        },
        {
            label: "Containers",
            value: data.orgMetrics.totalContainers,
            sub: `${data.orgMetrics.runningContainers} running`,
            icon: Inventory2,
            accent: tokens.purple,
        },
        {
            label: "Images",
            value: data.orgMetrics.totalImages,
            sub: "Cached in DB",
            icon: Layers,
            accent: tokens.orange,
        },
        {
            label: "Volumes",
            value: data.orgMetrics.totalVolumes,
            sub: "Persistent stores",
            icon: Album,
            accent: tokens.blue,
        },
        {
            label: "Networks",
            value: data.orgMetrics.totalNetworks,
            sub: "Docker networks",
            icon: Hub,
            accent: tokens.green,
        },
    ];

    return (
        <Box
            sx={{
                bgcolor: tokens.canvasBg,
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                pb: 4,
                transition: "background-color 0.2s ease",
            }}
        >
            <PageHeader
                title="Dashboard"
                subtitle="Organization-wide compute, ports, InstaBox SSH/SFTP, and Docker snapshot metrics"
                count={data.kpis.totalMachines}
                countLabel="Machines"
                countIcon={Dns}
                tokens={tokens}
                action={
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <Button
                            variant="outlined"
                            startIcon={<Refresh fontSize="small" />}
                            disabled={loading}
                            onClick={() => void loadDashboard()}
                            sx={{
                                borderRadius: "3px",
                                borderColor: tokens.border,
                                bgcolor: tokens.cardBg,
                                color: tokens.textPrimary,
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                height: 34,
                                px: 1.75,
                                "&:hover": {
                                    bgcolor: tokens.hoverSurface,
                                    borderColor: tokens.border,
                                },
                            }}
                        >
                            {loading ? "Refreshing..." : "Refresh"}
                        </Button>

                        <Button
                            variant="contained"
                            startIcon={<Add fontSize="small" />}
                            disableElevation
                            onClick={() => navigate("/machines")}
                            sx={{
                                bgcolor: tokens.brandMain,
                                color: isDark ? "#1D2125" : "#FFFFFF",
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                height: 34,
                                px: 2,
                                "&:hover": {
                                    bgcolor: tokens.brandHover,
                                },
                            }}
                        >
                            Add machine
                        </Button>
                    </Stack>
                }
            />

            <Box sx={{ px: 3, pt: 2.5, flexGrow: 1 }}>
                {/* Machine KPI Cards */}
                <Grid container spacing={2}>
                    {statCards.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <Grid key={stat.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        height: "100%",
                                        borderRadius: "4px",
                                        bgcolor: tokens.cardBg,
                                        borderColor: tokens.border,
                                        borderTop: `3px solid ${stat.accent.main}`,
                                        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                                        "&:hover": {
                                            borderColor: tokens.borderHover,
                                            borderTopColor: stat.accent.main,
                                            boxShadow: tokens.cardShadowHover,
                                        },
                                    }}
                                >
                                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                                            <Box>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: tokens.textSubtle,
                                                        fontWeight: 700,
                                                        fontSize: "0.7rem",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.04em",
                                                        display: "block",
                                                        mb: 0.75,
                                                    }}
                                                >
                                                    {stat.title}
                                                </Typography>
                                                <Typography
                                                    variant="h4"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: tokens.textPrimary,
                                                        fontSize: "1.65rem",
                                                        lineHeight: 1.15,
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {stat.value}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: tokens.textSecondary, fontSize: "0.75rem" }}>
                                                    {stat.subtitle}
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: "4px",
                                                    bgcolor: stat.accent.bg,
                                                    color: stat.accent.main,
                                                    border: `1px solid ${stat.accent.main}44`,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon fontSize="small" />
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>

                {/* Resource Overview Cards */}
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    {resourceCards.map((resource) => {
                        const Icon = resource.icon;
                        return (
                            <Grid key={resource.title} size={{ xs: 12, md: 4 }}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        height: "100%",
                                        borderRadius: "4px",
                                        bgcolor: tokens.cardBg,
                                        borderColor: tokens.border,
                                        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                                        "&:hover": {
                                            borderColor: tokens.borderHover,
                                            boxShadow: tokens.cardShadowHover,
                                        },
                                    }}
                                >
                                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Box
                                                    sx={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: "3px",
                                                        bgcolor: resource.accent.bg,
                                                        color: resource.accent.main,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }}
                                                >
                                                    <Icon sx={{ fontSize: 16 }} />
                                                </Box>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.textPrimary, fontSize: "0.875rem" }}>
                                                    {resource.title}
                                                </Typography>
                                            </Stack>
                                            <Box
                                                sx={{
                                                    px: 0.85,
                                                    py: 0.2,
                                                    borderRadius: "3px",
                                                    bgcolor: resource.accent.bg,
                                                    color: resource.accent.text,
                                                    fontSize: "0.7rem",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {resource.percent}%
                                            </Box>
                                        </Stack>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: tokens.textPrimary, fontSize: "1.5rem", mb: 1.5 }}>
                                            {resource.value}
                                        </Typography>
                                        <LinearProgress
                                            variant="determinate"
                                            value={resource.percent}
                                            sx={{
                                                height: 6,
                                                borderRadius: "2px",
                                                bgcolor: tokens.subtleSurface,
                                                border: `1px solid ${tokens.border}`,
                                                mb: 1,
                                                "& .MuiLinearProgress-bar": {
                                                    borderRadius: "1px",
                                                    bgcolor: resource.accent.main,
                                                },
                                            }}
                                        />
                                        <Typography variant="caption" sx={{ color: tokens.textSecondary, fontSize: "0.75rem" }}>
                                            {resource.caption}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>

                {/* Organization, Port & InstaBox Docker Metrics */}
                <Card
                    variant="outlined"
                    sx={{
                        mt: 2.5,
                        borderRadius: "4px",
                        bgcolor: tokens.cardBg,
                        borderColor: tokens.border,
                    }}
                >
                    <Box
                        sx={{
                            px: 2.5,
                            py: 1.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: `1px solid ${tokens.border}`,
                        }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.textPrimary, fontSize: "0.95rem" }}>
                            Organization, Ports &amp; InstaBox Inventory
                        </Typography>
                        <Typography variant="caption" sx={{ color: tokens.textSubtle, fontFamily: "monospace" }}>
                            {data.orgMetrics.runningContainers}/{data.orgMetrics.totalContainers} containers running
                        </Typography>
                    </Box>

                    <Box sx={{ p: 2 }}>
                        <Grid container spacing={1.5}>
                            {orgBreakdownCards.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Grid key={item.label} size={{ xs: 6, sm: 4, md: 3, lg: 12 / 7 }}>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                borderRadius: "4px",
                                                bgcolor: tokens.subtleSurface,
                                                border: `1px solid ${tokens.border}`,
                                                height: "100%",
                                            }}
                                        >
                                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: tokens.textSubtle,
                                                        fontWeight: 700,
                                                        fontSize: "0.68rem",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.03em",
                                                    }}
                                                >
                                                    {item.label}
                                                </Typography>
                                                <Icon sx={{ fontSize: 15, color: item.accent.main }} />
                                            </Stack>
                                            <Typography
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: "1.25rem",
                                                    color: tokens.textPrimary,
                                                    lineHeight: 1.2,
                                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                }}
                                            >
                                                {item.value}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: tokens.textSecondary, fontSize: "0.7rem" }}>
                                                {item.sub}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                </Card>

                {/* Recent Machines List */}
                <Card
                    variant="outlined"
                    sx={{
                        mt: 2.5,
                        borderRadius: "4px",
                        bgcolor: tokens.cardBg,
                        borderColor: tokens.border,
                    }}
                >
                    <Box
                        sx={{
                            px: 2.5,
                            py: 1.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: `1px solid ${tokens.border}`,
                        }}
                    >
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.textPrimary, fontSize: "0.95rem" }}>
                                Recent Machines
                            </Typography>
                            <Box
                                sx={{
                                    px: 0.85,
                                    py: 0.15,
                                    borderRadius: "3px",
                                    bgcolor: tokens.brandBg,
                                    color: tokens.brandMain,
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    border: `1px solid ${tokens.brandBorder}`,
                                }}
                            >
                                {data.machines.length}
                            </Box>
                        </Stack>

                        <Button
                            size="small"
                            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                            onClick={() => navigate("/machines")}
                            sx={{
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                                color: tokens.brandMain,
                                px: 1,
                                "&:hover": {
                                    bgcolor: tokens.brandBg,
                                },
                            }}
                        >
                            View all
                        </Button>
                    </Box>

                    <Box>
                        {data.machines.slice(0, 5).map((machine, index) => {
                            const statusStyle = machine.isRunning ? tokens.green : tokens.neutral;
                            return (
                                <Box key={machine.id ?? machine.name}>
                                    <Box
                                        onClick={() => machine.id && navigate(`/machines/${machine.id}`)}
                                        sx={{
                                            px: 2.5,
                                            py: 1.5,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 2,
                                            cursor: machine.id ? "pointer" : "default",
                                            transition: "background-color 0.15s ease",
                                            "&:hover": {
                                                bgcolor: tokens.hoverSurface,
                                            },
                                        }}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={1.5}>
                                            <Box
                                                sx={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: "4px",
                                                    bgcolor: machine.isRunning ? tokens.blue.bg : tokens.neutral.bg,
                                                    color: machine.isRunning ? tokens.blue.main : tokens.neutral.main,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <Dns fontSize="small" />
                                            </Box>

                                            <Box>
                                                <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: tokens.textPrimary, lineHeight: 1.3 }}>
                                                    {machine.name}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                        color: tokens.textSubtle,
                                                        fontSize: "0.75rem",
                                                    }}
                                                >
                                                    {machine.ip}
                                                </Typography>
                                            </Box>
                                        </Stack>

                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
                                                <Box
                                                    sx={{
                                                        px: 1,
                                                        py: 0.35,
                                                        borderRadius: "3px",
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                        fontSize: "0.75rem",
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    CPU: <strong style={{ color: tokens.textPrimary }}>{machine.cpu}%</strong>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        px: 1,
                                                        py: 0.35,
                                                        borderRadius: "3px",
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                        fontSize: "0.75rem",
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    MEM: <strong style={{ color: tokens.textPrimary }}>{machine.memory}%</strong>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        px: 1,
                                                        py: 0.35,
                                                        borderRadius: "3px",
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                        fontSize: "0.75rem",
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    PORTS: <strong style={{ color: tokens.textPrimary }}>{machine.portsCount}</strong>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        px: 1,
                                                        py: 0.35,
                                                        borderRadius: "3px",
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                        fontSize: "0.75rem",
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    DOCKER: <strong style={{ color: tokens.textPrimary }}>{machine.containersRunning}/{machine.containersTotal}</strong>
                                                </Box>
                                            </Stack>

                                            <Box
                                                sx={{
                                                    px: 1,
                                                    py: 0.25,
                                                    borderRadius: "3px",
                                                    bgcolor: statusStyle.bg,
                                                    color: statusStyle.text,
                                                    fontSize: "0.6875rem",
                                                    fontWeight: 700,
                                                    letterSpacing: "0.04em",
                                                    textTransform: "uppercase",
                                                    minWidth: 72,
                                                    textAlign: "center",
                                                }}
                                            >
                                                {machine.status}
                                            </Box>
                                        </Stack>
                                    </Box>

                                    {index < Math.min(data.machines.length, 5) - 1 && (
                                        <Divider sx={{ borderColor: tokens.border }} />
                                    )}
                                </Box>
                            );
                        })}

                        {!loading && data.machines.length === 0 && (
                            <Box sx={{ px: 2.5, py: 4, textAlign: "center" }}>
                                <Typography variant="body2" sx={{ color: tokens.textSecondary }}>
                                    No machines registered yet. Click &ldquo;Add machine&rdquo; to get started.
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Card>
            </Box>
        </Box>
    );
}