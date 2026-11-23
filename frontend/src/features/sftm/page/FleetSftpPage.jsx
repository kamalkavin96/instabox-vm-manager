import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    InputAdornment,
    LinearProgress,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Snackbar,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DescriptionIcon from "@mui/icons-material/Description";
import CodeIcon from "@mui/icons-material/Code";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import * as LucideIcons from "lucide-react";

const EMPTY_LIST = [];
const QUICK_PATHS = ["/", "/tmp", "/var/log", "/etc", "/opt", "/home"];

const getMachineId = (m) => String(m?.machineId ?? m?.id ?? "");
const getMachineName = (m) => m?.name || m?.hostname || getMachineId(m);

const normalizePath = (p) => {
    if (!p || !p.trim()) return "/";
    const cleaned = p.replace(/\\/g, "/").replace(/\/+/g, "/");
    if (cleaned === "/") return "/";
    return cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
};

const parentPath = (p) => {
    const norm = normalizePath(p);
    if (norm === "/") return "/";
    const idx = norm.lastIndexOf("/");
    return idx <= 0 ? "/" : norm.slice(0, idx);
};

const joinPath = (base, name) => {
    const b = normalizePath(base);
    return b === "/" ? `/${name}` : `${b}/${name}`;
};

const formatBytes = (bytes) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "-";
    if (n === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const getEntryKind = (entry) => {
    if (entry?.type === "dir" || entry?.isDirectory) return "dir";
    const name = String(entry?.name || "").toLowerCase();
    if (/\.(log|txt|out|err|md)$/i.test(name)) return "log";
    if (/\.(json|ya?ml|toml|xml|ini|conf|env|properties)$/i.test(name)) return "config";
    if (/\.(sh|bash|zsh|py|js|jsx|ts|tsx|java|sql|go|rs|c|cpp|h|rb|php)$/i.test(name)) return "code";
    if (/\.(zip|tar|gz|tgz|bz2|xz|7z|rar)$/i.test(name)) return "archive";
    return "file";
};

function EntryIcon({ entry, ui }) {
    const kind = getEntryKind(entry);
    const LucideFolder = LucideIcons?.Folder;
    const LucideFileText = LucideIcons?.FileText;
    const LucideFileCode = LucideIcons?.FileCode;
    const LucideFileCog = LucideIcons?.FileCog;
    const LucideFileArchive = LucideIcons?.FileArchive;
    const LucideFile = LucideIcons?.File;

    if (kind === "dir") {
        if (LucideFolder) return <LucideFolder size={16} color="#4C9AFF" strokeWidth={2} style={{ flexShrink: 0 }} />;
        return <FolderIcon sx={{ fontSize: 17, color: "#4C9AFF", flexShrink: 0 }} />;
    }
    if (kind === "log") {
        if (LucideFileText) return <LucideFileText size={16} color="#36B37E" strokeWidth={2} style={{ flexShrink: 0 }} />;
        return <DescriptionIcon sx={{ fontSize: 17, color: "#36B37E", flexShrink: 0 }} />;
    }
    if (kind === "config") {
        if (LucideFileCog) return <LucideFileCog size={16} color="#FFAB00" strokeWidth={2} style={{ flexShrink: 0 }} />;
        return <SettingsApplicationsIcon sx={{ fontSize: 17, color: "#FFAB00", flexShrink: 0 }} />;
    }
    if (kind === "code") {
        if (LucideFileCode) return <LucideFileCode size={16} color="#A78BFA" strokeWidth={2} style={{ flexShrink: 0 }} />;
        return <CodeIcon sx={{ fontSize: 17, color: "#A78BFA", flexShrink: 0 }} />;
    }
    if (kind === "archive") {
        if (LucideFileArchive) return <LucideFileArchive size={16} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} />;
        return <FolderZipIcon sx={{ fontSize: 17, color: "#F97316", flexShrink: 0 }} />;
    }
    if (LucideFile) return <LucideFile size={16} color={ui.textSecondary} strokeWidth={2} style={{ flexShrink: 0 }} />;
    return <InsertDriveFileIcon sx={{ fontSize: 17, color: ui.textSecondary, flexShrink: 0 }} />;
}

