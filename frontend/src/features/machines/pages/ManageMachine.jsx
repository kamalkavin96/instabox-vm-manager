import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    Grid,
    IconButton,
    Paper,
    Stack,
    Tab,
    Tabs,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DnsIcon from "@mui/icons-material/Dns";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import BoltIcon from "@mui/icons-material/Bolt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useAppSelector } from "../../../hooks/redux";
import PageHeader from "../../../components/common/PageHeader";
import { getMachineById, getMachinePorts } from "../machinesApi";
import {
    createInstaBoxSftpConfig,
    createInstaBoxSshConfig,
    getInstaBoxSftpConfig,
    getInstaBoxSshConfig,
    normalizeInstaBoxConfig,
    updateInstaBoxSftpConfig,
    updateInstaBoxSshConfig,
} from "../connectionConfigApi";

import { docketContainerCount } from "../dockerApi";

import useNotification from "../../../hooks/useNotification";
import SshConfigCard from "../components/SshConfigCard";
import SftpConfigCard from "../components/SftpConfigCard";
import MachinePortsTable from "../components/MachinePortsTable";
import MachineDockerTable from "../components/MachineDockerTable";
import MachineTerminalTab from "../components/MachineTerminalTab";


const getTokens = (isDark) => ({
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
    green: isDark ? { bg: "#163326", text: "#7EE2B8" } : { bg: "#DCFFF1", text: "#216E4E" },
    amber: isDark ? { bg: "#382516", text: "#FEC195" } : { bg: "#FFF3EB", text: "#A54800" },
    neutral: isDark ? { bg: "#2C333A", text: "#B6C2CF" } : { bg: "#F1F2F4", text: "#44546F" },
});

const getBadgeTokens = (state, tokens) => {
    const s = (state || "").toLowerCase();
    if (s === "running") return tokens.green;
    if (s === "paused") return tokens.amber;
    return tokens.neutral;
};

const normalizePorts = (payload, fallbackMachineId) => {
    const rawList = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.ports)
            ? payload.ports
            : Array.isArray(payload?.data)
                ? payload.data
                : [];

    const mId = fallbackMachineId || "m_unknown";
    return rawList.map((item, idx) => {
        const portNum = Number(item?.port ?? 8080);
        const isPrivate = item?.access === "private" || Boolean(item?.private);
        return {
            id: item?.id || `p_${portNum}_${idx}`,
            port: portNum,
            name: item?.name || `Port ${portNum}`,
            protocol: item?.protocol || "http",
            private: isPrivate,
            url: item?.url || `https://${portNum}-${mId}.instabox.tech`,
        };
    });
};

const buildDefaultInstaBoxDraft = (machineData) => ({
    host: "ssh.instabox.sh",
    port: 2222,
    username: machineData?.guestUser || "",
    secretKey: "",
    hasSecretKey: false,
});

const INITIAL_CONTAINERS = [
    { id: "c_91a8f2", name: "app-worker", image: "ghcr.io/instabox/worker:latest", status: "running", ports: "8080->8080" },
    { id: "c_44e1b0", name: "redis-cache", image: "redis:7-alpine", status: "running", ports: "6379/tcp" },
];

const LIFECYCLE_ACTIONS = [
    { key: "start", label: "Start", state: "running", icon: PlayArrowIcon, primary: true },
    { key: "pause", label: "Pause", state: "paused", icon: PauseIcon },
    { key: "resume", label: "Resume", state: "running", icon: BoltIcon },
    { key: "restart", label: "Restart", state: "running", icon: RestartAltIcon },
    { key: "stop", label: "Stop", state: "stopped", icon: StopIcon },
];

