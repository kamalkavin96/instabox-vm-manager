import { useEffect, useState, useCallback, useMemo } from "react";
import {
    Button,
    Paper,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    CardActions,
    Stack,
    IconButton,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup,
    Divider,
    Modal,
    useTheme,
} from "@mui/material";
import {
    Dns,
    ContentCopy,
    Refresh,
    Close,
    InfoOutlined,
} from "@mui/icons-material";

import PageHeader from "../../../components/common/PageHeader";
import { getMachineList } from "../machinesApi";
import useNotification from "../../../hooks/useNotification";
import { useAppSelector } from "../../../hooks/redux";

const JIRA_ACCENTS = [
    {
        light: { main: "#1868DB", bg: "#E9F2FF", text: "#0055CC" },
        dark: { main: "#579DFF", bg: "#1C2B41", text: "#85B8FF" },
    },
    {
        light: { main: "#22A06B", bg: "#DCFFF1", text: "#216E4E" },
        dark: { main: "#4BCE97", bg: "#163326", text: "#7EE2B8" },
    },
    {
        light: { main: "#8270DB", bg: "#F3F0FF", text: "#5E4DB2" },
        dark: { main: "#9F8FEF", bg: "#2B244D", text: "#B8ACF6" },
    },
    {
        light: { main: "#1D9AAA", bg: "#E7F9FF", text: "#206A83" },
        dark: { main: "#6CC3E0", bg: "#16323B", text: "#9DD9EE" },
    },
    {
        light: { main: "#E56910", bg: "#FFF3EB", text: "#A54800" },
        dark: { main: "#FEA362", bg: "#382516", text: "#FEC195" },
    },
    {
        light: { main: "#CD519D", bg: "#FFECF8", text: "#943D73" },
        dark: { main: "#E774BB", bg: "#371C2D", text: "#F797D2" },
    },
];

const getJiraTokens = (isDark) => ({
    canvasBg: isDark ? "#1D2125" : "#F7F8F9",
    cardBg: isDark ? "#22272B" : "#FFFFFF",
    cardFooterBg: isDark ? "#1D2125" : "#FAFBFC",
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
    green: isDark
        ? { main: "#4BCE97", bg: "#163326", text: "#7EE2B8" }
        : { main: "#22A06B", bg: "#DCFFF1", text: "#216E4E" },
    red: isDark
        ? { main: "#F87168", bg: "#3B1C1A", text: "#FD9891" }
        : { main: "#C9372C", bg: "#FFECEB", text: "#AE2E24" },
    amber: isDark
        ? { main: "#FEA362", bg: "#382516", text: "#FEC195" }
        : { main: "#E56910", bg: "#FFF3EB", text: "#A54800" },
    neutral: isDark
        ? { main: "#8C9BAB", bg: "#2C333A", text: "#B6C2CF" }
        : { main: "#626F86", bg: "#F1F2F4", text: "#44546F" },
    cardShadowHover: isDark
        ? "0 6px 12px -2px rgba(3, 4, 4, 0.55), 0 0 1px rgba(255, 255, 255, 0.12)"
        : "0 4px 8px -2px rgba(9, 30, 66, 0.12), 0 0 1px rgba(9, 30, 66, 0.31)",
});

const formatDateTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatMem = (memMiB) => {
    if (memMiB === null || memMiB === undefined) return "-";
    if (memMiB >= 1024) {
        return `${(memMiB / 1024).toFixed(1).replace(/\.0$/, "")} GiB`;
    }
    return `${memMiB} MiB`;
};