export default function FleetSftpPage({ initialMachines = EMPTY_LIST, onNotify }) {
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
                      dropBg: "rgba(76, 154, 255, 0.08)",
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
                      dropBg: "rgba(0, 82, 204, 0.06)",
                  },
        [isDark]
    );

    const onNotifyRef = useRef(onNotify);
    onNotifyRef.current = onNotify;
    const [toast, setToast] = useState(null);

    const notify = useCallback((severity, message) => {
        const fn = onNotifyRef.current?.[severity];
        if (typeof fn === "function") {
            fn(message);
            return;
        }
        setToast({ severity, message, key: Date.now() });
    }, []);

    const [machines, setMachines] = useState(initialMachines);
    const [loadingMachines, setLoadingMachines] = useState(false);

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

    const allMachineIds = useMemo(() => machines.map(getMachineId).filter(Boolean), [machines]);

    const [activeVmId, setActiveVmId] = useState("");
    const [selectedVmIds, setSelectedVmIds] = useState(() => new Set());
    const [pathsByVm, setPathsByVm] = useState({});
    const [entriesByVm, setEntriesByVm] = useState({});
    const [loadingVm, setLoadingVm] = useState({});
    const [errorByVm, setErrorByVm] = useState({});
    const [searchFilter, setSearchFilter] = useState("");

    // "local-to-selected" | "one-to-all" | "one-to-one" | "one-to-many"
    const [transferMode, setTransferMode] = useState("local-to-selected");
    // "same" | "different" (used when transferMode === "one-to-many")
    const [manyDestStrategy, setManyDestStrategy] = useState("same");

    const [sourceVmId, setSourceVmId] = useState("");
    const [sourcePathInput, setSourcePathInput] = useState("/tmp/app.jar");
    const [remoteDestPath, setRemoteDestPath] = useState("/tmp");
    const [singleDestVmId, setSingleDestVmId] = useState("");
    const [destVmIds, setDestVmIds] = useState(() => new Set());
    const [destPathByVm, setDestPathByVm] = useState({});
    const [doneVmIds, setDoneVmIds] = useState(() => new Set());
    const [failedVmIds, setFailedVmIds] = useState(() => new Set());

    // Modal for picking destination path for a specific VM ("different" strategy or quick edit)
    const [vmDestModalId, setVmDestModalId] = useState("");
    const [vmDestModalPath, setVmDestModalPath] = useState("/tmp");

    const [localFiles, setLocalFiles] = useState([]);
    const [isDraggingLocal, setIsDraggingLocal] = useState(false);
    const fileInputRef = useRef(null);

    const [overwrite, setOverwrite] = useState(true);
    const [fileMode, setFileMode] = useState("0644");

    const [mkdirOpen, setMkdirOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [jobs, setJobs] = useState([]);

    const [uploading, setUploading] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [deletingEntry, setDeletingEntry] = useState(false);
    const [downloadingPath, setDownloadingPath] = useState("");

    useEffect(() => {
        if (allMachineIds.length === 0) return;
        setActiveVmId((prev) => (prev && allMachineIds.includes(prev) ? prev : allMachineIds[0]));
        setSourceVmId((prev) => (prev && allMachineIds.includes(prev) ? prev : allMachineIds[0]));
        setSingleDestVmId((prev) => {
            if (prev && allMachineIds.includes(prev) && prev !== sourceVmId) return prev;
            return allMachineIds.find((id) => id !== sourceVmId) || allMachineIds[0];
        });
        setSelectedVmIds((prev) => {
            const valid = [...prev].filter((id) => allMachineIds.includes(id));
            return new Set(valid.length > 0 ? valid : allMachineIds);
        });
        setDestVmIds((prev) => {
            const valid = [...prev].filter((id) => allMachineIds.includes(id));
            return new Set(valid.length > 0 ? valid : allMachineIds);
        });
    }, [allMachineIds, sourceVmId]);

    const currentPath = normalizePath(pathsByVm[activeVmId] || "/");
    const currentEntries = entriesByVm[activeVmId] || [];
    const isCurrentLoading = Boolean(loadingVm[activeVmId]);
    const currentError = errorByVm[activeVmId] || "";
    const isBusy =
        loadingMachines ||
        isCurrentLoading ||
        uploading ||
        transferring ||
        creatingFolder ||
        deletingEntry ||
        Boolean(downloadingPath);

    const fetchDirectory = useCallback(async (vmId, targetPath = "/") => {
        if (!vmId) return;
        const norm = normalizePath(targetPath);
        setLoadingVm((prev) => ({ ...prev, [vmId]: true }));
        setErrorByVm((prev) => ({ ...prev, [vmId]: "" }));
        try {
            const res = await fetch(
                `/api/v1/instabox/machines/${encodeURIComponent(vmId)}/sftp/list?path=${encodeURIComponent(norm)}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const rawList = Array.isArray(data)
                ? data
                : data?.entries || data?.files || data?.items || data?.data || [];
            const sorted = [...rawList].sort((a, b) => {
                const aDir = a?.type === "dir" || a?.isDirectory ? 0 : 1;
                const bDir = b?.type === "dir" || b?.isDirectory ? 0 : 1;
                if (aDir !== bDir) return aDir - bDir;
                return String(a?.name || "").localeCompare(String(b?.name || ""));
            });
            setPathsByVm((prev) => ({ ...prev, [vmId]: norm }));
            setEntriesByVm((prev) => ({ ...prev, [vmId]: sorted }));
        } catch (err) {
            setErrorByVm((prev) => ({ ...prev, [vmId]: err.message || "Failed to list directory" }));
        } finally {
            setLoadingVm((prev) => ({ ...prev, [vmId]: false }));
        }
    }, []);

    useEffect(() => {
        if (activeVmId) {
            void fetchDirectory(activeVmId, pathsByVm[activeVmId] || "/");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeVmId]);

    const pushJob = useCallback((job) => {
        setJobs((prev) => [
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), ...job },
            ...prev.slice(0, 49),
        ]);
    }, []);

    const filteredEntries = useMemo(() => {
        const q = searchFilter.trim().toLowerCase();
        if (!q) return currentEntries;
        return currentEntries.filter((e) => String(e?.name || "").toLowerCase().includes(q));
    }, [currentEntries, searchFilter]);

    const addLocalFiles = useCallback((incoming) => {
        const list = Array.from(incoming || []);
        if (list.length === 0) return;
        setLocalFiles((prev) => {
            const seen = new Set(prev.map((f) => `${f.name}::${f.size}::${f.lastModified}`));
            const merged = [...prev];
            for (const f of list) {
                const key = `${f.name}::${f.size}::${f.lastModified}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(f);
                }
            }
            return merged;
        });
    }, []);

    const toggleSelectedVm = (vmId) => {
        setSelectedVmIds((prev) => {
            const next = new Set(prev);
            if (next.has(vmId)) next.delete(vmId);
            else next.add(vmId);
            return next;
        });
    };

    const toggleDestVm = (vmId) => {
        setDestVmIds((prev) => {
            const next = new Set(prev);
            if (next.has(vmId)) next.delete(vmId);
            else next.add(vmId);
            return next;
        });
    };

    const getEffectiveDestPathForVm = useCallback(
        (vmId) => {
            if (transferMode === "one-to-many" && manyDestStrategy === "different") {
                return normalizePath(destPathByVm[vmId] || remoteDestPath || "/tmp");
            }
            return normalizePath(remoteDestPath || "/tmp");
        },
        [transferMode, manyDestStrategy, destPathByVm, remoteDestPath]
    );

    const openVmDestinationDialog = (vmId) => {
        setVmDestModalId(vmId);
        setVmDestModalPath(getEffectiveDestPathForVm(vmId));
    };

    const saveVmDestinationAndMarkDone = () => {
        if (!vmDestModalId) return;
        const norm = normalizePath(vmDestModalPath || "/tmp");
        setDestPathByVm((prev) => ({ ...prev, [vmDestModalId]: norm }));
        setDestVmIds((prev) => {
            const next = new Set(prev);
            next.add(vmDestModalId);
            return next;
        });
        setDoneVmIds((prev) => {
            const next = new Set(prev);
            next.add(vmDestModalId);
            return next;
        });
        setFailedVmIds((prev) => {
            const next = new Set(prev);
            next.delete(vmDestModalId);
            return next;
        });
        setVmDestModalId("");
        notify("success", `Set destination ${norm} for ${vmDestModalId} and marked as Done.`);
    };

    const handleOpenEntry = (entry) => {
        const name = entry?.name;
        if (!name) return;
        const fullPath = entry?.path || joinPath(currentPath, name);
        if (entry?.type === "dir" || entry?.isDirectory) {
            void fetchDirectory(activeVmId, fullPath);
        } else {
            setSourceVmId(activeVmId);
            setSourcePathInput(fullPath);
            notify("info", `Selected ${fullPath} on ${activeVmId} as transfer source.`);
        }
    };

    const handleDownloadEntry = async (entry) => {
        if (!activeVmId || !entry?.name || downloadingPath) return;
        const filePath = entry?.path || joinPath(currentPath, entry.name);
        setDownloadingPath(filePath);
        try {
            const res = await fetch(
                `/api/v1/instabox/machines/${encodeURIComponent(activeVmId)}/sftp/download?path=${encodeURIComponent(filePath)}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = entry.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            pushJob({
                mode: "Download",
                source: `${activeVmId}:${filePath}`,
                target: `Local (${entry.name})`,
                status: "SUCCESS",
                detail: formatBytes(blob.size),
            });
        } catch (err) {
            pushJob({
                mode: "Download",
                source: `${activeVmId}:${filePath}`,
                target: `Local (${entry.name})`,
                status: "FAILED",
                detail: err.message,
            });
            notify("error", `Download failed: ${err.message}`);
        } finally {
            setDownloadingPath("");
        }
    };

    const handleCreateFolder = async () => {
        const folder = newFolderName.trim();
        if (!folder || !activeVmId || creatingFolder) return;
        const target = joinPath(currentPath, folder);
        setCreatingFolder(true);
        try {
            const res = await fetch(
                `/api/v1/instabox/machines/${encodeURIComponent(activeVmId)}/sftp/mkdir`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: target }),
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setMkdirOpen(false);
            setNewFolderName("");
            notify("success", `Created folder ${target}`);
            void fetchDirectory(activeVmId, currentPath);
        } catch (err) {
            notify("error", `Create folder failed: ${err.message}`);
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || !activeVmId || deletingEntry) return;
        const target = deleteTarget.path || joinPath(currentPath, deleteTarget.name);
        setDeletingEntry(true);
        try {
            const res = await fetch(
                `/api/v1/instabox/machines/${encodeURIComponent(activeVmId)}/sftp/entry?path=${encodeURIComponent(target)}`,
                { method: "DELETE", credentials: "include" }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setDeleteTarget(null);
            notify("success", `Deleted ${deleteTarget.name}`);
            void fetchDirectory(activeVmId, currentPath);
        } catch (err) {
            notify("error", `Delete failed: ${err.message}`);
        } finally {
            setDeletingEntry(false);
        }
    };

    const resolveTargetVmIds = useCallback(() => {
        if (transferMode === "local-to-selected") {
            const selected = [...selectedVmIds].filter((id) => allMachineIds.includes(id));
            return selected.length > 0 ? selected : activeVmId ? [activeVmId] : [];
        }
        if (transferMode === "one-to-all") {
            return allMachineIds.filter((id) => id !== sourceVmId);
        }
        if (transferMode === "one-to-one") {
            return singleDestVmId && singleDestVmId !== sourceVmId ? [singleDestVmId] : [];
        }
        return [...destVmIds].filter((id) => allMachineIds.includes(id) && id !== sourceVmId);
    }, [transferMode, selectedVmIds, allMachineIds, activeVmId, sourceVmId, singleDestVmId, destVmIds]);

    const runLocalToSelectedUpload = async () => {
        if (uploading) return;
        const targets = resolveTargetVmIds();
        if (localFiles.length === 0) {
            notify("warning", "Drop or choose at least one local file to upload.");
            return;
        }
        if (targets.length === 0) {
            notify("warning", "Select at least one target VM.");
            return;
        }
        const destDir = normalizePath(remoteDestPath || "/tmp");
        setUploading(true);
        setDoneVmIds(new Set());
        setFailedVmIds(new Set());

        try {
            for (const vmId of targets) {
                let vmAllOk = true;
                for (const file of localFiles) {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("targetPath", joinPath(destDir, file.name));
                    formData.append("overwrite", String(overwrite));
                    formData.append("mode", fileMode || "0644");
                    try {
                        const res = await fetch(
                            `/api/v1/instabox/machines/${encodeURIComponent(vmId)}/sftp/upload`,
                            { method: "POST", credentials: "include", body: formData }
                        );
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        pushJob({
                            mode: "Local → VM",
                            source: `Local:${file.name}`,
                            target: `${vmId}:${joinPath(destDir, file.name)}`,
                            status: "SUCCESS",
                            detail: formatBytes(file.size),
                        });
                    } catch (err) {
                        vmAllOk = false;
                        pushJob({
                            mode: "Local → VM",
                            source: `Local:${file.name}`,
                            target: `${vmId}:${joinPath(destDir, file.name)}`,
                            status: "FAILED",
                            detail: err.message,
                        });
                    }
                }
                if (vmAllOk) {
                    setDoneVmIds((prev) => new Set(prev).add(vmId));
                } else {
                    setFailedVmIds((prev) => new Set(prev).add(vmId));
                }
                if (vmId === activeVmId) {
                    void fetchDirectory(vmId, currentPath);
                }
            }
            notify("success", `Processed upload for ${targets.length} VM(s).`);
        } finally {
            setUploading(false);
        }
    };

    const runVmToVmTransfer = async () => {
        if (transferring) return;
        const srcPath = normalizePath(sourcePathInput);
        if (!sourceVmId || !srcPath || srcPath === "/") {
            notify("warning", "Select a source VM and a valid source file/folder path.");
            return;
        }
        const targets = resolveTargetVmIds();
        if (targets.length === 0) {
            notify("warning", "Select at least one destination VM different from the source VM.");
            return;
        }
        setTransferring(true);
        setDoneVmIds(new Set());
        setFailedVmIds(new Set());

        const modeLabel =
            transferMode === "one-to-all"
                ? "1-VM → All"
                : transferMode === "one-to-one"
                ? "1-VM → 1-VM"
                : "1-VM → Many";

        try {
            if (transferMode === "one-to-many" && manyDestStrategy === "different") {
                for (const vmId of targets) {
                    const vmDest = getEffectiveDestPathForVm(vmId);
                    try {
                        const res = await fetch("/api/v1/instabox/sftp/transfer", {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                sourceMachineId: sourceVmId,
                                sourcePath: srcPath,
                                targetMachineIds: [vmId],
                                targetPath: vmDest,
                                overwrite,
                                mode: fileMode || "0644",
                            }),
                        });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        setDoneVmIds((prev) => new Set(prev).add(vmId));
                        pushJob({
                            mode: modeLabel,
                            source: `${sourceVmId}:${srcPath}`,
                            target: `${vmId}:${vmDest}`,
                            status: "SUCCESS",
                            detail: `mode ${fileMode}`,
                        });
                        if (vmId === activeVmId) void fetchDirectory(vmId, currentPath);
                    } catch (err) {
                        setFailedVmIds((prev) => new Set(prev).add(vmId));
                        pushJob({
                            mode: modeLabel,
                            source: `${sourceVmId}:${srcPath}`,
                            target: `${vmId}:${vmDest}`,
                            status: "FAILED",
                            detail: err.message,
                        });
                    }
                }
                notify("success", `Completed per-VM transfers to ${targets.length} VM(s).`);
                return;
            }

            const destDir = normalizePath(remoteDestPath || srcPath);
            const res = await fetch("/api/v1/instabox/sftp/transfer", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceMachineId: sourceVmId,
                    sourcePath: srcPath,
                    targetMachineIds: targets,
                    targetPath: destDir,
                    overwrite,
                    mode: fileMode || "0644",
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setDoneVmIds(new Set(targets));
            targets.forEach((vmId) => {
                pushJob({
                    mode: modeLabel,
                    source: `${sourceVmId}:${srcPath}`,
                    target: `${vmId}:${destDir}`,
                    status: "SUCCESS",
                    detail: `mode ${fileMode}`,
                });
                if (vmId === activeVmId) {
                    void fetchDirectory(vmId, currentPath);
                }
            });
            notify("success", `Transferred ${srcPath} from ${sourceVmId} to ${targets.length} VM(s).`);
        } catch (err) {
            setFailedVmIds(new Set(targets));
            const fallbackDest = normalizePath(remoteDestPath || srcPath);
            targets.forEach((vmId) => {
                pushJob({
                    mode: modeLabel,
                    source: `${sourceVmId}:${srcPath}`,
                    target: `${vmId}:${fallbackDest}`,
                    status: "FAILED",
                    detail: err.message,
                });
            });
            notify("error", `Transfer failed: ${err.message}`);
        } finally {
            setTransferring(false);
        }
    };

    const previewTargets = resolveTargetVmIds();

    const cardSx = {
        bgcolor: ui.surfaceBg,
        border: `1px solid ${ui.border}`,
        borderRadius: "6px",
        color: ui.textPrimary,
    };
    const panelBoxSx = {
        p: 1.5,
        bgcolor: ui.elevatedBg,
        border: `1px solid ${ui.border}`,
        borderRadius: "4px",
    };
    const btnOutlinedSx = {
        textTransform: "none",
        fontWeight: 600,
        borderRadius: "4px",
        borderColor: ui.borderStrong,
        color: ui.textPrimary,
        whiteSpace: "nowrap",
    };
    const btnPrimarySx = {
        textTransform: "none",
        fontWeight: 600,
        borderRadius: "4px",
        bgcolor: ui.accent,
        "&:hover": { bgcolor: ui.accentHover },
        whiteSpace: "nowrap",
    };
    const inputSx = {
        "& .MuiOutlinedInput-root": {
            bgcolor: ui.inputBg,
            color: ui.textPrimary,
            borderRadius: "4px",
            "& fieldset": { borderColor: ui.borderStrong },
        },
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

    const renderVmStatusChip = (vmId) => {
        if (doneVmIds.has(vmId)) {
            return (
                <Chip
                    size="small"
                    icon={<CheckCircleIcon sx={{ fontSize: "13px !important" }} />}
                    label="Done"
                    color="success"
                    sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }}
                />
            );
        }
        if (failedVmIds.has(vmId)) {
            return (
                <Chip
                    size="small"
                    icon={<ErrorIcon sx={{ fontSize: "13px !important" }} />}
                    label="Failed"
                    color="error"
                    sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }}
                />
            );
        }
        return null;
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
            {/* Jira-style Header Strip */}
            <Paper elevation={0} sx={{ ...cardSx, px: 1.5, py: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap gap={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Fleet SFTP Explorer & Transfer
                        </Typography>
                        <Chip
                            size="small"
                            label={loadingMachines ? "Syncing" : `${machines.length} VMs`}
                            sx={{ bgcolor: ui.chipBg, color: ui.accentText, fontFamily: "monospace", fontWeight: 700 }}
                        />
                        <Chip
                            size="small"
                            label={`${previewTargets.length} target VM(s)`}
                            sx={{ bgcolor: ui.chipBg, color: "#36B37E", fontFamily: "monospace", fontWeight: 600 }}
                        />
                        {doneVmIds.size > 0 && (
                            <Chip
                                size="small"
                                label={`${doneVmIds.size} Done`}
                                sx={{ bgcolor: ui.chipBg, color: "#36B37E", fontFamily: "monospace", fontWeight: 700 }}
                            />
                        )}
                        {isBusy && (
                            <Chip
                                size="small"
                                icon={<CircularProgress size={12} color="inherit" />}
                                label={
                                    uploading
                                        ? "Uploading..."
                                        : transferring
                                        ? "Transferring..."
                                        : creatingFolder
                                        ? "Creating folder..."
                                        : deletingEntry
                                        ? "Deleting..."
                                        : downloadingPath
                                        ? "Downloading..."
                                        : isCurrentLoading
                                        ? "Listing files..."
                                        : "Processing..."
                                }
                                sx={{ bgcolor: ui.chipBg, color: "#FFAB00", fontFamily: "monospace", fontWeight: 700 }}
                            />
                        )}
                    </Stack>

                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={
                            loadingMachines ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon fontSize="small" />
                        }
                        disabled={loadingMachines}
                        onClick={() => void loadMachines()}
                        sx={btnOutlinedSx}
                    >
                        {loadingMachines ? "Reloading..." : "Reload VMs"}
                    </Button>
                </Stack>
            </Paper>

            {/* Transfer Orchestrator (Left -> Right Workspace) */}
            <Paper elevation={0} sx={{ ...cardSx, p: 1.5 }}>
                <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap gap={1}>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Button
                                size="small"
                                variant={transferMode === "local-to-selected" ? "contained" : "outlined"}
                                disableElevation
                                disabled={uploading || transferring}
                                startIcon={<UploadFileIcon fontSize="small" />}
                                onClick={() => setTransferMode("local-to-selected")}
                                sx={transferMode === "local-to-selected" ? btnPrimarySx : btnOutlinedSx}
                            >
                                Local → Selected VMs
                            </Button>
                            <Button
                                size="small"
                                variant={transferMode === "one-to-all" ? "contained" : "outlined"}
                                disableElevation
                                disabled={uploading || transferring}
                                startIcon={<SwapHorizIcon fontSize="small" />}
                                onClick={() => setTransferMode("one-to-all")}
                                sx={transferMode === "one-to-all" ? btnPrimarySx : btnOutlinedSx}
                            >
                                1 VM → All VMs
                            </Button>
                            <Button
                                size="small"
                                variant={transferMode === "one-to-one" ? "contained" : "outlined"}
                                disableElevation
                                disabled={uploading || transferring}
                                startIcon={<CompareArrowsIcon fontSize="small" />}
                                onClick={() => setTransferMode("one-to-one")}
                                sx={transferMode === "one-to-one" ? btnPrimarySx : btnOutlinedSx}
                            >
                                1 VM → 1 VM
                            </Button>
                            <Button
                                size="small"
                                variant={transferMode === "one-to-many" ? "contained" : "outlined"}
                                disableElevation
                                disabled={uploading || transferring}
                                startIcon={<DriveFileMoveIcon fontSize="small" />}
                                onClick={() => setTransferMode("one-to-many")}
                                sx={transferMode === "one-to-many" ? btnPrimarySx : btnOutlinedSx}
                            >
                                1 VM → Many VMs
                            </Button>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <TextField
                                size="small"
                                label="Mode"
                                disabled={uploading || transferring}
                                value={fileMode}
                                onChange={(e) => setFileMode(e.target.value)}
                                sx={{ ...inputSx, width: 90 }}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        disabled={uploading || transferring}
                                        checked={overwrite}
                                        onChange={(e) => setOverwrite(e.target.checked)}
                                    />
                                }
                                label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Overwrite</Typography>}
                            />
                        </Stack>
                    </Stack>

                    <Divider sx={{ borderColor: ui.border }} />

                    {/* Mode 1: Local (Left) -> Selected VMs (Right) with Drag & Drop */}
                    {transferMode === "local-to-selected" && (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                gap: 1.5,
                            }}
                        >
                            {/* Left: Local Dropzone & Files */}
                            <Box
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (!uploading) setIsDraggingLocal(true);
                                }}
                                onDragLeave={() => setIsDraggingLocal(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDraggingLocal(false);
                                    if (!uploading && e.dataTransfer?.files?.length) {
                                        addLocalFiles(e.dataTransfer.files);
                                    }
                                }}
                                sx={{
                                    ...panelBoxSx,
                                    borderStyle: "dashed",
                                    borderColor: isDraggingLocal ? ui.accentText : ui.borderStrong,
                                    bgcolor: isDraggingLocal ? ui.dropBg : ui.elevatedBg,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    hidden
                                    onChange={(e) => {
                                        addLocalFiles(e.target.files);
                                        e.target.value = "";
                                    }}
                                />
                                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Local Source (Drag & Drop)
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={uploading}
                                        onClick={() => fileInputRef.current?.click()}
                                        sx={btnOutlinedSx}
                                    >
                                        Browse Files ({localFiles.length})
                                    </Button>
                                </Stack>
                                <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                    Drag and drop files here or click Browse Files.
                                </Typography>

                                {localFiles.length > 0 && (
                                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                        {localFiles.map((f) => (
                                            <Chip
                                                key={`${f.name}-${f.size}-${f.lastModified}`}
                                                size="small"
                                                disabled={uploading}
                                                label={`${f.name} (${formatBytes(f.size)})`}
                                                onDelete={() => setLocalFiles((prev) => prev.filter((item) => item !== f))}
                                                sx={{ bgcolor: ui.chipBg, color: ui.textPrimary, fontFamily: "monospace" }}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </Box>

                            {/* Right: Selected Target VMs & Remote Directory */}
                            <Box sx={{ ...panelBoxSx, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Selected Target VMs ({previewTargets.length})
                                    </Typography>
                                    <Stack direction="row" spacing={0.5}>
                                        <Button
                                            size="small"
                                            disabled={uploading}
                                            onClick={() => setSelectedVmIds(new Set(allMachineIds))}
                                            sx={{ textTransform: "none", fontSize: "0.72rem" }}
                                        >
                                            Select All
                                        </Button>
                                        <Button
                                            size="small"
                                            disabled={uploading}
                                            onClick={() => setSelectedVmIds(new Set())}
                                            sx={{ textTransform: "none", fontSize: "0.72rem", color: ui.textSecondary }}
                                        >
                                            Clear
                                        </Button>
                                    </Stack>
                                </Stack>

                                <TextField
                                    size="small"
                                    label="Remote Destination Directory"
                                    disabled={uploading}
                                    value={remoteDestPath}
                                    onChange={(e) => setRemoteDestPath(e.target.value)}
                                    sx={inputSx}
                                />

                                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ maxHeight: 110, overflowY: "auto" }}>
                                    {machines.map((m) => {
                                        const id = getMachineId(m);
                                        if (!id) return null;
                                        const checked = selectedVmIds.has(id);
                                        return (
                                            <Chip
                                                key={id}
                                                size="small"
                                                clickable
                                                disabled={uploading}
                                                color={checked ? "primary" : "default"}
                                                variant={checked ? "filled" : "outlined"}
                                                label={
                                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                                        <span>{getMachineName(m)}</span>
                                                        {doneVmIds.has(id) && <CheckCircleIcon sx={{ fontSize: 13 }} />}
                                                    </Stack>
                                                }
                                                onClick={() => toggleSelectedVm(id)}
                                                sx={{ fontFamily: "monospace", fontWeight: 600 }}
                                            />
                                        );
                                    })}
                                </Stack>

                                <Box sx={{ pt: 0.5, display: "flex", justifyContent: "flex-end" }}>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disableElevation
                                        disabled={uploading}
                                        startIcon={
                                            uploading ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon fontSize="small" />
                                        }
                                        onClick={() => void runLocalToSelectedUpload()}
                                        sx={btnPrimarySx}
                                    >
                                        {uploading ? "Uploading..." : `Upload to ${previewTargets.length} VM(s)`}
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* Mode 2: 1 VM (Left Source) -> All VMs (Right Destinations) */}
                    {transferMode === "one-to-all" && (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                gap: 1.5,
                            }}
                        >
                            <Box sx={{ ...panelBoxSx, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Source VM (Left)
                                </Typography>
                                <TextField
                                    select
                                    size="small"
                                    label="Source VM"
                                    disabled={transferring}
                                    value={sourceVmId}
                                    onChange={(e) => setSourceVmId(e.target.value)}
                                    sx={inputSx}
                                >
                                    {machines.map((m) => {
                                        const id = getMachineId(m);
                                        return (
                                            <MenuItem key={id} value={id}>
                                                {getMachineName(m)} ({id})
                                            </MenuItem>
                                        );
                                    })}
                                </TextField>
                                <TextField
                                    size="small"
                                    label="Source File / Folder Path"
                                    disabled={transferring}
                                    value={sourcePathInput}
                                    onChange={(e) => setSourcePathInput(e.target.value)}
                                    sx={inputSx}
                                />
                                <TextField
                                    size="small"
                                    label="Target Path on All VMs"
                                    disabled={transferring}
                                    value={remoteDestPath}
                                    onChange={(e) => setRemoteDestPath(e.target.value)}
                                    sx={inputSx}
                                />
                            </Box>

                            <Box sx={{ ...panelBoxSx, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    All Destination VMs ({previewTargets.length})
                                </Typography>
                                <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                                    Click any target VM to inspect/edit its path or mark Done.
                                </Typography>
                                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ maxHeight: 110, overflowY: "auto" }}>
                                    {previewTargets.map((vmId) => (
                                        <Chip
                                            key={vmId}
                                            size="small"
                                            clickable
                                            onClick={() => openVmDestinationDialog(vmId)}
                                            label={
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                    <span>{vmId}</span>
                                                    {doneVmIds.has(vmId) && <CheckCircleIcon sx={{ fontSize: 13, color: "#36B37E" }} />}
                                                </Stack>
                                            }
                                            sx={{ bgcolor: ui.chipBg, color: ui.textPrimary, fontFamily: "monospace", fontWeight: 600 }}
                                        />
                                    ))}
                                </Stack>
                                <Box sx={{ mt: "auto", pt: 0.5, display: "flex", justifyContent: "flex-end" }}>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disableElevation
                                        disabled={transferring}
                                        startIcon={
                                            transferring ? <CircularProgress size={14} color="inherit" /> : <SwapHorizIcon fontSize="small" />
                                        }
                                        onClick={() => void runVmToVmTransfer()}
                                        sx={btnPrimarySx}
                                    >
                                        {transferring ? "Transferring..." : `Copy to All (${previewTargets.length})`}
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* Mode 3: 1 VM (Left) -> 1 VM (Right) */}
                    {transferMode === "one-to-one" && (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                gap: 1.5,
                            }}
                        >
                            <Box sx={{ ...panelBoxSx, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Source VM (Left)
                                </Typography>
                                <TextField
                                    select
                                    size="small"
                                    label="Source VM"
                                    disabled={transferring}
                                    value={sourceVmId}
                                    onChange={(e) => setSourceVmId(e.target.value)}
                                    sx={inputSx}
                                >
                                    {machines.map((m) => {
                                        const id = getMachineId(m);
                                        return (
                                            <MenuItem key={id} value={id}>
                                                {getMachineName(m)} ({id})
                                            </MenuItem>
                                        );
                                    })}
                                </TextField>
                                <TextField
                                    size="small"
                                    label="Source Path"
                                    disabled={transferring}
                                    value={sourcePathInput}
                                    onChange={(e) => setSourcePathInput(e.target.value)}
                                    sx={inputSx}
                                />
                            </Box>

                            <Box sx={{ ...panelBoxSx, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Destination VM (Right)
                                    </Typography>
                                    {renderVmStatusChip(singleDestVmId)}
                                </Stack>
                                <TextField
                                    select
                                    size="small"
                                    label="Destination VM"
                                    disabled={transferring}
                                    value={singleDestVmId}
                                    onChange={(e) => setSingleDestVmId(e.target.value)}
                                    sx={inputSx}
                                >
                                    {machines
                                        .filter((m) => getMachineId(m) !== sourceVmId)
                                        .map((m) => {
                                            const id = getMachineId(m);
                                            return (
                                                <MenuItem key={id} value={id}>
                                                    {getMachineName(m)} ({id})
                                                </MenuItem>
                                            );
                                        })}
                                </TextField>
                                <TextField
                                    size="small"
                                    label="Destination Path"
                                    disabled={transferring}
                                    value={remoteDestPath}
                                    onChange={(e) => setRemoteDestPath(e.target.value)}
                                    sx={inputSx}
                                />
                                <Box sx={{ pt: 0.5, display: "flex", justifyContent: "flex-end" }}>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disableElevation
                                        disabled={transferring}
                                        startIcon={
                                            transferring ? <CircularProgress size={14} color="inherit" /> : <CompareArrowsIcon fontSize="small" />
                                        }
                                        onClick={() => void runVmToVmTransfer()}
                                        sx={btnPrimarySx}
                                    >
                                        {transferring ? "Transferring..." : "Transfer 1 → 1"}
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* Mode 4: 1 VM -> Many VMs (Same Destination OR Different Destination per VM via Popup) */}
                    {transferMode === "one-to-many" && (
                        <Stack spacing={1.25}>
                            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                                <TextField
                                    select
                                    size="small"
                                    label="Source VM"
                                    disabled={transferring}
                                    value={sourceVmId}
                                    onChange={(e) => setSourceVmId(e.target.value)}
                                    sx={{ ...inputSx, minWidth: 190 }}
                                >
                                    {machines.map((m) => {
                                        const id = getMachineId(m);
                                        return (
                                            <MenuItem key={id} value={id}>
                                                {getMachineName(m)} ({id})
                                            </MenuItem>
                                        );
                                    })}
                                </TextField>
                                <TextField
                                    size="small"
                                    label="Source Path on VM"
                                    disabled={transferring}
                                    value={sourcePathInput}
                                    onChange={(e) => setSourcePathInput(e.target.value)}
                                    sx={{ ...inputSx, flex: "1 1 200px" }}
                                />
                                <RadioGroup
                                    row
                                    value={manyDestStrategy}
                                    onChange={(e) => setManyDestStrategy(e.target.value)}
                                >
                                    <FormControlLabel
                                        value="same"
                                        control={<Radio size="small" />}
                                        label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Same destination on all VMs</Typography>}
                                    />
                                    <FormControlLabel
                                        value="different"
                                        control={<Radio size="small" />}
                                        label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Different destination per VM (click VM)</Typography>}
                                    />
                                </RadioGroup>
                            </Stack>

                            {manyDestStrategy === "same" ? (
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    <TextField
                                        size="small"
                                        label="Shared Destination Path"
                                        disabled={transferring}
                                        value={remoteDestPath}
                                        onChange={(e) => setRemoteDestPath(e.target.value)}
                                        sx={{ ...inputSx, flex: "1 1 240px" }}
                                    />
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disableElevation
                                        disabled={transferring}
                                        startIcon={
                                            transferring ? <CircularProgress size={14} color="inherit" /> : <DriveFileMoveIcon fontSize="small" />
                                        }
                                        onClick={() => void runVmToVmTransfer()}
                                        sx={btnPrimarySx}
                                    >
                                        {transferring ? "Transferring..." : `Copy to ${previewTargets.length} VM(s)`}
                                    </Button>
                                </Stack>
                            ) : (
                                <Box sx={panelBoxSx}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: ui.textSecondary }}>
                                            Click any VM chip below to open its destination popup & mark Done:
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            disableElevation
                                            disabled={transferring}
                                            startIcon={
                                                transferring ? <CircularProgress size={14} color="inherit" /> : <DriveFileMoveIcon fontSize="small" />
                                            }
                                            onClick={() => void runVmToVmTransfer()}
                                            sx={btnPrimarySx}
                                        >
                                            {transferring ? "Transferring..." : `Transfer to ${previewTargets.length} VM(s)`}
                                        </Button>
                                    </Stack>
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        {machines.map((m) => {
                                            const id = getMachineId(m);
                                            if (!id || id === sourceVmId) return null;
                                            const checked = destVmIds.has(id);
                                            const customPath = destPathByVm[id] || remoteDestPath || "/tmp";
                                            const isDone = doneVmIds.has(id);
                                            return (
                                                <Chip
                                                    key={id}
                                                    size="small"
                                                    clickable
                                                    disabled={transferring}
                                                    color={checked ? "primary" : "default"}
                                                    variant={checked ? "filled" : "outlined"}
                                                    icon={<EditLocationAltIcon sx={{ fontSize: "13px !important" }} />}
                                                    label={`${getMachineName(m)} → ${customPath}${isDone ? " ✓" : ""}`}
                                                    onClick={() => openVmDestinationDialog(id)}
                                                    sx={{ fontFamily: "monospace", fontWeight: 600 }}
                                                />
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            )}

                            {manyDestStrategy === "same" && (
                                <Box sx={panelBoxSx}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: ui.textSecondary, display: "block", mb: 0.75 }}>
                                        Target VMs (click to toggle)
                                    </Typography>
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        {machines.map((m) => {
                                            const id = getMachineId(m);
                                            if (!id || id === sourceVmId) return null;
                                            const checked = destVmIds.has(id);
                                            return (
                                                <Chip
                                                    key={id}
                                                    size="small"
                                                    clickable
                                                    disabled={transferring}
                                                    color={checked ? "primary" : "default"}
                                                    variant={checked ? "filled" : "outlined"}
                                                    label={
                                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                                            <span>{getMachineName(m)}</span>
                                                            {doneVmIds.has(id) && <CheckCircleIcon sx={{ fontSize: 13 }} />}
                                                        </Stack>
                                                    }
                                                    onClick={() => toggleDestVm(id)}
                                                    sx={{ fontFamily: "monospace", fontWeight: 600 }}
                                                />
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            )}
                        </Stack>
                    )}
                </Stack>
            </Paper>

            {/* Per-VM File & Folder Explorer (Drag a file row onto a VM to set source) */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "280px 1fr" },
                    gap: 1.5,
                    alignItems: "start",
                }}
            >
                <Paper elevation={0} sx={{ ...cardSx, p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        VMs
                    </Typography>
                    <Typography variant="caption" sx={{ color: ui.textSecondary, display: "block", mb: 1 }}>
                        Click to browse. Checkbox selects VMs. Drop a file here to set source.
                    </Typography>
                    <List dense disablePadding sx={{ border: `1px solid ${ui.border}`, borderRadius: "4px", maxHeight: 420, overflowY: "auto" }}>
                        {machines.map((m, idx) => {
                            const id = getMachineId(m);
                            if (!id) return null;
                            const isActive = id === activeVmId;
                            const isSelected = selectedVmIds.has(id);
                            return (
                                <Box
                                    key={id}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const droppedRemotePath = e.dataTransfer.getData("text/sftp-path");
                                        if (droppedRemotePath) {
                                            setSourceVmId(activeVmId);
                                            setSourcePathInput(droppedRemotePath);
                                            setSingleDestVmId(id === activeVmId ? singleDestVmId : id);
                                            notify("info", `Set ${droppedRemotePath} as transfer source.`);
                                        }
                                    }}
                                >
                                    <ListItemButton
                                        selected={isActive}
                                        onClick={() => setActiveVmId(id)}
                                        sx={{
                                            py: 0.6,
                                            "&.Mui-selected": {
                                                bgcolor: isDark ? "rgba(76, 154, 255, 0.16)" : "rgba(0, 82, 204, 0.1)",
                                            },
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            <Checkbox
                                                edge="start"
                                                size="small"
                                                checked={isSelected}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelectedVm(id);
                                                }}
                                            />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        sx={{ fontSize: "0.78rem", fontWeight: 700, fontFamily: "monospace" }}
                                                    >
                                                        {getMachineName(m)}
                                                    </Typography>
                                                    {renderVmStatusChip(id)}
                                                </Stack>
                                            }
                                            secondary={loadingVm[id] ? "Loading..." : pathsByVm[id] || "/"}
                                            secondaryTypographyProps={{
                                                fontSize: "0.68rem",
                                                fontFamily: "monospace",
                                                color: loadingVm[id] ? ui.accentText : ui.textSecondary,
                                                noWrap: true,
                                            }}
                                        />
                                    </ListItemButton>
                                    {idx < machines.length - 1 && <Divider sx={{ borderColor: ui.border }} />}
                                </Box>
                            );
                        })}
                    </List>
                </Paper>

                <Paper elevation={0} sx={{ ...cardSx, p: 1.5, overflow: "hidden" }}>
                    {isCurrentLoading && <LinearProgress sx={{ mb: 1, borderRadius: "4px" }} />}
                    <Stack spacing={1.25}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap gap={1}>
                            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Tooltip title="Parent directory">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={currentPath === "/" || isCurrentLoading}
                                            onClick={() => void fetchDirectory(activeVmId, parentPath(currentPath))}
                                            sx={{ border: `1px solid ${ui.borderStrong}`, borderRadius: "4px", color: ui.textPrimary }}
                                        >
                                            <ArrowUpwardIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <TextField
                                    size="small"
                                    value={currentPath}
                                    onChange={(e) => setPathsByVm((prev) => ({ ...prev, [activeVmId]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            void fetchDirectory(activeVmId, currentPath);
                                        }
                                    }}
                                    sx={{ ...inputSx, minWidth: 220, "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "0.78rem" } }}
                                />
                                <Tooltip title="Refresh directory">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={isCurrentLoading}
                                            onClick={() => void fetchDirectory(activeVmId, currentPath)}
                                            sx={{ border: `1px solid ${ui.borderStrong}`, borderRadius: "4px", color: ui.textPrimary }}
                                        >
                                            {isCurrentLoading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon sx={{ fontSize: 15 }} />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={creatingFolder || isCurrentLoading}
                                    startIcon={<CreateNewFolderIcon fontSize="small" />}
                                    onClick={() => setMkdirOpen(true)}
                                    sx={btnOutlinedSx}
                                >
                                    New Folder
                                </Button>
                            </Stack>

                            <TextField
                                size="small"
                                placeholder="Filter files & folders..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" sx={{ color: ui.textSecondary }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ ...inputSx, width: 210 }}
                            />
                        </Stack>

                        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap alignItems="center">
                            <Typography variant="caption" sx={{ color: ui.textSecondary, fontWeight: 600 }}>
                                Jump:
                            </Typography>
                            {QUICK_PATHS.map((qp) => (
                                <Chip
                                    key={qp}
                                    size="small"
                                    clickable
                                    disabled={isCurrentLoading}
                                    label={qp}
                                    onClick={() => void fetchDirectory(activeVmId, qp)}
                                    sx={{
                                        bgcolor: currentPath === qp ? ui.accent : ui.chipBg,
                                        color: currentPath === qp ? "#FFFFFF" : ui.textPrimary,
                                        fontFamily: "monospace",
                                        fontSize: "0.7rem",
                                    }}
                                />
                            ))}
                        </Stack>

                        {currentError && (
                            <Alert severity="error" sx={{ py: 0.5 }}>
                                {currentError}
                            </Alert>
                        )}

                        <TableContainer sx={{ border: `1px solid ${ui.border}`, borderRadius: "4px", maxHeight: 340 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ bgcolor: ui.elevatedBg, color: ui.textSecondary, fontWeight: 700, fontSize: "0.72rem" }}>
                                            Name
                                        </TableCell>
                                        <TableCell sx={{ bgcolor: ui.elevatedBg, color: ui.textSecondary, fontWeight: 700, fontSize: "0.72rem" }}>
                                            Size
                                        </TableCell>
                                        <TableCell sx={{ bgcolor: ui.elevatedBg, color: ui.textSecondary, fontWeight: 700, fontSize: "0.72rem" }}>
                                            Permissions
                                        </TableCell>
                                        <TableCell align="right" sx={{ bgcolor: ui.elevatedBg, color: ui.textSecondary, fontWeight: 700, fontSize: "0.72rem" }}>
                                            Actions
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {isCurrentLoading && filteredEntries.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: ui.textSecondary }}>
                                                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                                                    <CircularProgress size={16} />
                                                    <Typography variant="caption">Loading directory entries...</Typography>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {filteredEntries.map((entry) => {
                                        const isDir = entry?.type === "dir" || entry?.isDirectory;
                                        const filePath = entry?.path || joinPath(currentPath, entry.name);
                                        const isDownloadingThis = downloadingPath === filePath;
                                        return (
                                            <TableRow
                                                key={filePath}
                                                hover
                                                draggable={!isDir}
                                                onDragStart={(e) => {
                                                    if (!isDir) {
                                                        e.dataTransfer.setData("text/sftp-path", filePath);
                                                    }
                                                }}
                                            >
                                                <TableCell>
                                                    <Stack
                                                        direction="row"
                                                        spacing={0.85}
                                                        alignItems="center"
                                                        onClick={() => handleOpenEntry(entry)}
                                                        sx={{ cursor: "pointer" }}
                                                    >
                                                        <EntryIcon entry={entry} ui={ui} />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                fontFamily: "monospace",
                                                                fontSize: "0.78rem",
                                                                fontWeight: isDir ? 700 : 500,
                                                                color: isDir ? ui.accentText : ui.textPrimary,
                                                            }}
                                                        >
                                                            {entry.name}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.74rem", color: ui.textSecondary }}>
                                                    {isDir ? "-" : formatBytes(entry.size)}
                                                </TableCell>
                                                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.74rem", color: ui.textSecondary }}>
                                                    {entry.permissions || entry.mode || "-"}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        {!isDir && (
                                                            <Tooltip title={isDownloadingThis ? "Downloading..." : "Download file"}>
                                                                <span>
                                                                    <IconButton
                                                                        size="small"
                                                                        disabled={Boolean(downloadingPath)}
                                                                        onClick={() => void handleDownloadEntry(entry)}
                                                                        sx={{ color: ui.textSecondary }}
                                                                    >
                                                                        {isDownloadingThis ? (
                                                                            <CircularProgress size={14} color="inherit" />
                                                                        ) : (
                                                                            <DownloadIcon sx={{ fontSize: 15 }} />
                                                                        )}
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip title="Delete">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    disabled={deletingEntry}
                                                                    onClick={() => setDeleteTarget(entry)}
                                                                    sx={{ color: "#DE350B" }}
                                                                >
                                                                    <DeleteIcon sx={{ fontSize: 15 }} />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {!isCurrentLoading && filteredEntries.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: ui.textSecondary }}>
                                                {currentError ? "Unable to read directory." : "Directory is empty."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Stack>
                </Paper>
            </Box>

            {/* Transfer Activity Log */}
            <Paper elevation={0} sx={{ ...cardSx, p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Recent SFTP Transfers ({jobs.length})
                    </Typography>
                    {jobs.length > 0 && (
                        <Button size="small" onClick={() => setJobs([])} sx={{ textTransform: "none", color: ui.textSecondary }}>
                            Clear log
                        </Button>
                    )}
                </Stack>
                {jobs.length === 0 ? (
                    <Typography variant="caption" sx={{ color: ui.textSecondary }}>
                        No file transfers run in this session yet.
                    </Typography>
                ) : (
                    <Stack spacing={0.6} sx={{ maxHeight: 180, overflowY: "auto" }}>
                        {jobs.map((j) => (
                            <Stack
                                key={j.id}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                spacing={1}
                                sx={{
                                    px: 1,
                                    py: 0.6,
                                    borderRadius: "4px",
                                    bgcolor: ui.elevatedBg,
                                    border: `1px solid ${ui.border}`,
                                    fontSize: "0.75rem",
                                    fontFamily: "monospace",
                                }}
                            >
                                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                                    {j.status === "SUCCESS" ? (
                                        <CheckCircleIcon sx={{ fontSize: 15, color: "#36B37E", flexShrink: 0 }} />
                                    ) : (
                                        <ErrorIcon sx={{ fontSize: 15, color: "#FF5630", flexShrink: 0 }} />
                                    )}
                                    <Chip size="small" label={j.mode} sx={{ height: 20, fontSize: "0.68rem" }} />
                                    <Typography variant="caption" noWrap sx={{ fontFamily: "monospace" }}>
                                        {j.source} → {j.target}
                                    </Typography>
                                </Stack>
                                <Typography variant="caption" sx={{ color: ui.textSecondary, fontFamily: "monospace", flexShrink: 0 }}>
                                    {j.detail}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Paper>

            {/* Per-VM Destination Picker Popup */}
            <Dialog open={Boolean(vmDestModalId)} onClose={() => setVmDestModalId("")} maxWidth="xs" fullWidth PaperProps={jiraDialogPaper}>
                <DialogTitle sx={{ fontWeight: 600, borderBottom: `1px solid ${ui.border}` }}>
                    Destination for {vmDestModalId}
                </DialogTitle>
                <DialogContent sx={{ pt: 2.5 }}>
                    <Stack spacing={1.5}>
                        <TextField
                            autoFocus
                            fullWidth
                            size="small"
                            label="Destination Path on VM"
                            value={vmDestModalPath}
                            onChange={(e) => setVmDestModalPath(e.target.value)}
                            sx={inputSx}
                        />
                        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                            {QUICK_PATHS.map((qp) => (
                                <Chip
                                    key={qp}
                                    size="small"
                                    clickable
                                    label={qp}
                                    onClick={() => setVmDestModalPath(qp)}
                                    sx={{ bgcolor: ui.chipBg, color: ui.textPrimary, fontFamily: "monospace", fontSize: "0.7rem" }}
                                />
                            ))}
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ bgcolor: ui.elevatedBg, borderTop: `1px solid ${ui.border}` }}>
                    <Button onClick={() => setVmDestModalId("")} sx={{ textTransform: "none", color: ui.textSecondary }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        startIcon={<CheckCircleIcon fontSize="small" />}
                        onClick={saveVmDestinationAndMarkDone}
                        sx={btnPrimarySx}
                    >
                        Save & Mark Done
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Folder Dialog */}
            <Dialog open={mkdirOpen} onClose={() => !creatingFolder && setMkdirOpen(false)} maxWidth="xs" fullWidth PaperProps={jiraDialogPaper}>
                <DialogTitle sx={{ fontWeight: 600, borderBottom: `1px solid ${ui.border}` }}>
                    Create Folder on {activeVmId}
                </DialogTitle>
                <DialogContent sx={{ pt: 2.5 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        disabled={creatingFolder}
                        label="Folder Name"
                        placeholder="e.g. releases"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        sx={inputSx}
                    />
                </DialogContent>
                <DialogActions sx={{ bgcolor: ui.elevatedBg, borderTop: `1px solid ${ui.border}` }}>
                    <Button disabled={creatingFolder} onClick={() => setMkdirOpen(false)} sx={{ textTransform: "none", color: ui.textSecondary }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={!newFolderName.trim() || creatingFolder}
                        startIcon={creatingFolder ? <CircularProgress size={14} color="inherit" /> : null}
                        onClick={() => void handleCreateFolder()}
                        sx={btnPrimarySx}
                    >
                        {creatingFolder ? "Creating..." : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => !deletingEntry && setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={jiraDialogPaper}>
                <DialogTitle sx={{ fontWeight: 600, borderBottom: `1px solid ${ui.border}`, color: "#FF5630" }}>
                    Delete Remote Item
                </DialogTitle>
                <DialogContent sx={{ pt: 2.5 }}>
                    <Typography variant="body2">
                        Delete <strong>{deleteTarget?.name}</strong> from <strong>{activeVmId}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ bgcolor: ui.elevatedBg, borderTop: `1px solid ${ui.border}` }}>
                    <Button disabled={deletingEntry} onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none", color: ui.textSecondary }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={deletingEntry}
                        startIcon={deletingEntry ? <CircularProgress size={14} color="inherit" /> : null}
                        onClick={() => void handleConfirmDelete()}
                        sx={{ textTransform: "none", fontWeight: 600, bgcolor: "#DE350B", "&:hover": { bgcolor: "#BF2600" } }}
                    >
                        {deletingEntry ? "Deleting..." : "Delete"}
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