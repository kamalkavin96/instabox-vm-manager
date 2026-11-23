import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    InputAdornment,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Stack,
    Switch,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import TerminalIcon from "@mui/icons-material/Terminal";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import HeightIcon from "@mui/icons-material/Height";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import DownloadIcon from "@mui/icons-material/Download";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate } from "react-router-dom";
import TerminalPane from "../component/TerminalPane";
import FleetCommandBar from "../component/FleetCommandBar";

/* ----------------------------- constants ----------------------------- */

const KEY_PREFS = "instabox.fleet.prefs.v2";
const KEY_SNIPPETS = "instabox.fleet.snippets.v3";
const KEY_SNIPPETS_LEGACY = "instabox.fleet.snippets.v2";
const KEY_GROUPS = "instabox.fleet.groups.v1";
const KEY_HISTORY = "instabox.fleet.history.v1";

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 22;
const DEFAULT_FONT_SIZE = 13;
const MIN_PANE_HEIGHT = 200;
const MAX_PANE_HEIGHT = 960;
const HEIGHT_STEP = 70;
const HISTORY_LIMIT = 100;
const MAXIMIZED_HEIGHT = "calc(100vh - 235px)";

const EMPTY_LIST = [];

const DEFAULT_SNIPPETS = [
    { id: "d-uptime", label: "Uptime & Load", cmd: "uptime && free -h" },
    { id: "d-disk", label: "Disk Usage", cmd: "df -h /" },
    { id: "d-docker", label: "Docker PS", cmd: "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'" },
    { id: "d-ports", label: "IP & Ports", cmd: "ss -tulpn || netstat -tulpn" },
    { id: "d-cpu", label: "Top CPU", cmd: "ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 12" },
    { id: "d-mem", label: "Memory", cmd: "free -m" },
    { id: "d-dstats", label: "Docker Stats", cmd: "docker stats --no-stream --format 'table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}'" },
    { id: "d-syslog", label: "Tail Syslog", cmd: "tail -n 25 /var/log/syslog 2>/dev/null || journalctl -n 25 --no-pager" },
];

const DANGEROUS_PATTERNS = [
    /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i,
    /\bmkfs(\.\w+)?\b/i,
    /\b(shutdown|reboot|poweroff|halt)\b/i,
    /\bdd\s+if=/i,
    />\s*\/dev\/(sd|nvme|vd)/i,
    /\bdocker\s+system\s+prune\b/i,
    /\bdocker\s+(rm|kill)\s+-f\b.*\$\(/i,
    /\bdocker\s+volume\s+(rm|prune)\b/i,
    /\bkill\s+-9\s+-1\b/i,
    /\bchmod\s+-R\s+7?77\s+\//i,
    /\bchown\s+-R\b.*\s\/(\s|$)/i,
    /\biptables\s+-F\b/i,
    /\bsystemctl\s+(stop|disable|mask)\s+(ssh|sshd)\b/i,
    /:\(\)\s*\{/,
    /\b(userdel|passwd)\b/i,
];

const getMachineId = (m) => String(m?.machineId ?? m?.id ?? "");
const getMachineName = (m) => m?.name || m?.hostname || getMachineId(m);
const getDefaultHeightForColumns = (cols) => (cols === 1 ? 560 : cols === 2 ? 440 : cols === 3 ? 350 : 310);
const isDangerous = (cmd) => DANGEROUS_PATTERNS.some((rx) => rx.test(cmd));
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const readJSON = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const writeJSON = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore storage errors
    }
};

const loadSnippets = () => {
    const current = readJSON(KEY_SNIPPETS, null);
    if (Array.isArray(current) && current.length > 0) return current;
    const legacy = readJSON(KEY_SNIPPETS_LEGACY, null);
    if (Array.isArray(legacy) && legacy.length > 0) {
        return legacy
            .filter((s) => s?.label && s?.cmd)
            .map((s) => ({ id: newId(), label: String(s.label), cmd: String(s.cmd) }));
    }
    return DEFAULT_SNIPPETS;
};

const STATUS_LABEL = {
    CONNECTED: { text: "ONLINE", bg: "rgba(54, 179, 126, 0.16)", color: "#36B37E" },
    CONNECTING: { text: "CONNECTING", bg: "rgba(255, 171, 0, 0.16)", color: "#FFAB00" },
    RECONNECTING: { text: "RETRYING", bg: "rgba(255, 171, 0, 0.16)", color: "#FFAB00" },
    DISCONNECTED: { text: "OFFLINE", bg: "rgba(255, 86, 48, 0.16)", color: "#FF5630" },
    CLOSED: { text: "CLOSED", bg: "rgba(137, 147, 164, 0.16)", color: "#8993A4" },
};

/* ------------------------------- page -------------------------------- */

