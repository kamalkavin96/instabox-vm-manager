import { useState, useMemo } from "react";
import {
    Box,
    Paper,
    Typography,
    Stack,
    Grid,
    Button,
    IconButton,
    Tooltip,
    Tabs,
    Tab,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Divider,
    Switch,
    FormControlLabel,
    useTheme,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import BoltIcon from "@mui/icons-material/Bolt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LockIcon from "@mui/icons-material/Lock";
import PublicIcon from "@mui/icons-material/Public";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import RestoreIcon from "@mui/icons-material/Restore";
import TerminalIcon from "@mui/icons-material/Terminal";
import SyncIcon from "@mui/icons-material/Sync";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useAppSelector } from "../hooks/redux";
import { useParams } from "react-router-dom";

const MOCK_MACHINE = {
    id: 101,
    machineId: "m_9x8k2p4m7n1q5r8t2v6w3y9z",
    name: "payments-worker-01",
    desiredState: "running",
    state: "running",
    revision: 14,
    operationId: "op_7f3c9a1e5b2d8046",
    templateId: "universal",
    templateVersion: "2026-10-13.10",
    templateDigest: "sha256:9f2c84a1e77d0b35c12a88e4f901b23d",
    vcpus: 4,
    memMiB: 8192,
    persistentDiskGiB: 40,
    rootDiskGiB: 16,
    storageSizeGiB: 56,
    storageMountPath: "/data",
    storagePersistent: true,
    storageSynced: true,
    snapshotSeq: 7,
    runtimeReady: true,
    processesPreserved: true,
    autoSuspendAfterSeconds: 900,
    maxRunMinutes: 480,
    runStartedAt: "2026-11-20T05:10:00Z",
    readyAt: "2026-11-20T05:10:06Z",
    cooldownUntil: null,
    metadata: {
        env: "staging",
        owner: "platform-team",
        setupStatus: "succeeded",
        setupExitCode: 0,
    },
    vault: true,
    guestUser: "boxuser",
    organizationId: "org_instabox_prod_01",
    free: false,
    oomKills: 0,
    machineCreatedAt: "2026-11-10T08:00:00Z",
    machineUpdatedAt: "2026-11-20T05:10:06Z",
    syncedAt: "2026-11-20T07:10:00Z",
};

const INITIAL_PORTS = [
    {
        id: "prt_1",
        port: 3000,
        name: "Web UI",
        protocol: "http",
        visibility: "public",
        url: "https://3000-m_9x8k2p4m7n1q5r8t2v6w3y9z.instabox.sh",
    },
    {
        id: "prt_2",
        port: 8080,
        name: "Internal API",
        protocol: "http",
        visibility: "private",
        url: "https://8080-m_9x8k2p4m7n1q5r8t2v6w3y9z.instabox.sh?_token=ibp_live_99a1bc23",
    },
    {
        id: "prt_3",
        port: 5432,
        name: "Postgres TLS",
        protocol: "tcp",
        visibility: "public",
        url: "5432-m_9x8k2p4m7n1q5r8t2v6w3y9z.instabox.sh:443",
    },
];

const INITIAL_SNAPSHOTS = [
    {
        id: "sn_q4mz7tk2bx5rn3wd6vp2hj4sye",
        name: "pre-deploy-baseline",
        status: "ready",
        rootOnly: false,
        createdAt: "2026-11-18T14:20:00Z",
    },
    {
        id: "sn_8r2n5v9x1c4m7p3k6j0w2z5y",
        name: "clean-toolchain-v2",
        status: "ready",
        rootOnly: true,
        createdAt: "2026-11-15T09:05:00Z",
    },
];

const INITIAL_OPERATIONS = [
    {
        id: "op_7f3c9a1e5b2d8046",
        type: "machine.start",
        status: "succeeded",
        idempotencyKey: "idem_88412a90-44d1-4c2b",
        createdAt: "2026-11-20T05:10:00Z",
    },
    {
        id: "op_3a9d1e4f8c2b6071",
        type: "port.publish",
        status: "succeeded",
        idempotencyKey: "idem_19204f11-88a3-4e9d",
        createdAt: "2026-11-19T16:42:00Z",
    },
];

