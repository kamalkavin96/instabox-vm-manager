import { useCallback, useEffect, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PauseIcon from "@mui/icons-material/Pause";
import DeleteIcon from "@mui/icons-material/Delete";
import ArticleIcon from "@mui/icons-material/Article";
import TerminalIcon from "@mui/icons-material/Terminal";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AddIcon from "@mui/icons-material/Add";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";

import {
    execContainerCommand,
    executeDockerAction,
    getContainerInspect,
    getContainerLogs,
    listDockerContainers,
    listDockerImages,
    listDockerNetworks,
    listDockerVolumes,
} from "../dockerApi";

const formatPorts = (portsArr) => {
    if (!Array.isArray(portsArr) || portsArr.length === 0) return "-";
    return portsArr
        .map((p) => (p.PublicPort ? `${p.PublicPort}->${p.PrivatePort}/${p.Type || "tcp"}` : `${p.PrivatePort}/${p.Type || "tcp"}`))
        .join(", ");
};

const formatBytes = (bytes) => {
    const n = Number(bytes);
    if (!n || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`;
};

export default function MachineDockerTable({
    machineId,
    onCountChange,
    onNotify,
    tokens,
    inputSx,
    outlineBtnSx,
    primaryBtnSx,
}) {
    const [subTab, setSubTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const [containers, setContainers] = useState([]);
    const [images, setImages] = useState([]);
    const [volumes, setVolumes] = useState([]);
    const [networks, setNetworks] = useState([]);

    // Output modal (Logs / Inspect / Exec)
    const [outputModal, setOutputModal] = useState({ open: false, title: "", text: "" });
    const [execCmd, setExecCmd] = useState("sh -c 'uname -a && ps aux | head -n 10'");
    const [execTargetId, setExecTargetId] = useState("");
    const [execOpen, setExecOpen] = useState(false);

    // Create Container modal
    const [runOpen, setRunOpen] = useState(false);
    const [runForm, setRunForm] = useState({ name: "", image: "nginx", tag: "alpine", hostPort: "", containerPort: "80", cmd: "" });

    // Pull Image modal
    const [pullOpen, setPullOpen] = useState(false);
    const [pullForm, setPullForm] = useState({ image: "alpine", tag: "latest" });

    // Create Volume / Network modal
    const [createResOpen, setCreateResOpen] = useState(false);
    const [createResType, setCreateResType] = useState("VOLUME"); // VOLUME | NETWORK
    const [resName, setResName] = useState("");

    const loadAll = useCallback(async () => {
        if (!machineId) return;
        try {
            setLoading(true);
            const [cRes, iRes, vRes, nRes] = await Promise.allSettled([
                listDockerContainers(machineId, true),
                listDockerImages(machineId, false),
                listDockerVolumes(machineId),
                listDockerNetworks(machineId),
            ]);
            const cList = cRes.status === "fulfilled" ? cRes.value : [];
            setContainers(cList);
            onCountChange?.(cList.length);
            setImages(iRes.status === "fulfilled" ? iRes.value : []);
            setVolumes(vRes.status === "fulfilled" ? vRes.value : []);
            setNetworks(nRes.status === "fulfilled" ? nRes.value : []);
        } catch {
            onNotify?.error("Failed to load Docker resources.");
        } finally {
            setLoading(false);
        }
    }, [machineId, onCountChange, onNotify]);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    const runAction = async (key, payload, successMsg) => {
        try {
            setBusyId(key);
            await executeDockerAction(machineId, payload);
            onNotify?.success(successMsg);
            await loadAll();
        } catch (err) {
            onNotify?.error(err?.response?.data?.message || "Docker operation failed.");
        } finally {
            setBusyId(null);
        }
    };

    const handleViewLogs = async (containerId, name) => {
        try {
            setBusyId(containerId);
            const text = await getContainerLogs(machineId, containerId, 200);
            setOutputModal({ open: true, title: `Logs — ${name}`, text: text || "(no logs)" });
        } catch (err) {
            onNotify?.error(err?.response?.data?.message || "Failed to fetch logs.");
        } finally {
            setBusyId(null);
        }
    };

    const handleInspect = async (containerId, name) => {
        try {
            setBusyId(containerId);
            const data = await getContainerInspect(machineId, containerId);
            setOutputModal({
                open: true,
                title: `Inspect — ${name}`,
                text: JSON.stringify(data, null, 2),
            });
        } catch (err) {
            onNotify?.error(err?.response?.data?.message || "Failed to inspect container.");
        } finally {
            setBusyId(null);
        }
    };

    const handleExecSubmit = async (e) => {
        e.preventDefault();
        if (!execCmd.trim() || !execTargetId) return;
        try {
            setBusyId(execTargetId);
            const res = await execContainerCommand(machineId, execTargetId, ["sh", "-c", execCmd]);
            setExecOpen(false);
            setOutputModal({
                open: true,
                title: `Exec Output — ${execTargetId.slice(0, 12)}`,
                text: res?.output || "(empty output)",
            });
        } catch (err) {
            onNotify?.error(err?.response?.data?.message || "Exec failed.");
        } finally {
            setBusyId(null);
        }
    };

    const handleCreateContainer = async (e) => {
        e.preventDefault();
        const portBindings =
            runForm.hostPort.trim() && runForm.containerPort.trim()
                ? { [`${runForm.containerPort.trim()}/tcp`]: runForm.hostPort.trim() }
                : undefined;
        const cmdArr = runForm.cmd.trim() ? runForm.cmd.trim().split(/\s+/) : undefined;

        await runAction(
            "create_container",
            {
                action: "CREATE_CONTAINER",
                name: runForm.name.trim() || undefined,
                image: runForm.image.trim(),
                tag: runForm.tag.trim() || "latest",
                portBindings,
                cmd: cmdArr,
            },
            "Container created."
        );
        setRunOpen(false);
    };

    const handlePullImage = async (e) => {
        e.preventDefault();
        await runAction(
            "pull_image",
            {
                action: "PULL_IMAGE",
                image: pullForm.image.trim(),
                tag: pullForm.tag.trim() || "latest",
            },
            `Pulled ${pullForm.image.trim()}:${pullForm.tag.trim() || "latest"}`
        );
        setPullOpen(false);
    };

    const handleCreateResource = async (e) => {
        e.preventDefault();
        if (!resName.trim()) return;
        await runAction(
            "create_res",
            {
                action: createResType === "VOLUME" ? "CREATE_VOLUME" : "CREATE_NETWORK",
                name: resName.trim(),
            },
            `${createResType} "${resName.trim()}" created.`
        );
        setResName("");
        setCreateResOpen(false);
    };

    return (
        <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Tabs
                    value={subTab}
                    onChange={(_, v) => setSubTab(v)}
                    sx={{
                        minHeight: 36,
                        "& .MuiTab-root": { minHeight: 36, py: 0.5, textTransform: "none", fontWeight: 600, color: tokens.textSecondary },
                        "& .Mui-selected": { color: `${tokens.brandMain} !important` },
                        "& .MuiTabs-indicator": { backgroundColor: tokens.brandMain },
                    }}
                >
                    <Tab label={`Containers (${containers.length})`} />
                    <Tab label={`Images (${images.length})`} />
                    <Tab label={`Volumes (${volumes.length})`} />
                    <Tab label={`Networks (${networks.length})`} />
                </Tabs>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                    {subTab === 0 && (
                        <>
                            <Button size="small" variant="contained" disableElevation startIcon={<AddIcon fontSize="small" />} onClick={() => setRunOpen(true)} sx={primaryBtnSx}>
                                Create Container
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<CleaningServicesIcon fontSize="small" />} onClick={() => void runAction("prune_c", { action: "PRUNE_CONTAINERS" }, "Stopped containers pruned.")} sx={outlineBtnSx}>
                                Prune Stopped
                            </Button>
                        </>
                    )}
                    {subTab === 1 && (
                        <>
                            <Button size="small" variant="contained" disableElevation startIcon={<AddIcon fontSize="small" />} onClick={() => setPullOpen(true)} sx={primaryBtnSx}>
                                Pull Image
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<CleaningServicesIcon fontSize="small" />} onClick={() => void runAction("prune_i", { action: "PRUNE_IMAGES", all: false }, "Dangling images pruned.")} sx={outlineBtnSx}>
                                Prune Images
                            </Button>
                        </>
                    )}
                    {subTab === 2 && (
                        <>
                            <Button size="small" variant="contained" disableElevation startIcon={<AddIcon fontSize="small" />} onClick={() => { setCreateResType("VOLUME"); setCreateResOpen(true); }} sx={primaryBtnSx}>
                                Create Volume
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<CleaningServicesIcon fontSize="small" />} onClick={() => void runAction("prune_v", { action: "PRUNE_VOLUMES" }, "Unused volumes pruned.")} sx={outlineBtnSx}>
                                Prune Volumes
                            </Button>
                        </>
                    )}
                    {subTab === 3 && (
                        <>
                            <Button size="small" variant="contained" disableElevation startIcon={<AddIcon fontSize="small" />} onClick={() => { setCreateResType("NETWORK"); setCreateResOpen(true); }} sx={primaryBtnSx}>
                                Create Network
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<CleaningServicesIcon fontSize="small" />} onClick={() => void runAction("prune_n", { action: "PRUNE_NETWORKS" }, "Unused networks pruned.")} sx={outlineBtnSx}>
                                Prune Networks
                            </Button>
                        </>
                    )}
                    <Button size="small" variant="outlined" startIcon={<RefreshIcon fontSize="small" />} onClick={() => void loadAll()} disabled={loading} sx={outlineBtnSx}>
                        Refresh
                    </Button>
                </Stack>
            </Stack>

            {loading ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                    <CircularProgress size={24} sx={{ color: tokens.brandMain }} />
                </Box>
            ) : subTab === 0 ? (
                <TableContainer variant="outlined" component={Paper} elevation={0} sx={{ borderRadius: "4px", bgcolor: tokens.cardBg, borderColor: tokens.border }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: tokens.subtleSurface }}>
                                {["Container", "Image", "State", "Status", "Ports", "Actions"].map((h) => (
                                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, borderColor: tokens.border }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {containers.map((c) => {
                                const id = c.Id;
                                const name = (Array.isArray(c.Names) && c.Names[0]?.replace(/^\//, "")) || id?.slice(0, 12);
                                const state = (c.State || "").toLowerCase();
                                const isRunning = state === "running";
                                const isPaused = state === "paused";
                                const badge = isRunning ? tokens.green : isPaused ? tokens.amber : tokens.neutral;
                                const rowBusy = busyId === id;

                                return (
                                    <TableRow key={id} hover sx={{ "&:hover": { bgcolor: tokens.hoverSurface } }}>
                                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: tokens.textPrimary, borderColor: tokens.border }}>
                                            {name}
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem", color: tokens.textSecondary, borderColor: tokens.border }}>
                                            {c.Image}
                                        </TableCell>
                                        <TableCell sx={{ borderColor: tokens.border }}>
                                            <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: "3px", fontSize: "0.7rem", fontWeight: 700, bgcolor: badge.bg, color: badge.text, textTransform: "uppercase" }}>
                                                {state || "unknown"}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: "0.78rem", color: tokens.textSecondary, borderColor: tokens.border }}>
                                            {c.Status}
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem", color: tokens.textSecondary, borderColor: tokens.border }}>
                                            {formatPorts(c.Ports)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ borderColor: tokens.border, whiteSpace: "nowrap" }}>
                                            {!isRunning ? (
                                                <IconButton size="small" disabled={rowBusy} title="Start" onClick={() => void runAction(id, { action: "START", targetId: id }, `Started ${name}`)}>
                                                    <PlayArrowIcon fontSize="small" />
                                                </IconButton>
                                            ) : (
                                                <>
                                                    <IconButton size="small" disabled={rowBusy} title="Stop" onClick={() => void runAction(id, { action: "STOP", targetId: id }, `Stopped ${name}`)}>
                                                        <StopIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" disabled={rowBusy} title={isPaused ? "Unpause" : "Pause"} onClick={() => void runAction(id, { action: isPaused ? "UNPAUSE" : "PAUSE", targetId: id }, `${isPaused ? "Unpaused" : "Paused"} ${name}`)}>
                                                        <PauseIcon fontSize="small" />
                                                    </IconButton>
                                                </>
                                            )}
                                            <IconButton size="small" disabled={rowBusy} title="Restart" onClick={() => void runAction(id, { action: "RESTART", targetId: id }, `Restarted ${name}`)}>
                                                <RestartAltIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" disabled={rowBusy} title="Logs" onClick={() => void handleViewLogs(id, name)}>
                                                <ArticleIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" disabled={rowBusy} title="Exec" onClick={() => { setExecTargetId(id); setExecOpen(true); }}>
                                                <TerminalIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" disabled={rowBusy} title="Inspect" onClick={() => void handleInspect(id, name)}>
                                                <InfoOutlinedIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" disabled={rowBusy} title="Remove" onClick={() => void runAction(id, { action: "REMOVE_CONTAINER", targetId: id, force: true }, `Removed ${name}`)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : subTab === 1 ? (
                <TableContainer variant="outlined" component={Paper} elevation={0} sx={{ borderRadius: "4px", bgcolor: tokens.cardBg, borderColor: tokens.border }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: tokens.subtleSurface }}>
                                {["ID", "Tags", "Size", "Actions"].map((h) => (
                                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, borderColor: tokens.border }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {images.map((img) => {
                                const shortId = (img.Id || "").replace(/^sha256:/, "").slice(0, 12);
                                const tags = Array.isArray(img.RepoTags) && img.RepoTags.length ? img.RepoTags.join(", ") : "<none>";
                                return (
                                    <TableRow key={img.Id} hover>
                                        <TableCell sx={{ fontFamily: "monospace", color: tokens.textPrimary, borderColor: tokens.border }}>{shortId}</TableCell>
                                        <TableCell sx={{ fontFamily: "monospace", color: tokens.textPrimary, borderColor: tokens.border }}>{tags}</TableCell>
                                        <TableCell sx={{ fontFamily: "monospace", color: tokens.textSecondary, borderColor: tokens.border }}>{formatBytes(img.Size)}</TableCell>
                                        <TableCell align="right" sx={{ borderColor: tokens.border }}>
                                            <IconButton size="small" title="Remove Image" onClick={() => void runAction(img.Id, { action: "REMOVE_IMAGE", targetId: img.Id, force: true }, `Removed image ${shortId}`)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : subTab === 2 ? (
                <TableContainer variant="outlined" component={Paper} elevation={0} sx={{ borderRadius: "4px", bgcolor: tokens.cardBg, borderColor: tokens.border }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: tokens.subtleSurface }}>
                                {["Name", "Driver", "Mountpoint", "Actions"].map((h) => (
                                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, borderColor: tokens.border }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {volumes.map((v) => (
                                <TableRow key={v.Name} hover>
                                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: tokens.textPrimary, borderColor: tokens.border }}>{v.Name}</TableCell>
                                    <TableCell sx={{ color: tokens.textSecondary, borderColor: tokens.border }}>{v.Driver}</TableCell>
                                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem", color: tokens.textSecondary, borderColor: tokens.border }}>{v.Mountpoint}</TableCell>
                                    <TableCell align="right" sx={{ borderColor: tokens.border }}>
                                        <IconButton size="small" title="Remove Volume" onClick={() => void runAction(v.Name, { action: "REMOVE_VOLUME", targetId: v.Name, force: true }, `Removed volume ${v.Name}`)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <TableContainer variant="outlined" component={Paper} elevation={0} sx={{ borderRadius: "4px", bgcolor: tokens.cardBg, borderColor: tokens.border }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: tokens.subtleSurface }}>
                                {["Network", "Driver", "Scope", "Actions"].map((h) => (
                                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, borderColor: tokens.border }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {networks.map((n) => {
                                const isSystemNet = ["bridge", "host", "none"].includes(n.Name);
                                return (
                                    <TableRow key={n.Id} hover>
                                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: tokens.textPrimary, borderColor: tokens.border }}>{n.Name}</TableCell>
                                        <TableCell sx={{ color: tokens.textSecondary, borderColor: tokens.border }}>{n.Driver}</TableCell>
                                        <TableCell sx={{ color: tokens.textSecondary, borderColor: tokens.border }}>{n.Scope}</TableCell>
                                        <TableCell align="right" sx={{ borderColor: tokens.border }}>
                                            <IconButton size="small" disabled={isSystemNet} title="Remove Network" onClick={() => void runAction(n.Id, { action: "REMOVE_NETWORK", targetId: n.Id }, `Removed network ${n.Name}`)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Logs / Inspect / Exec Output Modal */}
            <Dialog open={outputModal.open} onClose={() => setOutputModal((p) => ({ ...p, open: false }))} maxWidth="md" fullWidth>
                <DialogTitle>{outputModal.title}</DialogTitle>
                <DialogContent dividers>
                    <Box component="pre" sx={{ m: 0, fontFamily: "monospace", fontSize: "0.75rem", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                        {outputModal.text}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOutputModal((p) => ({ ...p, open: false }))} sx={outlineBtnSx}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Exec Modal */}
            <Dialog open={execOpen} onClose={() => setExecOpen(false)} maxWidth="sm" fullWidth>
                <Box component="form" onSubmit={handleExecSubmit}>
                    <DialogTitle>Exec Command in Container</DialogTitle>
                    <DialogContent dividers>
                        <TextField size="small" fullWidth required label="Shell Command" value={execCmd} onChange={(e) => setExecCmd(e.target.value)} sx={{ mt: 1, ...inputSx }} />
                    </DialogContent>
                    <DialogActions>
                        <Button type="button" onClick={() => setExecOpen(false)} sx={outlineBtnSx}>Cancel</Button>
                        <Button type="submit" variant="contained" disableElevation sx={primaryBtnSx}>Run</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Create Container Modal */}
            <Dialog open={runOpen} onClose={() => setRunOpen(false)} maxWidth="sm" fullWidth>
                <Box component="form" onSubmit={handleCreateContainer}>
                    <DialogTitle>Create Container</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={1.5} sx={{ mt: 1 }}>
                            <TextField size="small" fullWidth label="Container Name (optional)" value={runForm.name} onChange={(e) => setRunForm((p) => ({ ...p, name: e.target.value }))} sx={inputSx} />
                            <Stack direction="row" spacing={1.5}>
                                <TextField size="small" fullWidth required label="Image" value={runForm.image} onChange={(e) => setRunForm((p) => ({ ...p, image: e.target.value }))} sx={inputSx} />
                                <TextField size="small" label="Tag" sx={{ width: 120, ...inputSx }} value={runForm.tag} onChange={(e) => setRunForm((p) => ({ ...p, tag: e.target.value }))} />
                            </Stack>
                            <Stack direction="row" spacing={1.5}>
                                <TextField size="small" fullWidth label="Host Port (optional)" value={runForm.hostPort} onChange={(e) => setRunForm((p) => ({ ...p, hostPort: e.target.value }))} sx={inputSx} />
                                <TextField size="small" fullWidth label="Container Port" value={runForm.containerPort} onChange={(e) => setRunForm((p) => ({ ...p, containerPort: e.target.value }))} sx={inputSx} />
                            </Stack>
                            <TextField size="small" fullWidth label="Command Override (optional)" value={runForm.cmd} onChange={(e) => setRunForm((p) => ({ ...p, cmd: e.target.value }))} sx={inputSx} />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button type="button" onClick={() => setRunOpen(false)} sx={outlineBtnSx}>Cancel</Button>
                        <Button type="submit" variant="contained" disableElevation sx={primaryBtnSx}>Create</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Pull Image Modal */}
            <Dialog open={pullOpen} onClose={() => setPullOpen(false)} maxWidth="xs" fullWidth>
                <Box component="form" onSubmit={handlePullImage}>
                    <DialogTitle>Pull Image</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={1.5} sx={{ mt: 1 }}>
                            <TextField size="small" fullWidth required label="Image" value={pullForm.image} onChange={(e) => setPullForm((p) => ({ ...p, image: e.target.value }))} sx={inputSx} />
                            <TextField size="small" fullWidth label="Tag" value={pullForm.tag} onChange={(e) => setPullForm((p) => ({ ...p, tag: e.target.value }))} sx={inputSx} />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button type="button" onClick={() => setPullOpen(false)} sx={outlineBtnSx}>Cancel</Button>
                        <Button type="submit" variant="contained" disableElevation sx={primaryBtnSx}>Pull</Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Create Volume / Network Modal */}
            <Dialog open={createResOpen} onClose={() => setCreateResOpen(false)} maxWidth="xs" fullWidth>
                <Box component="form" onSubmit={handleCreateResource}>
                    <DialogTitle>{createResType === "VOLUME" ? "Create Volume" : "Create Network"}</DialogTitle>
                    <DialogContent dividers>
                        <TextField size="small" fullWidth required label="Name" value={resName} onChange={(e) => setResName(e.target.value)} sx={{ mt: 1, ...inputSx }} />
                    </DialogContent>
                    <DialogActions>
                        <Button type="button" onClick={() => setCreateResOpen(false)} sx={outlineBtnSx}>Cancel</Button>
                        <Button type="submit" variant="contained" disableElevation sx={primaryBtnSx}>Create</Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Stack>
    );
}