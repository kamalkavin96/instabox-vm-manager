import { useMemo, useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

const EMPTY_DRAFT = {
    host: "",
    port: 2222,
    username: "",
};

const maskText = (val) => (val ? "***" : "-");

export default function SftpConfigCard({
    config,
    defaultDraft,
    onSave,
    onCopy,
    onNotify,
    saving = false,
    tokens,
    inputSx,
    outlineBtnSx,
    primaryBtnSx,
}) {
    const isConfigured = Boolean(config);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(config || defaultDraft || EMPTY_DRAFT);
    const [revealUsername, setRevealUsername] = useState(false);

    const handleOpen = () => {
        const source = config || defaultDraft || EMPTY_DRAFT;
        setDraft({
            ...EMPTY_DRAFT,
            ...source,
        });
        setOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const host = draft.host?.trim() || "";
        const username = draft.username?.trim() || "";
        const port = Number(draft.port) || 2222;

        if (!host || !username) {
            onNotify?.warning("Host and Username are required.");
            return;
        }
        if (port < 1 || port > 65535) {
            onNotify?.warning("Invalid port (1–65535).");
            return;
        }

        const ok = await onSave(
            {
                ...draft,
                host,
                port,
                username,
            },
            { isCreate: !isConfigured }
        );
        if (ok) {
            setOpen(false);
        }
    };

    const displayedUsername = revealUsername ? (config?.username || "-") : maskText(config?.username);
    const cmdUsername = revealUsername ? (config?.username || "***") : "***";

    const sftpCommand = useMemo(() => {
        if (!config) return "";
        const port = config.port || 2222;
        const host = config.host || "";
        return `sftp -P ${port} ${cmdUsername}@${host}`;
    }, [config, cmdUsername]);

    return (
        <>
            <Paper
                variant="outlined"
                sx={{
                    borderRadius: "4px",
                    bgcolor: tokens.cardBg,
                    borderColor: tokens.border,
                    overflow: "hidden",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                    flexWrap="wrap"
                    sx={{ px: 1.75, py: 1, bgcolor: tokens.subtleSurface }}
                >
                    <Stack direction="row" spacing={0.75} alignItems="center">
                        <FolderSharedIcon fontSize="small" sx={{ color: tokens.brandMain }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.textPrimary }}>
                            InstaBox SFTP
                        </Typography>
                    </Stack>
                    <Box sx={{ flexGrow: 1 }} />
                    <Stack direction="row" spacing={0.75} alignItems="center">
                        {isConfigured ? (
                            <>
                                <IconButton
                                    size="small"
                                    title={revealUsername ? "Hide username & command user" : "Show username & command user"}
                                    onClick={() => setRevealUsername((v) => !v)}
                                    sx={{
                                        border: `1px solid ${tokens.border}`,
                                        borderRadius: "3px",
                                        color: tokens.textSecondary,
                                    }}
                                >
                                    {revealUsername ? (
                                        <VisibilityOffIcon fontSize="small" />
                                    ) : (
                                        <VisibilityIcon fontSize="small" />
                                    )}
                                </IconButton>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<ContentCopyIcon fontSize="small" />}
                                    onClick={() => void onCopy(sftpCommand, "SFTP command")}
                                    sx={outlineBtnSx}
                                >
                                    Copy Cmd
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    disableElevation
                                    startIcon={<EditIcon fontSize="small" />}
                                    onClick={handleOpen}
                                    sx={primaryBtnSx}
                                >
                                    Edit
                                </Button>
                            </>
                        ) : (
                            <Button
                                size="small"
                                variant="contained"
                                disableElevation
                                startIcon={<AddIcon fontSize="small" />}
                                onClick={handleOpen}
                                sx={primaryBtnSx}
                            >
                                Add
                            </Button>
                        )}
                    </Stack>
                </Stack>

                <Divider sx={{ borderColor: tokens.border }} />

                {!isConfigured ? (
                    <Stack
                        alignItems="center"
                        justifyContent="center"
                        spacing={0.75}
                        sx={{ p: 2.25, flex: 1, textAlign: "center" }}
                    >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.textPrimary }}>
                            No SFTP configuration found
                        </Typography>
                        <Typography variant="caption" sx={{ color: tokens.textSecondary, maxWidth: 300 }}>
                            Add host, port, and username for this machine.
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={handleOpen}
                            sx={{ ...outlineBtnSx, mt: 0.25 }}
                        >
                            Add SFTP Config
                        </Button>
                    </Stack>
                ) : (
                    <Box sx={{ p: 1.5 }}>
                        <Grid container spacing={1}>
                            {[
                                ["HOST", config.host],
                                ["PORT", String(config.port || 2222)],
                                ["USERNAME", displayedUsername],
                            ].map(([label, val]) => (
                                <Grid key={label} size={{ xs: 12, sm: label === "HOST" ? 5 : label === "PORT" ? 3 : 4 }}>
                                    <Box
                                        sx={{
                                            px: 1,
                                            py: 0.75,
                                            borderRadius: "3px",
                                            bgcolor: tokens.subtleSurface,
                                            border: `1px solid ${tokens.border}`,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: tokens.textSubtle,
                                                fontWeight: 700,
                                                fontSize: "0.65rem",
                                                display: "block",
                                            }}
                                        >
                                            {label}
                                        </Typography>
                                        <Typography
                                            noWrap
                                            title={val}
                                            sx={{
                                                fontFamily: "monospace",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                color: tokens.textPrimary,
                                            }}
                                        >
                                            {val || "-"}
                                        </Typography>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>

                        <Box
                            component="pre"
                            sx={{
                                mt: 1,
                                mb: 0,
                                px: 1.25,
                                py: 0.85,
                                borderRadius: "3px",
                                bgcolor: tokens.subtleSurface,
                                border: `1px solid ${tokens.border}`,
                                color: tokens.textPrimary,
                                fontFamily: "monospace",
                                fontSize: "0.73rem",
                                overflowX: "auto",
                            }}
                        >
                            {sftpCommand}
                        </Box>
                    </Box>
                )}
            </Paper>

            <Dialog
                open={open}
                onClose={() => !saving && setOpen(false)}
                scroll="paper"
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: tokens.cardBg,
                        color: tokens.textPrimary,
                        border: `1px solid ${tokens.border}`,
                        borderRadius: "4px",
                    },
                }}
            >
                <Box component="form" onSubmit={handleSubmit}>
                    <DialogTitle
                        sx={{
                            fontWeight: 700,
                            borderBottom: `1px solid ${tokens.border}`,
                        }}
                    >
                        {isConfigured ? "Edit InstaBox SFTP Config" : "Add InstaBox SFTP Config"}
                    </DialogTitle>

                    <DialogContent dividers sx={{ pt: 2.5, pb: 2, borderColor: tokens.border }}>
                        <Stack spacing={1.75}>
                            <Grid container spacing={1.5}>
                                <Grid size={{ xs: 12, sm: 9 }}>
                                    <TextField
                                        size="small"
                                        fullWidth
                                        required
                                        label="Host"
                                        placeholder="ssh.instabox.sh"
                                        value={draft.host || ""}
                                        onChange={(e) => setDraft((p) => ({ ...p, host: e.target.value }))}
                                        sx={inputSx}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                    <TextField
                                        size="small"
                                        fullWidth
                                        required
                                        label="Port"
                                        value={draft.port ?? 2222}
                                        onChange={(e) => setDraft((p) => ({ ...p, port: e.target.value }))}
                                        sx={inputSx}
                                    />
                                </Grid>
                            </Grid>

                            <TextField
                                size="small"
                                fullWidth
                                required
                                label="Username"
                                placeholder="ibssh_..."
                                value={draft.username || ""}
                                onChange={(e) => setDraft((p) => ({ ...p, username: e.target.value }))}
                                sx={inputSx}
                            />
                        </Stack>
                    </DialogContent>

                    <DialogActions sx={{ px: 3, py: 1.5 }}>
                        <Button
                            type="button"
                            variant="outlined"
                            disabled={saving}
                            onClick={() => setOpen(false)}
                            sx={outlineBtnSx}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disableElevation
                            disabled={saving}
                            sx={primaryBtnSx}
                        >
                            {saving ? "Saving..." : isConfigured ? "Save Config" : "Add Config"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </>
    );
}