const getTokens = (isDark) => ({
    canvasBg: isDark ? "#1D2125" : "#F7F8F9",
    cardBg: isDark ? "#22272B" : "#FFFFFF",
    subtleSurface: isDark ? "#161A1D" : "#F7F8F9",
    hoverSurface: isDark ? "#282E33" : "#F1F2F4",
    border: isDark ? "#38414A" : "#DFE1E6",
    textPrimary: isDark ? "#B6C2CF" : "#172B4D",
    textSecondary: isDark ? "#8C9BAB" : "#44546F",
    textSubtle: isDark ? "#738496" : "#626F86",
    brandMain: isDark ? "#579DFF" : "#1868DB",
    brandBg: isDark ? "#1C2B41" : "#E9F2FF",
    green: isDark
        ? { bg: "#163326", text: "#7EE2B8" }
        : { bg: "#DCFFF1", text: "#216E4E" },
    amber: isDark
        ? { bg: "#382516", text: "#FEC195" }
        : { bg: "#FFF3EB", text: "#A54800" },
    red: isDark
        ? { bg: "#3B1C1A", text: "#FD9891" }
        : { bg: "#FFECEB", text: "#AE2E24" },
    neutral: isDark
        ? { bg: "#2C333A", text: "#B6C2CF" }
        : { bg: "#F1F2F4", text: "#44546F" },
});