export default function FleetTerminalsPage({ initialMachines = EMPTY_LIST, onNotify }) {
    const navigate = useNavigate();
    const muiTheme = useTheme();
    const isDark = muiTheme.palette.mode === "dark";

    const ui = useMemo(
        () =>
            isDark
                ? {
                      pageBg: "#0D1117",
                      surfaceBg: "#161B22",
                      elevatedBg: "#1F2630",
                      inputBg: "#0D1117",
                      border: "#2A3341",
                      borderStrong: "#3E4B5E",
                      textPrimary: "#E6EDF3",
                      textSecondary: "#9BA7B4",
                      chipBg: "#212936",
                      chipHover: "#2D3849",
                      accent: "#0052CC",
                      accentHover: "#0747A6",
                      accentText: "#4C9AFF",
                  }
                : {
                      pageBg: "#F4F5F7",
                      surfaceBg: "#FFFFFF",
                      elevatedBg: "#F4F5F7",
                      inputBg: "#FAFBFC",
                      border: "#DFE1E6",
                      borderStrong: "#C1C7D0",
                      textPrimary: "#172B4D",
                      textSecondary: "#5E6C84",
                      chipBg: "#EBECF0",
                      chipHover: "#DFE1E6",
                      accent: "#0052CC",
                      accentHover: "#0747A6",
                      accentText: "#0052CC",
                  },
        [isDark]
    );

    const prefs = useMemo(() => readJSON(KEY_PREFS, {}), []);

    const [machines, setMachines] = useState(initialMachines);
    const [loadingMachines, setLoadingMachines] = useState(false);
    const [statusMap, setStatusMap] = useState({});
    const [columns, setColumns] = useState([1, 2, 3, 4].includes(prefs.columns) ? prefs.columns : 2);
    const [fontSize, setFontSize] = useState(
        Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Number(prefs.fontSize) || DEFAULT_FONT_SIZE))
    );
    const [paneHeight, setPaneHeight] = useState(
        Math.min(
            MAX_PANE_HEIGHT,
            Math.max(MIN_PANE_HEIGHT, Number(prefs.paneHeight) || getDefaultHeightForColumns(prefs.columns || 2))
        )
    );
    const [shortcutLimit, setShortcutLimit] = useState(
        Math.min(12, Math.max(1, Number(prefs.shortcutLimit) || 5))
    );
    const [connectTimeoutMs, setConnectTimeoutMs] = useState(
        Number.isFinite(Number(prefs.connectTimeoutMs)) ? Number(prefs.connectTimeoutMs) : 10000
    );
    const [retryDelayMs, setRetryDelayMs] = useState(
        Number.isFinite(Number(prefs.retryDelayMs)) ? Number(prefs.retryDelayMs) : 3000
    );
    const [showOnlySelected, setShowOnlySelected] = useState(Boolean(prefs.showOnlySelected));
    const [staggerMs, setStaggerMs] = useState(Number(prefs.staggerMs) || 0);
    const [minimizedIds, setMinimizedIds] = useState(() => new Set());
    const [maximizedId, setMaximizedId] = useState(null);
    const [broadcastIds, setBroadcastIds] = useState(() => new Set());
    const [liveSync, setLiveSync] = useState(false);

    const [snippets, setSnippets] = useState(loadSnippets);
    const [groups, setGroups] = useState(() => {
        const g = readJSON(KEY_GROUPS, []);
        return Array.isArray(g) ? g : [];
    });
    const [history, setHistory] = useState(() => {
        const h = readJSON(KEY_HISTORY, []);
        return Array.isArray(h) ? h : [];
    });

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [vmManagerOpen, setVmManagerOpen] = useState(false);
    const [vmSearch, setVmSearch] = useState("");
    const [newGroupName, setNewGroupName] = useState("");
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [snippetDialogOpen, setSnippetDialogOpen] = useState(false);
    const [newSnippetLabel, setNewSnippetLabel] = useState("");
    const [newSnippetCmd, setNewSnippetCmd] = useState("");
    const [pendingDangerCmd, setPendingDangerCmd] = useState(null);
    const [toast, setToast] = useState(null);

    const paneRefs = useRef({});
    const timersRef = useRef([]);
    const selectionRestoredRef = useRef(false);
    const onNotifyRef = useRef(onNotify);
    onNotifyRef.current = onNotify;

    const notify = useCallback((severity, message) => {
        const fn = onNotifyRef.current?.[severity];
        if (typeof fn === "function") {
            fn(message);
            return;
        }
        setToast({ severity, message, key: Date.now() });
    }, []);

    const loadMachines = useCallback(
        async (signal) => {
            setLoadingMachines(true);
            try {
                const res = await fetch("/api/v1/instabox/machines", { credentials: "include", signal });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const list = Array.isArray(data) ? data : data?.content || data?.machines || data?.data || [];
                setMachines(Array.isArray(list) ? list : []);
            } catch (err) {
                if (err?.name === "AbortError") return;
                notify("error", `Failed to load machines: ${err.message}`);
            } finally {
                if (!signal?.aborted) setLoadingMachines(false);
            }
        },
        [notify]
    );

    useEffect(() => {
        if (initialMachines.length > 0) {
            setMachines(initialMachines);
            return undefined;
        }
        const ctrl = new AbortController();
        void loadMachines(ctrl.signal);
        return () => ctrl.abort();
    }, [initialMachines, loadMachines]);

    useEffect(() => {
        if (machines.length === 0) return;
        const allIds = machines.map(getMachineId).filter(Boolean);
        if (!selectionRestoredRef.current) {
            selectionRestoredRef.current = true;
            const saved = Array.isArray(prefs.selected)
                ? prefs.selected.filter((id) => allIds.includes(id))
                : [];
            setBroadcastIds(new Set(saved.length > 0 ? saved : allIds));
            return;
        }
        setBroadcastIds((prev) => {
            const next = new Set([...prev].filter((id) => allIds.includes(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [machines, prefs.selected]);

    useEffect(() => {
        writeJSON(KEY_PREFS, {
            columns,
            fontSize,
            paneHeight,
            shortcutLimit,
            connectTimeoutMs,
            retryDelayMs,
            showOnlySelected,
            staggerMs,
            selected: selectionRestoredRef.current ? [...broadcastIds] : prefs.selected,
        });
    }, [
        columns,
        fontSize,
        paneHeight,
        shortcutLimit,
        connectTimeoutMs,
        retryDelayMs,
        showOnlySelected,
        staggerMs,
        broadcastIds,
        prefs.selected,
    ]);

    useEffect(() => writeJSON(KEY_SNIPPETS, snippets), [snippets]);
    useEffect(() => writeJSON(KEY_GROUPS, groups), [groups]);
    useEffect(() => writeJSON(KEY_HISTORY, history), [history]);

    useEffect(
        () => () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        },
        []
    );

    const registerPane = useCallback((id, handle) => {
        if (handle) paneRefs.current[id] = handle;
        else delete paneRefs.current[id];
    }, []);

    const handleStatusChange = useCallback((id, status) => {
        setStatusMap((prev) => (prev[id] === status ? prev : { ...prev, [id]: status }));
    }, []);

    const handleToggleBroadcastTarget = useCallback((machineId) => {
        const id = String(machineId);
        setBroadcastIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleClosePane = useCallback((machineId) => {
        const id = String(machineId);
        setMaximizedId((curr) => (curr === id ? null : curr));
    }, []);

    const handleMinimizePane = useCallback((machineId) => {
        const id = String(machineId);
        setMinimizedIds((prev) => new Set(prev).add(id));
        setMaximizedId((curr) => (curr === id ? null : curr));
    }, []);

    const handleRestoreMinimized = useCallback((machineId) => {
        const id = String(machineId);
        setMinimizedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const handleToggleMaximizePane = useCallback((machineId) => {
        const id = String(machineId);
        setMinimizedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        setMaximizedId((curr) => (curr === id ? null : id));
    }, []);

    const handleOpenMachinePage = useCallback((id) => navigate(`/manage-machines/${id}`), [navigate]);

    const getTargetIds = useCallback(() => {
        const unique = new Set();
        machines.forEach((m) => {
            const id = getMachineId(m);
            if (id && broadcastIds.has(id)) unique.add(id);
        });
        return Array.from(unique);
    }, [machines, broadcastIds]);

    const sendRawToTargets = useCallback(
        (payload) => {
            const targets = getTargetIds();
            if (!payload) return { ready: 0, total: targets.length };
            let ready = 0;
            targets.forEach((id) => {
                if (paneRefs.current[id]?.sendInput(payload)) ready += 1;
            });
            return { ready, total: targets.length };
        },
        [getTargetIds]
    );

    const dispatchCommand = useCallback(
        (payload) => {
            const targets = getTargetIds();
            const online = targets.filter((id) => paneRefs.current[id]?.isConnected());
            if (staggerMs > 0) {
                online.forEach((id, i) => {
                    const t = setTimeout(() => paneRefs.current[id]?.sendInput(payload), i * staggerMs);
                    timersRef.current.push(t);
                });
            } else {
                online.forEach((id) => paneRefs.current[id]?.sendInput(payload));
            }
            return { ready: online.length, total: targets.length };
        },
        [getTargetIds, staggerMs]
    );

    const recordHistory = useCallback((cmd, count) => {
        setHistory((prev) => {
            if (prev[0]?.cmd === cmd) return [{ ...prev[0], ts: Date.now(), count }, ...prev.slice(1)];
            return [{ id: newId(), cmd, ts: Date.now(), count }, ...prev].slice(0, HISTORY_LIMIT);
        });
    }, []);

    const sendCommand = useCallback(
        (normalized) => {
            const result = dispatchCommand(`${normalized.replace(/\n/g, "\r")}\r`);
            if (result.total === 0) {
                notify("warning", "No VMs selected. Select at least one terminal.");
                return "failed";
            }
            if (result.ready === 0) {
                notify("warning", "Selected terminals are not connected.");
                return "failed";
            }
            recordHistory(normalized, result.ready);
            const skipped = result.total - result.ready;
            notify(
                "success",
                `${staggerMs > 0 ? "Rolling command to" : "Sent command to"} ${result.ready} terminal(s)${
                    skipped > 0 ? ` (${skipped} offline skipped)` : ""
                }.`
            );
            return "sent";
        },
        [dispatchCommand, notify, recordHistory, staggerMs]
    );

    const runCommand = useCallback(
        (rawCmd) => {
            const normalized = String(rawCmd || "")
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n")
                .trim();
            if (!normalized) return "failed";
            if (isDangerous(normalized) && getTargetIds().length > 1) {
                setPendingDangerCmd(normalized);
                return "pending";
            }
            return sendCommand(normalized);
        },
        [getTargetIds, sendCommand]
    );

    const handleConfirmDanger = () => {
        if (pendingDangerCmd) sendCommand(pendingDangerCmd);
        setPendingDangerCmd(null);
    };

    const reconnectableIds = useMemo(
        () =>
            machines
                .map(getMachineId)
                .filter((id) => id && (statusMap[id] === "CLOSED" || statusMap[id] === "DISCONNECTED")),
        [machines, statusMap]
    );

    const handleReconnectAll = () => {
        reconnectableIds.forEach((id, i) => {
            const t = setTimeout(() => paneRefs.current[id]?.reconnect(), i * 120);
            timersRef.current.push(t);
        });
    };

    const handleClearAll = () => Object.values(paneRefs.current).forEach((h) => h?.clear());

    const handleExportLogs = () => {
        const stamp = new Date().toISOString();
        const parts = machines
            .map((m) => {
                const id = getMachineId(m);
                const text = paneRefs.current[id]?.getText?.() || "";
                return `===== ${getMachineName(m)} (${id}) @ ${stamp} =====\n${text}\n`;
            })
            .join("\n");
        const blob = new Blob([parts], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fleet-terminals-${stamp.replace(/[:.]/g, "-")}.log`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const handleRefreshMachines = () => void loadMachines();

    const handleColumnsChange = (_, val) => {
        if (!val) return;
        setColumns(val);
        setPaneHeight(getDefaultHeightForColumns(val));
    };

    const changeFont = (delta) =>
        setFontSize((p) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, p + delta)));
    const changeHeight = (delta) =>
        setPaneHeight((p) => Math.min(MAX_PANE_HEIGHT, Math.max(MIN_PANE_HEIGHT, p + delta)));

    const filteredPopupMachines = useMemo(() => {
        const q = vmSearch.trim().toLowerCase();
        if (!q) return machines;
        return machines.filter(
            (m) => getMachineName(m).toLowerCase().includes(q) || getMachineId(m).toLowerCase().includes(q)
        );
    }, [machines, vmSearch]);

    const selectIds = (ids) => setBroadcastIds(new Set(ids.filter(Boolean)));
    const handleSelectAll = () => selectIds(filteredPopupMachines.map(getMachineId));
    const handleSelectOnline = () =>
        selectIds(machines.map(getMachineId).filter((id) => statusMap[id] === "CONNECTED"));
    const handleInvert = () =>
        selectIds(machines.map(getMachineId).filter((id) => id && !broadcastIds.has(id)));

    const handleSaveGroup = () => {
        const name = newGroupName.trim();
        if (!name || broadcastIds.size === 0) return;
        setGroups((prev) => [
            ...prev.filter((g) => g.name !== name),
            { id: newId(), name, ids: [...broadcastIds] },
        ]);
        setNewGroupName("");
        notify("success", `Saved group "${name}" (${broadcastIds.size} VMs).`);
    };

    const openSaveSnippet = useCallback((cmd) => {
        setNewSnippetCmd(cmd || "");
        setNewSnippetLabel("");
        setSnippetDialogOpen(true);
    }, []);

    const handleSaveSnippet = () => {
        const label = newSnippetLabel.trim();
        const cmd = newSnippetCmd.trim();
        if (!label || !cmd) return;
        setSnippets((prev) => [...prev, { id: newId(), label, cmd }]);
        setSnippetDialogOpen(false);
        notify("success", `Saved shortcut "${label}".`);
    };

    const openHistory = useCallback(() => setHistoryOpen(true), []);
    const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
    const toggleLive = useCallback(() => setLiveSync((v) => !v), []);

    const visibleIdSet = useMemo(() => {
        const set = new Set();
        machines.forEach((m) => {
            const id = getMachineId(m);
            if (!id) return;
            if (maximizedId) {
                if (id === maximizedId) set.add(id);
                return;
            }
            if (showOnlySelected && !broadcastIds.has(id)) return;
            if (minimizedIds.has(id)) return;
            set.add(id);
        });
        return set;
    }, [machines, maximizedId, showOnlySelected, broadcastIds, minimizedIds]);

    const minimizedMachines = useMemo(
        () => machines.filter((m) => minimizedIds.has(getMachineId(m))),
        [machines, minimizedIds]
    );

    const onlineCount = machines.filter((m) => statusMap[getMachineId(m)] === "CONNECTED").length;
    const effectiveColumns = maximizedId ? 1 : columns;
    const effectiveHeight = maximizedId ? MAXIMIZED_HEIGHT : paneHeight;

    const dangerTargetNames = useMemo(
        () =>
            machines
                .filter((m) => broadcastIds.has(getMachineId(m)))
                .map(getMachineName)
                .slice(0, 12),
        [machines, broadcastIds]
    );

    const stableBtnSx = {
        textTransform: "none",
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
        borderColor: ui.borderStrong,
        color: ui.textPrimary,
        borderRadius: "4px",
    };
    const stepBtnSx = {
        border: `1px solid ${ui.borderStrong}`,
        borderRadius: "4px",
        color: ui.textPrimary,
        p: 0.35,
    };
    const jiraDialogPaper = {
        sx: {
            bgcolor: ui.surfaceBg,
            color: ui.textPrimary,
            border: `1px solid ${ui.borderStrong}`,
            borderRadius: "6px",
            boxShadow: isDark
                ? "0 16px 40px rgba(0, 0, 0, 0.65)"
                : "0 12px 32px rgba(9, 30, 66, 0.25)",
        },
    };
    const jiraTitleSx = {
        fontWeight: 600,
        fontSize: "1.125rem",
        lineHeight: 1.35,
        py: 1.75,
        px: 3,
        color: ui.textPrimary,
        borderBottom: `1px solid ${ui.border}`,
    };
    const jiraFooterSx = {
        px: 3,
        py: 1.5,
        gap: 1,
        bgcolor: ui.elevatedBg,
        borderTop: `1px solid ${ui.border}`,
    };
    const fieldLabelSx = {
        display: "block",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: ui.textSecondary,
        mb: 0.6,
    };
    const fieldSx = {
        "& .MuiOutlinedInput-root": {
            bgcolor: ui.inputBg,
            color: ui.textPrimary,
            borderRadius: "4px",
            "& fieldset": { borderColor: ui.borderStrong },
            "&.Mui-focused fieldset": { borderColor: ui.accentText, borderWidth: "1.5px" },
        },
    };
    const selectSx = {
        fontSize: "0.78rem",
        fontFamily: "monospace",
        color: ui.textPrimary,
        bgcolor: ui.inputBg,
        borderRadius: "4px",
        minWidth: 96,
        "& .MuiSelect-select": { py: 0.55, px: 1.2 },
        "& fieldset": { borderColor: ui.borderStrong },
    };

    return (
        <Box
            sx={{
                minHeight: "100%",
                bgcolor: ui.pageBg,
                color: ui.textPrimary,
                p: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                borderRadius: "6px",
                boxSizing: "border-box",
                minWidth: 0,
            }}
        >
            {/* Top Toolbar */}
            <Paper
                elevation={0}
                sx={{
                    px: 1.5,
                    py: 1,
                    bgcolor: ui.surfaceBg,
                    border: `1px solid ${ui.border}`,
                    borderRadius: "6px",
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    flexWrap="wrap"
                    useFlexGap
                    gap={1}
                >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <TerminalIcon sx={{ color: ui.accentText }} fontSize="small" />
                        <Typography
                            variant="subtitle1"
                            noWrap
                            sx={{ fontWeight: 700, color: ui.textPrimary, letterSpacing: "-0.01em" }}
                        >
                            MultiTerm
                        </Typography>
                        <Chip
                            size="small"
                            label={loadingMachines ? "Syncing" : `${machines.length} VMs`}
                            sx={{
                                minWidth: 70,
                                justifyContent: "center",
                                bgcolor: ui.chipBg,
                                color: ui.accentText,
                                fontFamily: "monospace",
                                fontWeight: 700,
                            }}
                        />
                        <Chip
                            size="small"
                            label={`${onlineCount} online`}
                            sx={{
                                bgcolor: ui.chipBg,
                                color: "#36B37E",
                                fontFamily: "monospace",
                                fontWeight: 600,
                            }}
                        />
                        <Chip
                            size="small"
                            label={`${broadcastIds.size}/${machines.length} selected`}
                            sx={{
                                bgcolor: ui.chipBg,
                                color: ui.textPrimary,
                                fontFamily: "monospace",
                                fontWeight: 600,
                            }}
                        />
                        {showOnlySelected && (
                            <Chip
                                size="small"
                                label="Selected only"
                                onDelete={() => setShowOnlySelected(false)}
                                sx={{
                                    bgcolor: "rgba(0, 82, 204, 0.14)",
                                    color: ui.accentText,
                                    fontFamily: "monospace",
                                    fontWeight: 600,
                                }}
                            />
                        )}
                        <Tooltip title="Reload VM list">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleRefreshMachines}
                                    disabled={loadingMachines}
                                    sx={stepBtnSx}
                                >
                                    <RefreshIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>

                    <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={0.75}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TuneIcon fontSize="small" />}
                            onClick={() => setVmManagerOpen(true)}
                            sx={stableBtnSx}
                        >
                            Manage VMs
                        </Button>

                        <Tooltip title="Clear screen of all terminals">
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ClearAllIcon fontSize="small" />}
                                onClick={handleClearAll}
                                sx={stableBtnSx}
                            >
                                Clear
                            </Button>
                        </Tooltip>

                        <Tooltip title="Export output of all terminals to a .log file">
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<DownloadIcon fontSize="small" />}
                                onClick={handleExportLogs}
                                disabled={machines.length === 0}
                                sx={stableBtnSx}
                            >
                                Export logs
                            </Button>
                        </Tooltip>

                        {maximizedId && (
                            <Button
                                size="small"
                                variant="contained"
                                disableElevation
                                startIcon={<CloseFullscreenIcon fontSize="small" />}
                                onClick={() => setMaximizedId(null)}
                                sx={{
                                    textTransform: "none",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    bgcolor: "#00875A",
                                    "&:hover": { bgcolor: "#006644" },
                                }}
                            >
                                Exit Max
                            </Button>
                        )}

                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RefreshIcon fontSize="small" />}
                            onClick={handleReconnectAll}
                            disabled={reconnectableIds.length === 0}
                            sx={stableBtnSx}
                        >
                            Reconnect ({reconnectableIds.length})
                        </Button>

                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SettingsIcon fontSize="small" />}
                            onClick={() => setSettingsOpen(true)}
                            sx={stableBtnSx}
                        >
                            Settings
                        </Button>
                    </Stack>
                </Stack>
            </Paper>

            {/* Single-Row Command Bar + Shortcuts Row */}
            <FleetCommandBar
                ui={ui}
                isDark={isDark}
                selectedCount={broadcastIds.size}
                shortcutLimit={shortcutLimit}
                liveSync={liveSync}
                onToggleLive={toggleLive}
                history={history}
                shortcuts={snippets}
                onRun={runCommand}
                onSendRaw={sendRawToTargets}
                onSaveSnippet={openSaveSnippet}
                onOpenHistory={openHistory}
                onOpenShortcuts={openShortcuts}
                notify={notify}
            />

            {minimizedMachines.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                    <Typography variant="caption" sx={{ color: ui.textSecondary, fontWeight: 700 }}>
                        Minimized (sessions still running):
                    </Typography>
                    {minimizedMachines.map((m) => {
                        const id = getMachineId(m);
                        return (
                            <Chip
                                key={id}
                                size="small"
                                clickable
                                label={`Restore ${getMachineName(m)}`}
                                onClick={() => handleRestoreMinimized(id)}
                                sx={{
                                    bgcolor: ui.chipBg,
                                    color: "#FFAB00",
                                    fontFamily: "monospace",
                                    fontWeight: 600,
                                }}
                            />
                        );
                    })}
                </Stack>
            )}

            {visibleIdSet.size === 0 && (
                <Alert
                    severity="info"
                    sx={{ bgcolor: ui.surfaceBg, color: ui.textPrimary, border: `1px solid ${ui.border}` }}
                >
                    {loadingMachines
                        ? "Loading virtual machines..."
                        : machines.length === 0
                        ? "No VMs found. Add a VM, then press reload."
                        : "No visible terminal panes. Open 'Manage VMs' to select terminals or restore a minimized pane."}
                </Alert>
            )}

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: effectiveColumns >= 2 ? "repeat(2, minmax(0, 1fr))" : "1fr",
                        md: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
                    },
                    gap: 1.5,
                    alignItems: "start",
                    minWidth: 0,
                }}
            >
                {machines.map((m) => {
                    const id = getMachineId(m);
                    if (!id) return null;
                    return (
                        <TerminalPane
                            key={id}
                            machine={m}
                            fontSize={fontSize}
                            height={effectiveHeight}
                            connectTimeoutMs={connectTimeoutMs}
                            retryDelayMs={retryDelayMs}
                            hidden={!visibleIdSet.has(id)}
                            isMaximized={maximizedId === id}
                            isTargetedForBroadcast={broadcastIds.has(id)}
                            onToggleBroadcastTarget={handleToggleBroadcastTarget}
                            onClosePane={handleClosePane}
                            onMinimizePane={handleMinimizePane}
                            onToggleMaximizePane={handleToggleMaximizePane}
                            onOpenMachinePage={handleOpenMachinePage}
                            onRegister={registerPane}
                            onStatusChange={handleStatusChange}
                            onNotify={onNotify}
                        />
                    );
                })}
            </Box>

            {/* Jira-Style Settings Modal */}
            <Dialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={jiraTitleSx}>MultiTerm Settings</DialogTitle>
                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    <Stack spacing={2.5}>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: ui.elevatedBg,
                                border: `1px solid ${ui.border}`,
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    color: ui.textSecondary,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    display: "block",
                                    mb: 1.5,
                                }}
                            >
                                Grid & Display
                            </Typography>

                            <Stack spacing={1.75}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Columns
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                            Number of terminal panes per row
                                        </Typography>
                                    </Box>
                                    <ToggleButtonGroup
                                        size="small"
                                        exclusive
                                        disabled={Boolean(maximizedId)}
                                        value={columns}
                                        onChange={handleColumnsChange}
                                        sx={{
                                            "& .MuiToggleButton-root": {
                                                color: ui.textSecondary,
                                                borderColor: ui.borderStrong,
                                                px: 1.15,
                                                py: 0.3,
                                                fontFamily: "monospace",
                                                fontWeight: 700,
                                                "&.Mui-selected": {
                                                    bgcolor: ui.accent,
                                                    color: "#FFFFFF",
                                                    "&:hover": { bgcolor: ui.accentHover },
                                                },
                                            },
                                        }}
                                    >
                                        {[1, 2, 3, 4].map((c) => (
                                            <ToggleButton key={c} value={c}>
                                                {c}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </Stack>

                                <Divider sx={{ borderColor: ui.border }} />

                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Terminal Font Size
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                            Applies to all active terminal sessions
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        <IconButton
                                            size="small"
                                            disabled={fontSize <= MIN_FONT_SIZE}
                                            onClick={() => changeFont(-1)}
                                            sx={stepBtnSx}
                                        >
                                            <RemoveIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                        <Typography
                                            variant="body2"
                                            sx={{ fontFamily: "monospace", fontWeight: 700, minWidth: 44, textAlign: "center" }}
                                        >
                                            {fontSize}px
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            disabled={fontSize >= MAX_FONT_SIZE}
                                            onClick={() => changeFont(1)}
                                            sx={stepBtnSx}
                                        >
                                            <AddIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    </Stack>
                                </Stack>

                                <Divider sx={{ borderColor: ui.border }} />

                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Terminal Pane Height
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                            Adjusts vertical height across all panes
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        <HeightIcon fontSize="small" sx={{ color: ui.textSecondary }} />
                                        <IconButton
                                            size="small"
                                            disabled={Boolean(maximizedId) || paneHeight <= MIN_PANE_HEIGHT}
                                            onClick={() => changeHeight(-HEIGHT_STEP)}
                                            sx={stepBtnSx}
                                        >
                                            <RemoveIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                        <Typography
                                            variant="body2"
                                            sx={{ fontFamily: "monospace", fontWeight: 700, minWidth: 52, textAlign: "center" }}
                                        >
                                            {maximizedId ? "MAX" : `${paneHeight}px`}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            disabled={Boolean(maximizedId) || paneHeight >= MAX_PANE_HEIGHT}
                                            onClick={() => changeHeight(HEIGHT_STEP)}
                                            sx={stepBtnSx}
                                        >
                                            <AddIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    </Stack>
                                </Stack>
                            </Stack>
                        </Box>

                        <Box
                            sx={{
                                p: 2,
                                borderRadius: "4px",
                                bgcolor: ui.elevatedBg,
                                border: `1px solid ${ui.border}`,
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    color: ui.textSecondary,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    display: "block",
                                    mb: 1.5,
                                }}
                            >
                                Connection, Retry & Shortcuts
                            </Typography>

                            <Stack spacing={1.75}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Rolling Delay
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                            Delay between VMs during command broadcast
                                        </Typography>
                                    </Box>
                                    <Select
                                        size="small"
                                        value={staggerMs}
                                        onChange={(e) => setStaggerMs(Number(e.target.value))}
                                        sx={selectSx}
                                    >
                                        <MenuItem value={0}>Off</MenuItem>
                                        <MenuItem value={250}>250ms</MenuItem>
                                        <MenuItem value={500}>500ms</MenuItem>
                                        <MenuItem value={1000}>1s</MenuItem>
                                        <MenuItem value={2000}>2s</MenuItem>
                                        <MenuItem value={5000}>5s</MenuItem>
                                    </Select>
                                </Stack>

                                <Divider sx={{ borderColor: ui.border }} />

                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Connection Timeout
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                            Marks stalled connection attempts offline after timeout
                                        </Typography>
                                    </Box>
                                    <Select
                                        size="small"
                                        value={connectTimeoutMs}
                                        onChange={(e) => setConnectTimeoutMs(Number(e.target.value))}
                                        sx={selectSx}
                                    >
                                        <MenuItem value={0}>Off</MenuItem>
                                        <MenuItem value={5000}>5s</MenuItem>
                                        <MenuItem value={10000}>10s</MenuItem>
                                        <MenuItem value={15000}>15s</MenuItem>
                                        <MenuItem value={30000}>30s</MenuItem>
                                        <MenuItem value={60000}>60s</MenuItem>
                                    </Select>
                                </Stack>

                                <Divider sx={{ borderColor: ui.border }} />

                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Retry Delay
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                            Interval between automatic reconnection attempts
                                        </Typography>
                                    </Box>
                                    <Select
                                        size="small"
                                        value={retryDelayMs}
                                        onChange={(e) => setRetryDelayMs(Number(e.target.value))}
                                        sx={selectSx}
                                    >
                                        <MenuItem value={15}>15ms</MenuItem>
                                        <MenuItem value={1000}>1s</MenuItem>
                                        <MenuItem value={2000}>2s</MenuItem>
                                        <MenuItem value={3000}>3s</MenuItem>
                                        <MenuItem value={4000}>4s</MenuItem>
                                        <MenuItem value={5000}>5s</MenuItem>
                                        <MenuItem value={10000}>10s</MenuItem>
                                        <MenuItem value={20000}>20s</MenuItem>
                                        <MenuItem value={30000}>30s</MenuItem>
                                        <MenuItem value={60000}>60s</MenuItem>
                                    </Select>
                                </Stack>

                                <Divider sx={{ borderColor: ui.border }} />

                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Shortcuts Shown Inline
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                            Remaining shortcuts are grouped under More
                                        </Typography>
                                    </Box>
                                    <Select
                                        size="small"
                                        value={shortcutLimit}
                                        onChange={(e) => setShortcutLimit(Number(e.target.value))}
                                        sx={selectSx}
                                    >
                                        {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n} shown
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </Stack>
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={() => setSettingsOpen(false)}
                        sx={{ textTransform: "none", fontWeight: 600, bgcolor: ui.accent, "&:hover": { bgcolor: ui.accentHover } }}
                    >
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Jira-Style Manage VMs Modal */}
            <Dialog
                open={vmManagerOpen}
                onClose={() => setVmManagerOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={jiraTitleSx}>
                    Manage VM Terminals ({broadcastIds.size}/{machines.length} selected)
                </DialogTitle>
                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography component="label" sx={fieldLabelSx}>
                                Search Terminals
                            </Typography>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Filter by VM name or ID..."
                                value={vmSearch}
                                onChange={(e) => setVmSearch(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" sx={{ color: ui.textSecondary }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={fieldSx}
                            />
                        </Box>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                <Button size="small" variant="outlined" onClick={handleSelectAll} sx={stableBtnSx}>
                                    {vmSearch.trim() ? "Select filtered" : "Select all"}
                                </Button>
                                <Button size="small" variant="outlined" onClick={handleSelectOnline} sx={stableBtnSx}>
                                    Select online
                                </Button>
                                <Button size="small" variant="outlined" onClick={handleInvert} sx={stableBtnSx}>
                                    Invert
                                </Button>
                                <Button size="small" variant="outlined" onClick={() => selectIds([])} sx={stableBtnSx}>
                                    Deselect all
                                </Button>
                            </Stack>

                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showOnlySelected}
                                        onChange={(e) => setShowOnlySelected(e.target.checked)}
                                    />
                                }
                                label={
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        Show only selected
                                    </Typography>
                                }
                            />
                        </Stack>

                        <Box
                            sx={{
                                p: 1.5,
                                borderRadius: "4px",
                                bgcolor: ui.elevatedBg,
                                border: `1px solid ${ui.border}`,
                            }}
                        >
                            <Typography sx={fieldLabelSx}>Saved VM Groups</Typography>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                                {groups.map((g) => (
                                    <Chip
                                        key={g.id}
                                        size="small"
                                        clickable
                                        label={`${g.name} (${g.ids.length})`}
                                        onClick={() =>
                                            selectIds(g.ids.filter((id) => machines.some((m) => getMachineId(m) === id)))
                                        }
                                        onDelete={() => setGroups((prev) => prev.filter((x) => x.id !== g.id))}
                                        sx={{ bgcolor: ui.chipBg, color: ui.textPrimary, fontFamily: "monospace" }}
                                    />
                                ))}
                                {groups.length === 0 && (
                                    <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                        No groups saved yet.
                                    </Typography>
                                )}
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    placeholder="New group name (e.g. web, db, staging)"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    sx={fieldSx}
                                />
                                <Button
                                    size="small"
                                    variant="contained"
                                    disableElevation
                                    disabled={!newGroupName.trim() || broadcastIds.size === 0}
                                    onClick={handleSaveGroup}
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: 600,
                                        bgcolor: ui.accent,
                                        "&:hover": { bgcolor: ui.accentHover },
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    Save group
                                </Button>
                            </Stack>
                        </Box>

                        <Box sx={{ border: `1px solid ${ui.border}`, borderRadius: "4px", overflow: "hidden" }}>
                            <List dense disablePadding sx={{ maxHeight: 260, overflowY: "auto" }}>
                                {filteredPopupMachines.map((m, i) => {
                                    const id = getMachineId(m);
                                    const st = STATUS_LABEL[statusMap[id] || "CONNECTING"] || STATUS_LABEL.CONNECTING;
                                    return (
                                        <Box key={id}>
                                            <ListItemButton
                                                onClick={() => handleToggleBroadcastTarget(id)}
                                                sx={{ py: 0.6 }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 34 }}>
                                                    <Checkbox
                                                        edge="start"
                                                        size="small"
                                                        checked={broadcastIds.has(id)}
                                                        tabIndex={-1}
                                                        disableRipple
                                                    />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={getMachineName(m)}
                                                    secondary={id}
                                                    primaryTypographyProps={{
                                                        fontWeight: 600,
                                                        fontFamily: "monospace",
                                                        fontSize: "0.8rem",
                                                    }}
                                                    secondaryTypographyProps={{
                                                        fontFamily: "monospace",
                                                        fontSize: "0.7rem",
                                                        color: ui.textSecondary,
                                                    }}
                                                />
                                                <Chip
                                                    size="small"
                                                    label={st.text}
                                                    sx={{
                                                        bgcolor: st.bg,
                                                        color: st.color,
                                                        fontFamily: "monospace",
                                                        fontSize: "0.66rem",
                                                        fontWeight: 700,
                                                    }}
                                                />
                                            </ListItemButton>
                                            {i < filteredPopupMachines.length - 1 && (
                                                <Divider sx={{ borderColor: ui.border }} />
                                            )}
                                        </Box>
                                    );
                                })}
                            </List>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={() => setVmManagerOpen(false)}
                        sx={{ textTransform: "none", fontWeight: 600, bgcolor: ui.accent, "&:hover": { bgcolor: ui.accentHover } }}
                    >
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Jira-Style Shortcuts Modal */}
            <Dialog
                open={shortcutsOpen}
                onClose={() => setShortcutsOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={jiraTitleSx}>Command Shortcuts</DialogTitle>
                <DialogContent sx={{ px: 3, py: 2 }}>
                    <List dense disablePadding>
                        {snippets.map((item, i) => (
                            <Box key={item.id}>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    spacing={1.5}
                                    sx={{ py: 1 }}
                                >
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {item.label}
                                        </Typography>
                                        <Typography
                                            noWrap
                                            variant="caption"
                                            title={item.cmd}
                                            sx={{ fontFamily: "monospace", color: ui.textSecondary, display: "block" }}
                                        >
                                            {item.cmd}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            disableElevation
                                            startIcon={<PlayArrowIcon fontSize="small" />}
                                            onClick={() => {
                                                const outcome = runCommand(item.cmd);
                                                if (outcome !== "failed") setShortcutsOpen(false);
                                            }}
                                            sx={{
                                                textTransform: "none",
                                                fontWeight: 600,
                                                bgcolor: ui.accent,
                                                "&:hover": { bgcolor: ui.accentHover },
                                                fontSize: "0.75rem",
                                            }}
                                        >
                                            Run
                                        </Button>
                                        <IconButton
                                            size="small"
                                            onClick={() => setSnippets((prev) => prev.filter((s) => s.id !== item.id))}
                                            sx={{ color: "#DE350B" }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                </Stack>
                                {i < snippets.length - 1 && <Divider sx={{ borderColor: ui.border }} />}
                            </Box>
                        ))}
                        {snippets.length === 0 && (
                            <Typography variant="body2" sx={{ color: ui.textSecondary, py: 1.5 }}>
                                No shortcuts saved. Add one or restore defaults.
                            </Typography>
                        )}
                    </List>
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button
                        onClick={() => {
                            setShortcutsOpen(false);
                            openSaveSnippet("");
                        }}
                        sx={{ textTransform: "none", fontWeight: 600, color: ui.accentText, mr: "auto" }}
                    >
                        + Add shortcut
                    </Button>
                    <Button
                        onClick={() => setSnippets(DEFAULT_SNIPPETS)}
                        sx={{ textTransform: "none", color: ui.textSecondary }}
                    >
                        Restore defaults
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setShortcutsOpen(false)}
                        sx={stableBtnSx}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Jira-Style History Modal */}
            <Dialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={jiraTitleSx}>Command History</DialogTitle>
                <DialogContent sx={{ px: 3, py: 2 }}>
                    {history.length === 0 ? (
                        <Typography variant="body2" sx={{ color: ui.textSecondary, py: 1.5 }}>
                            Commands you run appear here, newest first.
                        </Typography>
                    ) : (
                        <List dense disablePadding>
                            {history.map((h, i) => (
                                <Box key={h.id}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        spacing={1.5}
                                        sx={{ py: 1 }}
                                    >
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography
                                                noWrap
                                                variant="body2"
                                                title={h.cmd}
                                                sx={{ fontFamily: "monospace", fontWeight: 600 }}
                                            >
                                                {h.cmd.split("\n")[0]}
                                                {h.cmd.includes("\n") ? " ..." : ""}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                                {new Date(h.ts).toLocaleString()} · {h.count} VM(s)
                                            </Typography>
                                        </Box>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<PlayArrowIcon fontSize="small" />}
                                            onClick={() => {
                                                const outcome = runCommand(h.cmd);
                                                if (outcome !== "failed") setHistoryOpen(false);
                                            }}
                                            sx={stableBtnSx}
                                        >
                                            Run again
                                        </Button>
                                        <IconButton
                                            size="small"
                                            onClick={() => openSaveSnippet(h.cmd)}
                                            sx={{ color: ui.accentText }}
                                            title="Save as shortcut"
                                        >
                                            <AddIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                    {i < history.length - 1 && <Divider sx={{ borderColor: ui.border }} />}
                                </Box>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button
                        disabled={history.length === 0}
                        onClick={() => setHistory([])}
                        sx={{ textTransform: "none", fontWeight: 600, color: "#DE350B", mr: "auto" }}
                    >
                        Clear history
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setHistoryOpen(false)}
                        sx={stableBtnSx}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Jira-Style Dangerous Command Confirmation Modal */}
            <Dialog
                open={Boolean(pendingDangerCmd)}
                onClose={() => setPendingDangerCmd(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={{ ...jiraTitleSx, display: "flex", alignItems: "center", gap: 1, color: "#FFAB00" }}>
                    <WarningAmberIcon fontSize="small" />
                    Confirm Broadcast Command
                </DialogTitle>
                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    <Typography variant="body2" sx={{ mb: 1.25, color: ui.textSecondary }}>
                        This command will run across <strong>{broadcastIds.size}</strong> selected terminals:
                    </Typography>
                    <Box
                        component="pre"
                        sx={{
                            p: 1.5,
                            m: 0,
                            bgcolor: ui.inputBg,
                            borderRadius: "4px",
                            border: `1px solid ${ui.border}`,
                            color: "#FF5630",
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            overflowX: "auto",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {pendingDangerCmd}
                    </Box>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                        {dangerTargetNames.map((n) => (
                            <Chip key={n} size="small" label={n} sx={{ bgcolor: ui.chipBg, color: ui.textPrimary }} />
                        ))}
                        {broadcastIds.size > dangerTargetNames.length && (
                            <Chip
                                size="small"
                                label={`+${broadcastIds.size - dangerTargetNames.length} more`}
                                sx={{ bgcolor: ui.chipBg, color: ui.textSecondary }}
                            />
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button onClick={() => setPendingDangerCmd(null)} sx={{ textTransform: "none", color: ui.textSecondary }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={handleConfirmDanger}
                        sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            bgcolor: "#DE350B",
                            color: "#FFFFFF",
                            "&:hover": { bgcolor: "#BF2600" },
                        }}
                    >
                        Execute anyway
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Jira-Style Save Shortcut Modal */}
            <Dialog
                open={snippetDialogOpen}
                onClose={() => setSnippetDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={jiraTitleSx}>Save Command Shortcut</DialogTitle>
                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography component="label" sx={fieldLabelSx}>
                                Shortcut Label <Box component="span" sx={{ color: "#DE350B" }}>*</Box>
                            </Typography>
                            <TextField
                                autoFocus
                                fullWidth
                                size="small"
                                placeholder="e.g. Check Nginx Status"
                                value={newSnippetLabel}
                                onChange={(e) => setNewSnippetLabel(e.target.value)}
                                sx={fieldSx}
                            />
                        </Box>
                        <Box>
                            <Typography component="label" sx={fieldLabelSx}>
                                Shell Command <Box component="span" sx={{ color: "#DE350B" }}>*</Box>
                            </Typography>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="e.g. systemctl status nginx --no-pager"
                                value={newSnippetCmd}
                                onChange={(e) => setNewSnippetCmd(e.target.value)}
                                sx={{
                                    ...fieldSx,
                                    "& .MuiOutlinedInput-root": {
                                        ...fieldSx["& .MuiOutlinedInput-root"],
                                        fontFamily: "monospace",
                                    },
                                }}
                            />
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button onClick={() => setSnippetDialogOpen(false)} sx={{ textTransform: "none", color: ui.textSecondary }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={!newSnippetLabel.trim() || !newSnippetCmd.trim()}
                        onClick={handleSaveSnippet}
                        sx={{ textTransform: "none", fontWeight: 600, bgcolor: ui.accent, "&:hover": { bgcolor: ui.accentHover } }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                key={toast?.key}
                open={Boolean(toast)}
                autoHideDuration={3500}
                onClose={(_, reason) => {
                    if (reason !== "clickaway") setToast(null);
                }}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    severity={toast?.severity || "info"}
                    onClose={() => setToast(null)}
                    sx={{ bgcolor: ui.surfaceBg, color: ui.textPrimary, border: `1px solid ${ui.borderStrong}` }}
                >
                    {toast?.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}