export default function Machines() {
    const theme = useTheme();
    const mode = useAppSelector((state) => state.ui?.theme);
    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(() => getJiraTokens(isDark), [isDark]);

    const [machineList, setMachineList] = useState([]);
    const [columns, setColumns] = useState(3);
    const [loading, setLoading] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState(null);

    const notify = useNotification();

    const fetchMachines = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getMachineList();
            setMachineList(Array.isArray(response) ? response : []);
        } catch (err) {
            console.error("Failed to fetch machines:", err);
            notify.error("Failed to load machines.");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        void fetchMachines();
    }, [fetchMachines]);

    const handleCopy = async (value, label = "Machine ID") => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(String(value));
            notify.success(`${label} copied.`);
        } catch {
            notify.error(`Unable to copy ${label.toLowerCase()}.`);
        }
    };

    const getStateLozenge = (state) => {
        const s = (state || "").toLowerCase();
        if (["running", "ready", "active"].includes(s)) return tokens.green;
        if (["failed", "error", "oom"].includes(s)) return tokens.red;
        if (["starting", "stopping", "suspending", "pending"].includes(s)) return tokens.amber;
        return tokens.neutral;
    };

    const getAccent = (index) => {
        const pair = JIRA_ACCENTS[index % JIRA_ACCENTS.length];
        return isDark ? pair.dark : pair.light;
    };

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
                title="Machines"
                subtitle="Compute instances, specifications, runtime flags, and synced metadata"
                count={machineList.length}
                countLabel="Total"
                countIcon={Dns}
                sticky
                tokens={tokens}
                action={
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <ToggleButtonGroup
                            value={columns}
                            exclusive
                            size="small"
                            onChange={(event, value) => {
                                if (value !== null) setColumns(value);
                            }}
                            sx={{
                                height: 34,
                                bgcolor: tokens.subtleSurface,
                                "& .MuiToggleButton-root": {
                                    minWidth: 34,
                                    borderRadius: "3px",
                                    borderColor: tokens.border,
                                    color: tokens.textSecondary,
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    "&:hover": { bgcolor: tokens.cardBg },
                                    "&.Mui-selected": {
                                        bgcolor: tokens.brandBg,
                                        color: tokens.brandMain,
                                        borderColor: tokens.brandMain,
                                    },
                                },
                            }}
                        >
                            <ToggleButton value={2}>2</ToggleButton>
                            <ToggleButton value={3}>3</ToggleButton>
                            <ToggleButton value={4}>4</ToggleButton>
                        </ToggleButtonGroup>

                        <Button
                            variant="outlined"
                            startIcon={<Refresh fontSize="small" />}
                            onClick={() => void fetchMachines()}
                            disabled={loading}
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
                            Refresh
                        </Button>
                    </Stack>
                }
            />

            <Box sx={{ px: 3, pt: 2.5, flexGrow: 1 }}>
                <Grid container spacing={2}>
                    {machineList.map((m, index) => {
                        const accent = getAccent(index);
                        const stateStyle = getStateLozenge(m.state);

                        return (
                            <Grid key={m.id} size={{ xs: 12, sm: 6, md: 12 / columns }}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        borderRadius: "4px",
                                        bgcolor: tokens.cardBg,
                                        borderColor: tokens.border,
                                        borderTop: `3px solid ${accent.main}`,
                                        transition:
                                            "box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.2s ease",
                                        "&:hover": {
                                            borderColor: tokens.borderHover,
                                            borderTopColor: accent.main,
                                            boxShadow: tokens.cardShadowHover,
                                        },
                                    }}
                                >
                                    <CardContent sx={{ flexGrow: 1, p: 2 }}>
                                        {/* Header: Name, Template, State */}
                                        <Stack
                                            direction="row"
                                            alignItems="flex-start"
                                            spacing={1.5}
                                            sx={{ mb: 1.75 }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 38,
                                                    height: 38,
                                                    flexShrink: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    borderRadius: "4px",
                                                    bgcolor: accent.bg,
                                                    color: accent.main,
                                                    border: `1px solid ${accent.main}44`,
                                                }}
                                            >
                                                <Dns fontSize="small" />
                                            </Box>

                                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                                <Typography
                                                    variant="subtitle2"
                                                    noWrap
                                                    title={m.name || m.machineId}
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: tokens.textPrimary,
                                                        fontSize: "0.95rem",
                                                    }}
                                                >
                                                    {m.name || "Unnamed Machine"}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    noWrap
                                                    sx={{
                                                        color: tokens.textSubtle,
                                                        display: "block",
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {m.templateId || "No template"}
                                                    {m.templateVersion ? ` (${m.templateVersion})` : ""}
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={{
                                                    px: 1,
                                                    py: 0.25,
                                                    borderRadius: "3px",
                                                    bgcolor: stateStyle.bg,
                                                    color: stateStyle.text,
                                                    fontSize: "0.6875rem",
                                                    fontWeight: 700,
                                                    letterSpacing: "0.04em",
                                                    textTransform: "uppercase",
                                                    lineHeight: 1.4,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {m.state || "UNKNOWN"}
                                            </Box>
                                        </Stack>

                                        {/* Machine ID Key Box */}
                                        <Box
                                            sx={{
                                                mb: 1.75,
                                                px: 1.25,
                                                py: 0.75,
                                                bgcolor: tokens.subtleSurface,
                                                border: `1px solid ${tokens.border}`,
                                                borderRadius: "3px",
                                            }}
                                        >
                                            <Stack
                                                direction="row"
                                                justifyContent="space-between"
                                                alignItems="center"
                                            >
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: tokens.textSubtle,
                                                        fontWeight: 600,
                                                        fontSize: "0.6875rem",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.03em",
                                                    }}
                                                >
                                                    Machine ID
                                                </Typography>
                                                {m.desiredState && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: tokens.textSecondary,
                                                            fontSize: "0.6875rem",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        Desired: {m.desiredState}
                                                    </Typography>
                                                )}
                                            </Stack>

                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        flexGrow: 1,
                                                        fontFamily:
                                                            "'JetBrains Mono', 'Fira Code', monospace",
                                                        fontSize: "0.8rem",
                                                        fontWeight: 600,
                                                        color: tokens.textPrimary,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    title={m.machineId}
                                                >
                                                    {m.machineId}
                                                </Typography>
                                                <Tooltip title="Copy Machine ID" arrow>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            void handleCopy(m.machineId, "Machine ID")
                                                        }
                                                        sx={{
                                                            p: 0.4,
                                                            borderRadius: "3px",
                                                            color: tokens.textSecondary,
                                                            "&:hover": {
                                                                bgcolor: tokens.border,
                                                                color: tokens.textPrimary,
                                                            },
                                                        }}
                                                    >
                                                        <ContentCopy sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </Box>

                                        {/* Specs Row: vCPUs, Memory, Root/Persistent Disk */}
                                        <Grid container spacing={1} sx={{ mb: 1.75 }}>
                                            <Grid size={4}>
                                                <Box
                                                    sx={{
                                                        p: 0.75,
                                                        borderRadius: "3px",
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: tokens.textSubtle,
                                                            fontSize: "0.65rem",
                                                            fontWeight: 700,
                                                            display: "block",
                                                        }}
                                                    >
                                                        VCPUS
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            fontFamily: "monospace",
                                                            fontSize: "0.8rem",
                                                            fontWeight: 700,
                                                            color: tokens.textPrimary,
                                                        }}
                                                    >
                                                        {m.vcpus ?? "-"}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid size={4}>
                                                <Box
                                                    sx={{
                                                        p: 0.75,
                                                        borderRadius: "3px",
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: tokens.textSubtle,
                                                            fontSize: "0.65rem",
                                                            fontWeight: 700,
                                                            display: "block",
                                                        }}
                                                    >
                                                        MEMORY
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            fontFamily: "monospace",
                                                            fontSize: "0.8rem",
                                                            fontWeight: 700,
                                                            color: tokens.textPrimary,
                                                        }}
                                                    >
                                                        {formatMem(m.memMiB)}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid size={4}>
                                                <Box
                                                    sx={{
                                                        p: 0.75,
                                                        borderRadius: "3px",
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: tokens.textSubtle,
                                                            fontSize: "0.65rem",
                                                            fontWeight: 700,
                                                            display: "block",
                                                        }}
                                                    >
                                                        DISK (R/P)
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            fontFamily: "monospace",
                                                            fontSize: "0.8rem",
                                                            fontWeight: 700,
                                                            color: tokens.textPrimary,
                                                        }}
                                                    >
                                                        {m.rootDiskGiB ?? 0}/{m.persistentDiskGiB ?? 0}G
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>

                                        {/* Runtime & Telemetry Flags */}
                                        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.5 }}>
                                            <Box
                                                sx={{
                                                    px: 0.75,
                                                    py: 0.2,
                                                    borderRadius: "3px",
                                                    fontSize: "0.6875rem",
                                                    fontWeight: 600,
                                                    bgcolor: m.runtimeReady
                                                        ? tokens.green.bg
                                                        : tokens.neutral.bg,
                                                    color: m.runtimeReady
                                                        ? tokens.green.text
                                                        : tokens.neutral.text,
                                                }}
                                            >
                                                Ready: {m.runtimeReady ? "Yes" : "No"}
                                            </Box>

                                            {m.vault && (
                                                <Box
                                                    sx={{
                                                        px: 0.75,
                                                        py: 0.2,
                                                        borderRadius: "3px",
                                                        fontSize: "0.6875rem",
                                                        fontWeight: 600,
                                                        bgcolor: tokens.brandBg,
                                                        color: tokens.brandMain,
                                                    }}
                                                >
                                                    Vault
                                                </Box>
                                            )}

                                            {m.free && (
                                                <Box
                                                    sx={{
                                                        px: 0.75,
                                                        py: 0.2,
                                                        borderRadius: "3px",
                                                        fontSize: "0.6875rem",
                                                        fontWeight: 600,
                                                        bgcolor: tokens.subtleSurface,
                                                        border: `1px solid ${tokens.border}`,
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    Free
                                                </Box>
                                            )}

                                            {(m.oomKills ?? 0) > 0 && (
                                                <Box
                                                    sx={{
                                                        px: 0.75,
                                                        py: 0.2,
                                                        borderRadius: "3px",
                                                        fontSize: "0.6875rem",
                                                        fontWeight: 700,
                                                        bgcolor: tokens.red.bg,
                                                        color: tokens.red.text,
                                                    }}
                                                >
                                                    OOM Kills: {m.oomKills}
                                                </Box>
                                            )}
                                        </Stack>

                                        {/* Org & Sync Info */}
                                        <Stack spacing={0.5}>
                                            <Typography
                                                variant="caption"
                                                noWrap
                                                sx={{ color: tokens.textSecondary }}
                                            >
                                                Org:{" "}
                                                <strong style={{ color: tokens.textPrimary }}>
                                                    {m.organizationId || "-"}
                                                </strong>
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                noWrap
                                                sx={{ color: tokens.textSubtle }}
                                            >
                                                Synced: {formatDateTime(m.syncedAt)}
                                            </Typography>
                                        </Stack>
                                    </CardContent>

                                    <Divider sx={{ borderColor: tokens.border }} />

                                    <CardActions
                                        sx={{
                                            px: 2,
                                            py: 1,
                                            bgcolor: tokens.cardFooterBg,
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontFamily: "monospace",
                                                color: tokens.textSubtle,
                                                fontWeight: 600,
                                            }}
                                        >
                                            Id:{m.id}
                                        </Typography>
                                        <Button
                                            size="small"
                                            startIcon={<InfoOutlined sx={{ fontSize: 14 }} />}
                                            onClick={() => setSelectedMachine(m)}
                                            sx={{
                                                borderRadius: "3px",
                                                textTransform: "none",
                                                fontWeight: 600,
                                                fontSize: "0.8rem",
                                                color: tokens.brandMain,
                                                px: 1,
                                                py: 0.25,
                                                "&:hover": { bgcolor: tokens.brandBg },
                                            }}
                                        >
                                            All columns
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        );
                    })}

                    {!loading && machineList.length === 0 && (
                        <Grid size={12}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    py: 7,
                                    px: 3,
                                    textAlign: "center",
                                    borderRadius: "4px",
                                    borderColor: tokens.border,
                                    bgcolor: tokens.cardBg,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 52,
                                        height: 52,
                                        mx: "auto",
                                        mb: 2,
                                        borderRadius: "4px",
                                        bgcolor: tokens.brandBg,
                                        color: tokens.brandMain,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Dns sx={{ fontSize: 28 }} />
                                </Box>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700, color: tokens.textPrimary, mb: 0.5 }}
                                >
                                    No machines found
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: tokens.textSecondary,
                                        mb: 2.5,
                                        maxWidth: 420,
                                        mx: "auto",
                                    }}
                                >
                                    Create an organization with a valid Instabox API key to sync
                                    machines into `instabox_machines`.
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<Refresh fontSize="small" />}
                                    onClick={() => void fetchMachines()}
                                    disableElevation
                                    sx={{
                                        bgcolor: tokens.brandMain,
                                        color: isDark ? "#1D2125" : "#FFFFFF",
                                        borderRadius: "3px",
                                        textTransform: "none",
                                        fontWeight: 600,
                                        "&:hover": { bgcolor: tokens.brandHover },
                                    }}
                                >
                                    Reload machines
                                </Button>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            </Box>

            {/* Full Column Inspector Modal */}
            <Modal
                open={Boolean(selectedMachine)}
                onClose={() => setSelectedMachine(null)}
            >
                <Box
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 680,
                        maxWidth: "94%",
                        maxHeight: "86vh",
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: tokens.cardBg,
                        color: tokens.textPrimary,
                        borderRadius: "4px",
                        border: `1px solid ${tokens.border}`,
                        borderTop: `3px solid ${tokens.brandMain}`,
                        outline: "none",
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            px: 2.5,
                            py: 1.75,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: `1px solid ${tokens.border}`,
                        }}
                    >
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {selectedMachine?.name || selectedMachine?.machineId}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ fontFamily: "monospace", color: tokens.textSubtle }}
                            >
                                {selectedMachine?.machineId}
                            </Typography>
                        </Box>
                        <IconButton
                            size="small"
                            onClick={() => setSelectedMachine(null)}
                            sx={{ borderRadius: "3px", color: tokens.textSecondary }}
                        >
                            <Close fontSize="small" />
                        </IconButton>
                    </Box>

                    <Box sx={{ p: 2.5, overflowY: "auto" }}>
                        {selectedMachine && (
                            <Grid container spacing={1.25}>
                                {[
                                    ["id", selectedMachine.id],
                                    ["machineId", selectedMachine.machineId],
                                    ["name", selectedMachine.name],
                                    ["desiredState", selectedMachine.desiredState],
                                    ["state", selectedMachine.state],
                                    ["revision", selectedMachine.revision],
                                    ["operationId", selectedMachine.operationId],
                                    ["templateId", selectedMachine.templateId],
                                    ["templateVersion", selectedMachine.templateVersion],
                                    ["templateDigest", selectedMachine.templateDigest],
                                    ["vcpus", selectedMachine.vcpus],
                                    ["memMiB", selectedMachine.memMiB],
                                    ["persistentDiskGiB", selectedMachine.persistentDiskGiB],
                                    ["rootDiskGiB", selectedMachine.rootDiskGiB],
                                    ["storageSizeGiB", selectedMachine.storageSizeGiB],
                                    ["storageMountPath", selectedMachine.storageMountPath],
                                    ["storagePersistent", String(selectedMachine.storagePersistent)],
                                    ["storageSynced", String(selectedMachine.storageSynced)],
                                    ["snapshotSeq", selectedMachine.snapshotSeq],
                                    ["runtimeReady", String(selectedMachine.runtimeReady)],
                                    [
                                        "processesPreserved",
                                        String(selectedMachine.processesPreserved),
                                    ],
                                    [
                                        "autoSuspendAfterSeconds",
                                        selectedMachine.autoSuspendAfterSeconds,
                                    ],
                                    ["maxRunMinutes", selectedMachine.maxRunMinutes],
                                    ["runStartedAt", formatDateTime(selectedMachine.runStartedAt)],
                                    ["readyAt", formatDateTime(selectedMachine.readyAt)],
                                    ["cooldownUntil", formatDateTime(selectedMachine.cooldownUntil)],
                                    ["vault", String(selectedMachine.vault)],
                                    ["guestUser", selectedMachine.guestUser],
                                    ["organizationId", selectedMachine.organizationId],
                                    ["free", String(selectedMachine.free)],
                                    ["oomKills", selectedMachine.oomKills],
                                    [
                                        "machineCreatedAt",
                                        formatDateTime(selectedMachine.machineCreatedAt),
                                    ],
                                    [
                                        "machineUpdatedAt",
                                        formatDateTime(selectedMachine.machineUpdatedAt),
                                    ],
                                    ["syncedAt", formatDateTime(selectedMachine.syncedAt)],
                                ].map(([key, val]) => (
                                    <Grid key={key} size={{ xs: 12, sm: 6 }}>
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: "3px",
                                                bgcolor: tokens.subtleSurface,
                                                border: `1px solid ${tokens.border}`,
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    fontFamily: "monospace",
                                                    fontSize: "0.7rem",
                                                    color: tokens.textSubtle,
                                                    display: "block",
                                                }}
                                            >
                                                {key}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontFamily: "monospace",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 600,
                                                    color: tokens.textPrimary,
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                {val ?? "-"}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                ))}

                                <Grid size={12}>
                                    <Box
                                        sx={{
                                            p: 1.25,
                                            borderRadius: "3px",
                                            bgcolor: tokens.subtleSurface,
                                            border: `1px solid ${tokens.border}`,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontFamily: "monospace",
                                                fontSize: "0.7rem",
                                                color: tokens.textSubtle,
                                                display: "block",
                                                mb: 0.5,
                                            }}
                                        >
                                            metadata (jsonb)
                                        </Typography>
                                        <Typography
                                            component="pre"
                                            sx={{
                                                m: 0,
                                                fontFamily: "monospace",
                                                fontSize: "0.75rem",
                                                color: tokens.textPrimary,
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {JSON.stringify(selectedMachine.metadata ?? {}, null, 2)}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        )}
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
}