export default function ManageMachine() {
    const { id } = useParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const mode = useAppSelector((state) => state.ui?.theme);
    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(() => getTokens(isDark), [isDark]);
    const notify = useNotification();

    const [machine, setMachine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [ports, setPorts] = useState([]);
    const [containers, setContainers] = useState(INITIAL_CONTAINERS);
    const [sshConfig, setSshConfig] = useState(null);
    const [sftpConfig, setSftpConfig] = useState(null);
    const [savingSsh, setSavingSsh] = useState(false);
    const [savingSftp, setSavingSftp] = useState(false);
    const [dockerCount, setDockerCount] = useState(0);

    const defaultDraft = useMemo(() => buildDefaultInstaBoxDraft(machine), [machine]);

    const fetchMachine = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            setSshConfig(null);
            setSftpConfig(null);

            const data = await getMachineById(id);
            setMachine(data || null);

            const mId = data?.machineId;
            if (mId) {
                const [portRes, sshRes, sftpRes] = await Promise.allSettled([
                    getMachinePorts(mId),
                    getInstaBoxSshConfig(mId),
                    getInstaBoxSftpConfig(mId),
                ]);

                setPorts(portRes.status === "fulfilled" ? normalizePorts(portRes.value, mId) : []);


                setDockerCount(await docketContainerCount(data?.machineId).then((v)=> v.count));

                setSshConfig(
                    sshRes.status === "fulfilled" && sshRes.value
                        ? normalizeInstaBoxConfig(sshRes.value, "ssh")
                        : null
                );

                setSftpConfig(
                    sftpRes.status === "fulfilled" && sftpRes.value
                        ? normalizeInstaBoxConfig(sftpRes.value, "sftp")
                        : null
                );
            } else {
                setPorts([]);
            }
        } catch {
            notify.error("Failed to load machine.");
            setMachine(null);
            setPorts([]);
            setSshConfig(null);
            setSftpConfig(null);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        void fetchMachine();
    }, [fetchMachine]);

    const handleSaveSsh = useCallback(
        async (draft, { isCreate = false } = {}) => {
            const targetMachineId = machine?.machineId || id;
            if (!targetMachineId) return false;
            try {
                setSavingSsh(true);
                const savedDto = isCreate
                    ? await createInstaBoxSshConfig(targetMachineId, draft)
                    : await updateInstaBoxSshConfig(targetMachineId, draft);
                setSshConfig((prev) => normalizeInstaBoxConfig(savedDto, "ssh", { ...prev, ...draft }));
                notify.success(isCreate ? "SSH config added." : "SSH config updated.");
                return true;
            } catch (err) {
                const msg = err?.response?.data?.message || "Failed to save SSH config.";
                notify.error(msg);
                return false;
            } finally {
                setSavingSsh(false);
            }
        },
        [machine?.machineId, id, notify]
    );

    const handleSaveSftp = useCallback(
        async (draft, { isCreate = false } = {}) => {
            const targetMachineId = machine?.machineId || id;
            if (!targetMachineId) return false;
            try {
                setSavingSftp(true);
                const savedDto = isCreate
                    ? await createInstaBoxSftpConfig(targetMachineId, draft)
                    : await updateInstaBoxSftpConfig(targetMachineId, draft);
                setSftpConfig((prev) => normalizeInstaBoxConfig(savedDto, "sftp", { ...prev, ...draft }));
                notify.success(isCreate ? "SFTP config added." : "SFTP config updated.");
                return true;
            } catch (err) {
                const msg = err?.response?.data?.message || "Failed to save SFTP config.";
                notify.error(msg);
                return false;
            } finally {
                setSavingSftp(false);
            }
        },
        [machine?.machineId, id, notify]
    );

    // TODO: Wire actual lifecycle API calls here
    const handleLifecycleAction = async (action, nextState, label) => {
        if (!machine) return;
        const resolvedState = nextState ?? machine.state;
        setMachine((prev) => ({
            ...prev,
            state: resolvedState,
            desiredState: resolvedState,
            runtimeReady: resolvedState === "running",
        }));
        notify.success(`${label} triggered (${action}).`);
    };

    const copyText = useCallback(
        async (value, label) => {
            if (!value) return;
            try {
                await navigator.clipboard.writeText(String(value));
                notify.success(`${label} copied.`);
            } catch {
                notify.error("Copy failed.");
            }
        },
        [notify]
    );

    const handleAddPort = ({ portNum, portLabel }) => {
        const num = Number(portNum);
        if (!num || num < 1 || num > 65535) {
            notify.warning("Invalid port (1–65535).");
            return false;
        }
        const mId = machine?.machineId || "m_unknown";
        setPorts((prev) => [
            ...(Array.isArray(prev) ? prev : []),
            {
                id: `p_${Date.now()}`,
                port: num,
                name: portLabel.trim() || `Port ${num}`,
                protocol: "http",
                private: false,
                url: `https://${num}-${mId}.instabox.tech`,
            },
        ]);
        notify.success(`Port ${num} added.`);
        return true;
    };

    const handleDeletePort = (portId) => {
        setPorts((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== portId) : []));
    };

    // TODO: Wire Docker container endpoints here
    const toggleContainer = (containerId) => {
        setContainers((prev) =>
            prev.map((c) => {
                if (c.id !== containerId) return c;
                const nextStatus = c.status === "running" ? "exited" : "running";
                notify.info(`Container ${c.name} -> ${nextStatus}`);
                return { ...c, status: nextStatus };
            })
        );
    };

    const badge = useMemo(() => getBadgeTokens(machine?.state, tokens), [machine?.state, tokens]);

    const inputSx = useMemo(
        () => ({
            "& .MuiOutlinedInput-root": {
                borderRadius: "3px",
                bgcolor: tokens.subtleSurface,
                color: tokens.textPrimary,
                "& fieldset": { borderColor: tokens.border },
                "&:hover fieldset": { borderColor: tokens.borderHover },
                "&.Mui-focused fieldset": { borderColor: tokens.brandMain },
            },
            "& .MuiInputLabel-root": { color: tokens.textSecondary },
        }),
        [tokens]
    );

    const outlineBtnSx = useMemo(
        () => ({
            borderRadius: "3px",
            textTransform: "none",
            fontWeight: 600,
            borderColor: tokens.border,
            color: tokens.textPrimary,
            "&:hover": { bgcolor: tokens.hoverSurface, borderColor: tokens.borderHover },
        }),
        [tokens]
    );

    const primaryBtnSx = useMemo(
        () => ({
            borderRadius: "3px",
            textTransform: "none",
            fontWeight: 600,
            bgcolor: tokens.brandMain,
            color: isDark ? "#1D2125" : "#FFFFFF",
            "&:hover": { bgcolor: tokens.brandHover },
        }),
        [tokens, isDark]
    );

    const summaryCards = useMemo(() => {
        if (!machine) return [];
        const memLabel = machine.memMiB ? `${machine.memMiB / 1024} GiB` : "-";
        return [
            {
                key: "state",
                label: "STATE",
                content: (
                    <Box
                        component="span"
                        sx={{
                            px: 0.75,
                            py: 0.2,
                            borderRadius: "3px",
                            bgcolor: badge.bg,
                            color: badge.text,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                        }}
                    >
                        {(machine.state || "UNKNOWN").toUpperCase()}
                    </Box>
                ),
            },
            {
                key: "compute",
                label: "COMPUTE",
                content: `${machine.vcpus ?? "-"} vCPU • ${memLabel}`,
            },
            {
                key: "storage",
                label: "STORAGE",
                content: `${machine.rootDiskGiB ?? 0}G root • ${machine.persistentDiskGiB ?? 0}G persist`,
            },
            {
                key: "machineId",
                label: "MACHINE ID",
                content: (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography
                            noWrap
                            sx={{
                                fontFamily: "monospace",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                color: tokens.textPrimary,
                            }}
                        >
                            {machine.machineId || "-"}
                        </Typography>
                        <Tooltip title="Copy">
                            <IconButton size="small" onClick={() => void copyText(machine.machineId, "Machine ID")}>
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ),
            },
        ];
    }, [machine, badge, tokens, copyText]);

    const portList = Array.isArray(ports) ? ports : [];

    return (
        <Box sx={{ bgcolor: tokens.canvasBg, minHeight: "100vh", pb: 4 }}>
            <PageHeader
                title={machine?.name || (loading ? "Loading..." : `Machine #${id}`)}
                count={machine ? 1 : 0}
                countLabel="VM"
                countIcon={DnsIcon}
                sticky
                tokens={tokens}
                action={
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ArrowBackIcon fontSize="small" />}
                            onClick={() => navigate("/machines")}
                            sx={outlineBtnSx}
                        >
                            Back
                        </Button>
                        {LIFECYCLE_ACTIONS.map((b) => {
                            const Icon = b.icon;
                            return (
                                <Button
                                    key={b.key}
                                    size="small"
                                    variant={b.primary ? "contained" : "outlined"}
                                    disableElevation={b.primary}
                                    startIcon={<Icon fontSize="small" />}
                                    onClick={() => void handleLifecycleAction(`machine.${b.key}`, b.state, b.label)}
                                    sx={b.primary ? primaryBtnSx : outlineBtnSx}
                                >
                                    {b.label}
                                </Button>
                            );
                        })}
                    </Stack>
                }
            />

            <Box sx={{ px: 3, pt: 2.5 }}>
                {loading && !machine ? (
                    <Paper variant="outlined" sx={{ p: 5, textAlign: "center", bgcolor: tokens.cardBg, borderColor: tokens.border }}>
                        <CircularProgress size={26} sx={{ color: tokens.brandMain }} />
                    </Paper>
                ) : !machine ? (
                    <Paper variant="outlined" sx={{ p: 5, textAlign: "center", bgcolor: tokens.cardBg, borderColor: tokens.border }}>
                        <Typography sx={{ fontWeight: 700, color: tokens.textPrimary, mb: 1.5 }}>Machine not found</Typography>
                        <Button variant="contained" disableElevation sx={primaryBtnSx} onClick={() => navigate("/machines")}>
                            Back to Machines
                        </Button>
                    </Paper>
                ) : (
                    <Stack spacing={2.5}>
                        <Grid container spacing={2}>
                            {summaryCards.map((card) => (
                                <Grid key={card.key} size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "4px", bgcolor: tokens.cardBg, borderColor: tokens.border }}>
                                        <Typography
                                            variant="caption"
                                            sx={{ color: tokens.textSubtle, fontWeight: 700, display: "block", mb: 0.5 }}
                                        >
                                            {card.label}
                                        </Typography>
                                        {typeof card.content === "string" ? (
                                            <Typography
                                                noWrap
                                                sx={{
                                                    fontFamily: "monospace",
                                                    fontSize: "0.85rem",
                                                    fontWeight: 700,
                                                    color: tokens.textPrimary,
                                                }}
                                            >
                                                {card.content}
                                            </Typography>
                                        ) : (
                                            card.content
                                        )}
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <SshConfigCard
                                    config={sshConfig}
                                    defaultDraft={defaultDraft}
                                    onSave={handleSaveSsh}
                                    onCopy={copyText}
                                    onNotify={notify}
                                    saving={savingSsh}
                                    tokens={tokens}
                                    inputSx={inputSx}
                                    outlineBtnSx={outlineBtnSx}
                                    primaryBtnSx={primaryBtnSx}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <SftpConfigCard
                                    config={sftpConfig}
                                    defaultDraft={defaultDraft}
                                    onSave={handleSaveSftp}
                                    onCopy={copyText}
                                    onNotify={notify}
                                    saving={savingSftp}
                                    tokens={tokens}
                                    inputSx={inputSx}
                                    outlineBtnSx={outlineBtnSx}
                                    primaryBtnSx={primaryBtnSx}
                                />
                            </Grid>
                        </Grid>

                        <Paper
                            variant="outlined"
                            sx={{
                                borderRadius: "4px",
                                bgcolor: tokens.cardBg,
                                borderColor: tokens.border,
                                overflow: "hidden",
                            }}
                        >
                            <Tabs
                                value={tab}
                                onChange={(_, v) => setTab(v)}
                                sx={{
                                    px: 1.5,
                                    "& .MuiTab-root": { textTransform: "none", fontWeight: 600, color: tokens.textSecondary },
                                    "& .Mui-selected": { color: `${tokens.brandMain} !important` },
                                    "& .MuiTabs-indicator": { backgroundColor: tokens.brandMain },
                                }}
                            >
                                <Tab label={`Ports (${portList.length})`} />
                                <Tab label={`Docker (${dockerCount})`} />
                                <Tab label="Terminal"/>
                            </Tabs>

                            <Divider sx={{ borderColor: tokens.border }} />

                            <Box sx={{ p: 2 }}>
                                {tab === 0 && (
                                    <MachinePortsTable
                                        ports={portList}
                                        machineId={machine.machineId}
                                        onAddPort={handleAddPort}
                                        onDeletePort={handleDeletePort}
                                        onCopy={copyText}
                                        tokens={tokens}
                                        inputSx={inputSx}
                                        primaryBtnSx={primaryBtnSx}
                                    />
                                )}
                                {tab === 1 && (
                                    <MachineDockerTable
                                        machineId={machine.machineId}
                                        onCountChange={setDockerCount}
                                        onNotify={notify}
                                        tokens={tokens}
                                        inputSx={inputSx}
                                        outlineBtnSx={outlineBtnSx}
                                        primaryBtnSx={primaryBtnSx}
                                    />
                                )}
                                {tab === 2 && (
                                    <MachineTerminalTab
                                        key={machine.machineId}
                                        machineId={machine.machineId}
                                        tokens={tokens}
                                        outlineBtnSx={outlineBtnSx}
                                        onNotify={notify}
                                    />
                                )}
                            </Box>

                        </Paper>
                    </Stack>
                )}
            </Box>
        </Box>
    );
}