export default function ManageMachinePreview() {

    const { id } = useParams();
    const theme = useTheme();
    const mode = useAppSelector((state) => state.ui?.theme);
    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(() => getTokens(isDark), [isDark]);

    const [machine, setMachine] = useState(MOCK_MACHINE);
    const [tab, setTab] = useState(0);
    const [ports, setPorts] = useState(INITIAL_PORTS);
    const [snapshots, setSnapshots] = useState(INITIAL_SNAPSHOTS);
    const [operations, setOperations] = useState(INITIAL_OPERATIONS);
    const [newPortNumber, setNewPortNumber] = useState("5173");
    const [newPortName, setNewPortName] = useState("Vite Preview");
    const [newPortPrivate, setNewPortPrivate] = useState(false);
    const [snapshotName, setSnapshotName] = useState("");
    const [commandInput, setCommandInput] = useState("uptime && df -h /data");
    const [commandOutput, setCommandOutput] = useState(
        "$ uptime && df -h /data\n 07:10:00 up 2:00,  0 users,  load average: 0.14, 0.09, 0.05\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/vdb         40G  6.4G  33.6G  16% /data"
    );
    const [toastMsg, setToastMsg] = useState("Preview mode: mock InstaBox OpenAPI data loaded.");

    const pushOp = (type, nextState) => {
        const opId = `op_${Math.random().toString(36).slice(2, 12)}`;
        setMachine((prev) => ({
            ...prev,
            state: nextState ?? prev.state,
            desiredState: nextState ?? prev.desiredState,
            operationId: opId,
            revision: (prev.revision || 0) + 1,
            runtimeReady: (nextState ?? prev.state) === "running",
        }));
        setOperations((prev) => [
            {
                id: opId,
                type,
                status: "succeeded",
                idempotencyKey: `idem_${Math.random().toString(36).slice(2, 10)}`,
                createdAt: new Date().toISOString(),
            },
            ...prev,
        ]);
        setToastMsg(`Mock operation "${type}" completed (${opId}).`);
    };

    const handleCopy = (val, label = "Value") => {
        navigator.clipboard?.writeText(String(val));
        setToastMsg(`${label} copied to clipboard.`);
    };

    const handleAddPort = (e) => {
        e.preventDefault();
        const num = Number(newPortNumber);
        if (!num || num < 1 || num > 65535) return;
        const visibility = newPortPrivate ? "private" : "public";
        const baseUrl = `https://${num}-${machine.machineId}.instabox.sh`;
        const url = newPortPrivate
            ? `${baseUrl}?_token=ibp_preview_${Math.random().toString(36).slice(2, 8)}`
            : baseUrl;
        setPorts((prev) => [
            ...prev,
            {
                id: `prt_${Date.now()}`,
                port: num,
                name: newPortName.trim() || `Port ${num}`,
                protocol: "http",
                visibility,
                url,
            },
        ]);
        setNewPortName("");
        pushOp("port.publish");
    };

    const handleCreateSnapshot = (e) => {
        e.preventDefault();
        if (!snapshotName.trim()) return;
        setSnapshots((prev) => [
            {
                id: `sn_${Math.random().toString(36).slice(2, 14)}`,
                name: snapshotName.trim(),
                status: "ready",
                rootOnly: false,
                createdAt: new Date().toISOString(),
            },
            ...prev,
        ]);
        setSnapshotName("");
        pushOp("snapshot.create");
    };

    const handleRunCommand = (e) => {
        e.preventDefault();
        if (!commandInput.trim()) return;
        setCommandOutput(
            `$ ${commandInput.trim()}\n[exit 0] Command executed in workspace ${machine.organizationId} (${machine.guestUser}@${machine.machineId})`
        );
        pushOp("machine.exec");
    };

    const stateBadge =
        machine.state === "running"
            ? tokens.green
            : machine.state === "paused"
            ? tokens.amber
            : tokens.neutral;

    return (
        <Box sx={{ bgcolor: tokens.canvasBg, minHeight: "100vh", pb: 5 }}>
            {/* Top Bar */}
            <Paper
                square
                elevation={0}
                sx={{
                    px: 3,
                    py: 1.5,
                    bgcolor: tokens.cardBg,
                    borderBottom: `1px solid ${tokens.border}`,
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                }}
            >
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    spacing={1.5}
                >
                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                        <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.textPrimary }}>
                            {machine.name}
                        </Typography>
                        <Box
                            sx={{
                                px: 1,
                                py: 0.2,
                                borderRadius: "3px",
                                bgcolor: stateBadge.bg,
                                color: stateBadge.text,
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                            }}
                        >
                            {machine.state}
                        </Box>
                        <Typography
                            variant="caption"
                            sx={{ fontFamily: "monospace", color: tokens.textSubtle }}
                        >
                            {machine.machineId}
                        </Typography>
                        <Tooltip title="Copy Machine ID">
                            <IconButton
                                size="small"
                                onClick={() => handleCopy(machine.machineId, "Machine ID")}
                            >
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    {/* Lifecycle Actions */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            startIcon={<PlayArrowIcon fontSize="small" />}
                            onClick={() => pushOp("machine.start", "running")}
                            sx={{ borderRadius: "3px", textTransform: "none", fontWeight: 600 }}
                        >
                            Start
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PauseIcon fontSize="small" />}
                            onClick={() => pushOp("machine.pause", "paused")}
                            sx={{
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                borderColor: tokens.border,
                                color: tokens.textPrimary,
                            }}
                        >
                            Pause
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<BoltIcon fontSize="small" />}
                            onClick={() => pushOp("machine.resume", "running")}
                            sx={{
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                borderColor: tokens.border,
                                color: tokens.textPrimary,
                            }}
                        >
                            Resume
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RestartAltIcon fontSize="small" />}
                            onClick={() => pushOp("machine.restart", "running")}
                            sx={{
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                borderColor: tokens.border,
                                color: tokens.textPrimary,
                            }}
                        >
                            Restart
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<StopIcon fontSize="small" />}
                            onClick={() => pushOp("machine.stop", "stopped")}
                            sx={{
                                borderRadius: "3px",
                                textTransform: "none",
                                fontWeight: 600,
                                borderColor: tokens.border,
                                color: tokens.textPrimary,
                            }}
                        >
                            Stop
                        </Button>
                    </Stack>
                </Stack>

                <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 0.75, color: tokens.brandMain, fontWeight: 600 }}
                >
                    {toastMsg}
                </Typography>
            </Paper>

            <Box sx={{ px: 3, pt: 2.5 }}>
                {/* Spec Strip */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {[
                        ["vCPU / Memory", `${machine.vcpus} vCPU / ${machine.memMiB / 1024} GiB`],
                        [
                            "Root / Persistent Disk",
                            `${machine.rootDiskGiB}G / ${machine.persistentDiskGiB}G (${machine.storageMountPath})`,
                        ],
                        ["Template", `${machine.templateId} (${machine.templateVersion})`],
                        ["Org / Guest", `${machine.organizationId} • ${machine.guestUser}`],
                    ].map(([label, val]) => (
                        <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 1.5,
                                    borderRadius: "4px",
                                    bgcolor: tokens.cardBg,
                                    borderColor: tokens.border,
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{ color: tokens.textSubtle, fontWeight: 700 }}
                                >
                                    {label}
                                </Typography>
                                <Typography
                                    noWrap
                                    sx={{
                                        mt: 0.25,
                                        fontFamily: "monospace",
                                        fontSize: "0.85rem",
                                        fontWeight: 700,
                                        color: tokens.textPrimary,
                                    }}
                                >
                                    {val}
                                </Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                {/* Navigation Tabs */}
                <Paper
                    variant="outlined"
                    sx={{
                        borderRadius: "4px",
                        bgcolor: tokens.cardBg,
                        borderColor: tokens.border,
                        mb: 2.5,
                    }}
                >
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            px: 1.5,
                            "& .MuiTab-root": {
                                textTransform: "none",
                                fontWeight: 600,
                                color: tokens.textSecondary,
                            },
                            "& .Mui-selected": { color: `${tokens.brandMain} !important` },
                        }}
                    >
                        <Tab label={`Ports & URLs (${ports.length})`} />
                        <Tab label="Exec & SSH" />
                        <Tab label={`Snapshots & Resize (${snapshots.length})`} />
                        <Tab label={`Operations & Schema (${operations.length})`} />
                    </Tabs>
                </Paper>

                {/* TAB 0: PORTS & URLS */}
                {tab === 0 && (
                    <Stack spacing={2}>
                        <Paper
                            component="form"
                            onSubmit={handleAddPort}
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 700, color: tokens.textPrimary, mb: 1.5 }}
                            >
                                Publish Port & Generate URL
                            </Typography>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1.5}
                                alignItems="center"
                            >
                                <TextField
                                    size="small"
                                    label="Port"
                                    value={newPortNumber}
                                    onChange={(e) => setNewPortNumber(e.target.value)}
                                    sx={{ width: 120 }}
                                />
                                <TextField
                                    size="small"
                                    label="Label"
                                    value={newPortName}
                                    onChange={(e) => setNewPortName(e.target.value)}
                                    sx={{ flexGrow: 1 }}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={newPortPrivate}
                                            onChange={(e) => setNewPortPrivate(e.target.checked)}
                                        />
                                    }
                                    label="Private token"
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disableElevation
                                    startIcon={<AddIcon fontSize="small" />}
                                    sx={{ borderRadius: "3px", textTransform: "none" }}
                                >
                                    Publish
                                </Button>
                            </Stack>
                        </Paper>

                        <TableContainer
                            component={Paper}
                            variant="outlined"
                            sx={{
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: tokens.subtleSurface }}>
                                        {["Port", "Service", "Access", "Endpoint / URL", "Actions"].map(
                                            (h) => (
                                                <TableCell
                                                    key={h}
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    {h}
                                                </TableCell>
                                            )
                                        )}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {ports.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                                                {p.port} ({p.protocol})
                                            </TableCell>
                                            <TableCell>{p.name}</TableCell>
                                            <TableCell>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                        px: 0.75,
                                                        py: 0.2,
                                                        borderRadius: "3px",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 700,
                                                        bgcolor:
                                                            p.visibility === "private"
                                                                ? tokens.amber.bg
                                                                : tokens.green.bg,
                                                        color:
                                                            p.visibility === "private"
                                                                ? tokens.amber.text
                                                                : tokens.green.text,
                                                    }}
                                                >
                                                    {p.visibility === "private" ? (
                                                        <LockIcon sx={{ fontSize: 12 }} />
                                                    ) : (
                                                        <PublicIcon sx={{ fontSize: 12 }} />
                                                    )}
                                                    {p.visibility}
                                                </Box>
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    fontFamily: "monospace",
                                                    fontSize: "0.78rem",
                                                    maxWidth: 380,
                                                }}
                                            >
                                                <Typography noWrap variant="caption" component="div">
                                                    {p.url}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={0.5}>
                                                    <Tooltip title="Copy URL">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleCopy(p.url, "Port URL")}
                                                        >
                                                            <ContentCopyIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {p.protocol === "http" && (
                                                        <Tooltip title="Open in browser">
                                                            <IconButton
                                                                size="small"
                                                                component="a"
                                                                href={p.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                <OpenInNewIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Unpublish port">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                                setPorts((prev) =>
                                                                    prev.filter((x) => x.id !== p.id)
                                                                )
                                                            }
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Stack>
                )}

                {/* TAB 1: EXEC & SSH */}
                {tab === 1 && (
                    <Stack spacing={2}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                SSH & Port Forward Snippets
                            </Typography>
                            <Stack spacing={1}>
                                {[
                                    ["SSH Shell", `instabox ssh ${machine.machineId}`],
                                    [
                                        "Local Port Forward",
                                        `instabox port-forward ${machine.machineId} 8080:3000`,
                                    ],
                                ].map(([label, cmd]) => (
                                    <Stack
                                        key={label}
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        sx={{
                                            p: 1,
                                            borderRadius: "3px",
                                            bgcolor: tokens.subtleSurface,
                                            border: `1px solid ${tokens.border}`,
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                                {label}
                                            </Typography>
                                            <Typography
                                                sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                                            >
                                                {cmd}
                                            </Typography>
                                        </Box>
                                        <IconButton size="small" onClick={() => handleCopy(cmd, label)}>
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                            </Stack>
                        </Paper>

                        <Paper
                            component="form"
                            onSubmit={handleRunCommand}
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                Run Command (POST /v1/machines/{"{id}"}/exec)
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    value={commandInput}
                                    onChange={(e) => setCommandInput(e.target.value)}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disableElevation
                                    startIcon={<TerminalIcon fontSize="small" />}
                                    sx={{ borderRadius: "3px", textTransform: "none" }}
                                >
                                    Exec
                                </Button>
                            </Stack>
                            <Box
                                component="pre"
                                sx={{
                                    m: 0,
                                    p: 1.5,
                                    borderRadius: "3px",
                                    bgcolor: tokens.subtleSurface,
                                    border: `1px solid ${tokens.border}`,
                                    fontFamily: "monospace",
                                    fontSize: "0.78rem",
                                    overflowX: "auto",
                                }}
                            >
                                {commandOutput}
                            </Box>
                        </Paper>
                    </Stack>
                )}

                {/* TAB 2: SNAPSHOTS & RESIZE */}
                {tab === 2 && (
                    <Stack spacing={2}>
                        <Paper
                            component="form"
                            onSubmit={handleCreateSnapshot}
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                Save Snapshot (POST /v1/machines/{"{id}"}/snapshots)
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    placeholder="e.g. before-migration"
                                    value={snapshotName}
                                    onChange={(e) => setSnapshotName(e.target.value)}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disableElevation
                                    startIcon={<CameraAltIcon fontSize="small" />}
                                    sx={{ borderRadius: "3px", textTransform: "none" }}
                                >
                                    Save Snapshot
                                </Button>
                            </Stack>
                        </Paper>

                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                                Snapshots (Restore In-Place)
                            </Typography>
                            <Stack spacing={1}>
                                {snapshots.map((s) => (
                                    <Stack
                                        key={s.id}
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        sx={{
                                            p: 1.25,
                                            borderRadius: "3px",
                                            bgcolor: tokens.subtleSurface,
                                            border: `1px solid ${tokens.border}`,
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                {s.name}{" "}
                                                <Typography
                                                    component="span"
                                                    variant="caption"
                                                    sx={{ fontFamily: "monospace" }}
                                                >
                                                    ({s.id})
                                                </Typography>
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Status: {s.status} • Root only: {String(s.rootOnly)}
                                            </Typography>
                                        </Box>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<RestoreIcon fontSize="small" />}
                                            onClick={() => pushOp(`machine.restore(${s.name})`)}
                                            sx={{ borderRadius: "3px", textTransform: "none" }}
                                        >
                                            Restore
                                        </Button>
                                    </Stack>
                                ))}
                            </Stack>
                        </Paper>
                    </Stack>
                )}

                {/* TAB 3: OPERATIONS & FULL ENTITY FIELDS */}
                {tab === 3 && (
                    <Stack spacing={2}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{ mb: 1.5 }}
                            >
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Recent Operations (202 / GET /v1/operations/{"{id}"})
                                </Typography>
                                <Button
                                    size="small"
                                    startIcon={<SyncIcon fontSize="small" />}
                                    onClick={() => pushOp("db.resync")}
                                    sx={{ textTransform: "none" }}
                                >
                                    Sync DB Row
                                </Button>
                            </Stack>
                            {operations.map((op) => (
                                <Box
                                    key={op.id}
                                    sx={{
                                        py: 1,
                                        borderBottom: `1px solid ${tokens.border}`,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 1,
                                    }}
                                >
                                    <Typography sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                                        <strong>{op.type}</strong> • {op.id}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ fontWeight: 700, color: tokens.green.text }}
                                    >
                                        {op.status.toUpperCase()}
                                    </Typography>
                                </Box>
                            ))}
                        </Paper>

                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                                All `InstaboxMachine` Fields
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Grid container spacing={1}>
                                {Object.entries(machine).map(([k, v]) => (
                                    <Grid key={k} size={{ xs: 12, sm: 6, md: 4 }}>
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
                                                sx={{ fontFamily: "monospace", display: "block" }}
                                                color="text.secondary"
                                            >
                                                {k}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontFamily: "monospace",
                                                    fontSize: "0.78rem",
                                                    fontWeight: 600,
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                {typeof v === "object" && v !== null
                                                    ? JSON.stringify(v)
                                                    : String(v ?? "-")}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        </Paper>
                    </Stack>
                )}
            </Box>
        </Box>
    );
}