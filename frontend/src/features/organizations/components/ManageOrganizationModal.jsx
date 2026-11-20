import { useState, useEffect, useMemo } from "react";
import {
    Modal,
    Box,
    Button,
    TextField,
    Typography,
    Stack,
    IconButton,
    Divider,
    CircularProgress,
    InputAdornment,
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SyncIcon from "@mui/icons-material/Sync";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import DnsIcon from "@mui/icons-material/Dns";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import {
    updateOrganization,
    deleteOrganization,
    syncOrganizationMachines,
} from "../organizationsApi";
import useNotification from "../../../hooks/useNotification";
import { useAppSelector } from "../../../hooks/redux";

const getTokens = (isDark) => ({
    modalBg: isDark ? "#22272B" : "#FFFFFF",
    footerBg: isDark ? "#1D2125" : "#FAFBFC",
    subtleSurface: isDark ? "#161A1D" : "#F7F8F9",
    hoverSurface: isDark ? "#282E33" : "#F1F2F4",
    border: isDark ? "#38414A" : "#DFE1E6",
    textPrimary: isDark ? "#B6C2CF" : "#172B4D",
    textSecondary: isDark ? "#8C9BAB" : "#44546F",
    textSubtle: isDark ? "#738496" : "#626F86",
    brandMain: isDark ? "#579DFF" : "#1868DB",
    brandHover: isDark ? "#85B8FF" : "#0055CC",
    brandBg: isDark ? "#1C2B41" : "#E9F2FF",
    redMain: isDark ? "#F87168" : "#C9372C",
    redBg: isDark ? "#3B1C1A" : "#FFECEB",
    modalShadow: isDark
        ? "0 18px 36px -8px rgba(3, 4, 4, 0.75), 0 0 1px rgba(255, 255, 255, 0.16)"
        : "0 18px 36px -8px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)",
});

export default function ManageOrganizationModal({
    organization,
    open,
    handleClose,
    onUpdated,
    onViewMachines,
}) {
    const theme = useTheme();
    const mode = useAppSelector((state) => state.ui?.theme);
    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(() => getTokens(isDark), [isDark]);

    const notify = useNotification();

    const [orgName, setOrgName] = useState("");
    const [syncApiKey, setSyncApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [confirmDeleteText, setConfirmDeleteText] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (organization) {
            setOrgName(organization.organizationName || "");
            setSyncApiKey("");
            setShowKey(false);
            setConfirmDeleteText("");
        }
    }, [organization, open]);

    const busy = savingName || syncing || deleting;

    const handleCloseSafe = () => {
        if (busy) return;
        handleClose?.();
    };

    const handleRename = async (e) => {
        e.preventDefault();
        if (!organization?.id || !orgName.trim()) {
            notify.warning("Organization name cannot be empty.");
            return;
        }
        try {
            setSavingName(true);
            await updateOrganization(organization.id, {
                organizationName: orgName.trim(),
            });
            notify.success("Organization renamed.");
            onUpdated?.();
        } catch (err) {
            notify.error(
                err.response?.data?.message || "Failed to update organization."
            );
        } finally {
            setSavingName(false);
        }
    };

    const handleSync = async (e) => {
        e.preventDefault();
        if (!organization?.id || !syncApiKey.trim()) {
            notify.warning("Enter an InstaBox API key to sync machines.");
            return;
        }
        try {
            setSyncing(true);
            const updated = await syncOrganizationMachines(
                organization.id,
                syncApiKey.trim()
            );
            notify.success(
                `Synced machines (${updated?.machineCount ?? 0} total in org).`
            );
            setSyncApiKey("");
            onUpdated?.();
        } catch (err) {
            notify.error(
                err.response?.data?.message || "Failed to sync machines."
            );
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async () => {
        if (!organization?.id) return;
        try {
            setDeleting(true);
            await deleteOrganization(organization.id);
            notify.success("Organization and its synced machines removed.");
            handleClose?.();
            onUpdated?.();
        } catch (err) {
            notify.error(
                err.response?.data?.message || "Failed to delete organization."
            );
        } finally {
            setDeleting(false);
        }
    };

    if (!organization) return null;

    const deleteMatches = confirmDeleteText.trim() === organization.organizationName;

    return (
        <Modal open={open} onClose={handleCloseSafe}>
            <Box
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 520,
                    maxWidth: "94%",
                    maxHeight: "88vh",
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: tokens.modalBg,
                    color: tokens.textPrimary,
                    borderRadius: "4px",
                    border: `1px solid ${tokens.border}`,
                    borderTop: `3px solid ${tokens.brandMain}`,
                    boxShadow: tokens.modalShadow,
                    outline: "none",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
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
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
                            Manage: {organization.organizationName}
                        </Typography>
                        <Typography
                            variant="caption"
                            noWrap
                            sx={{ fontFamily: "monospace", color: tokens.textSubtle }}
                        >
                            {organization.organizationId} • {organization.machineCount ?? 0}{" "}
                            machines
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={handleCloseSafe}
                        disabled={busy}
                        sx={{ borderRadius: "3px", color: tokens.textSecondary }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Body */}
                <Stack spacing={2.5} sx={{ p: 2.5, overflowY: "auto" }}>
                    {/* Quick Navigation to Org Machines */}
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: "3px",
                            bgcolor: tokens.subtleSurface,
                            border: `1px solid ${tokens.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1.5,
                        }}
                    >
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Organization Machines
                            </Typography>
                            <Typography variant="caption" sx={{ color: tokens.textSecondary }}>
                                {organization.machineCount ?? 0} synced instances linked to this org
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DnsIcon fontSize="small" />}
                            onClick={() => {
                                handleClose?.();
                                onViewMachines?.(organization);
                            }}
                            sx={{
                                borderRadius: "3px",
                                borderColor: tokens.border,
                                color: tokens.textPrimary,
                                textTransform: "none",
                                fontWeight: 600,
                            }}
                        >
                            Open machines
                        </Button>
                    </Box>

                    {/* Rename Form */}
                    <Box component="form" onSubmit={handleRename}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 700,
                                textTransform: "uppercase",
                                color: tokens.textSubtle,
                                display: "block",
                                mb: 1,
                            }}
                        >
                            Rename Organization
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                size="small"
                                fullWidth
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                disabled={busy}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "3px",
                                        color: tokens.textPrimary,
                                    },
                                }}
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                disableElevation
                                startIcon={
                                    savingName ? (
                                        <CircularProgress size={16} color="inherit" />
                                    ) : (
                                        <SaveIcon fontSize="small" />
                                    )
                                }
                                disabled={busy}
                                sx={{
                                    borderRadius: "3px",
                                    bgcolor: tokens.brandMain,
                                    color: isDark ? "#1D2125" : "#FFFFFF",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    px: 2,
                                    flexShrink: 0,
                                }}
                            >
                                Save
                            </Button>
                        </Stack>
                    </Box>

                    <Divider sx={{ borderColor: tokens.border }} />

                    {/* Sync Machines Form */}
                    <Box component="form" onSubmit={handleSync}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 700,
                                textTransform: "uppercase",
                                color: tokens.textSubtle,
                                display: "block",
                                mb: 0.5,
                            }}
                        >
                            Sync Machines from InstaBox
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ color: tokens.textSecondary, display: "block", mb: 1 }}
                        >
                            Requires an API key (`ibk_...`) with `machines:read` scope for this
                            workspace.
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Paste workspace API key (ibk_...)"
                                type={showKey ? "text" : "password"}
                                value={syncApiKey}
                                onChange={(e) => setSyncApiKey(e.target.value)}
                                disabled={busy}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "3px",
                                        color: tokens.textPrimary,
                                    },
                                }}
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setShowKey((p) => !p)}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    edge="end"
                                                >
                                                    {showKey ? (
                                                        <VisibilityOff fontSize="small" />
                                                    ) : (
                                                        <Visibility fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />
                            <Button
                                type="submit"
                                variant="outlined"
                                startIcon={
                                    syncing ? (
                                        <CircularProgress size={16} color="inherit" />
                                    ) : (
                                        <SyncIcon fontSize="small" />
                                    )
                                }
                                disabled={busy}
                                sx={{
                                    borderRadius: "3px",
                                    borderColor: tokens.border,
                                    color: tokens.textPrimary,
                                    textTransform: "none",
                                    fontWeight: 600,
                                    px: 2,
                                    flexShrink: 0,
                                }}
                            >
                                Sync now
                            </Button>
                        </Stack>
                    </Box>

                    <Divider sx={{ borderColor: tokens.border }} />

                    {/* Danger Zone: Delete Local Org & Synced Machines */}
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: "3px",
                            bgcolor: tokens.redBg,
                            border: `1px solid ${tokens.redMain}55`,
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700, color: tokens.redMain, mb: 0.5 }}
                        >
                            Delete Local Organization
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ color: tokens.textSecondary, display: "block", mb: 1.25 }}
                        >
                            Removes this organization and all synced machine rows in your
                            database. Type{" "}
                            <strong style={{ color: tokens.textPrimary }}>
                                {organization.organizationName}
                            </strong>{" "}
                            to confirm.
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder={organization.organizationName}
                                value={confirmDeleteText}
                                onChange={(e) => setConfirmDeleteText(e.target.value)}
                                disabled={busy}
                                sx={{
                                    bgcolor: tokens.modalBg,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "3px",
                                        color: tokens.textPrimary,
                                    },
                                }}
                            />
                            <Button
                                variant="contained"
                                color="error"
                                disableElevation
                                disabled={busy || !deleteMatches}
                                onClick={() => void handleDelete()}
                                startIcon={
                                    deleting ? (
                                        <CircularProgress size={16} color="inherit" />
                                    ) : (
                                        <DeleteIcon fontSize="small" />
                                    )
                                }
                                sx={{
                                    borderRadius: "3px",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    px: 2,
                                    flexShrink: 0,
                                }}
                            >
                                Delete
                            </Button>
                        </Stack>
                    </Box>
                </Stack>

                {/* Footer */}
                <Box
                    sx={{
                        px: 2.5,
                        py: 1.25,
                        bgcolor: tokens.footerBg,
                        borderTop: `1px solid ${tokens.border}`,
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    <Button
                        size="small"
                        onClick={handleCloseSafe}
                        disabled={busy}
                        sx={{
                            borderRadius: "3px",
                            color: tokens.textPrimary,
                            textTransform: "none",
                            fontWeight: 600,
                        }}
                    >
                        Close
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}