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
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import KeyIcon from "@mui/icons-material/Key";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

const EMPTY_DRAFT = {
    host: "",
    port: 2222,
    username: "",
    secretKey: "",
    hasSecretKey: false,
};

export default function SshConfigCard({
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
    const [showSecret, setShowSecret] = useState(false);

    const handleOpen = () => {
        const source = config || defaultDraft || EMPTY_DRAFT;
        setDraft({
            ...EMPTY_DRAFT,
            ...source,
            secretKey: "",
        });
        setShowSecret(false);
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

    const sshCommand = useMemo(() => {
        if (!config) return "";
        if (config.command) return config.command;
        return `ssh -p ${config.port || 2222} ${config.username}@${config.host}`;
    }, [config]);

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
                    sx={{ px: 2, py: 1.25, bgcolor: tokens.subtleSurface }}
                >
                    <Stack direction="row" spacing={1} alignItems="center">
                        <KeyIcon fontSize="small" sx={{ color: tokens.brandMain }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.textPrimary }}>
                            InstaBox SSH
                        </Typography>
                    </Stack>

                    <Stack direction="row" spacing={0.75}>
                        {isConfigured ? (
                            <>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<ContentCopyIcon fontSize="small" />}
                                    onClick={() => void onCopy(sshCommand, "SSH command")}
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
                        spacing={1}
                        sx={{ p: 3.5, flex: 1, textAlign: "center" }}
                    >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.textPrimary }}>
                            No SSH configuration found
                        </Typography>
                        <Typography variant="caption" sx={{ color: tokens.textSecondary, maxWidth: 320 }}>
                            Add host, port, username, and secret key for this machine.
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={handleOpen}
                            sx={{ ...outlineBtnSx, mt: 0.5 }}
                        >
                            Add SSH Config
                        </Button>
                    </Stack>
                ) : (
                    <Box sx={{ p: 2 }}>
                        <Grid container spacing={1.5}>
                            {[
                                ["HOST", config.host],
                                ["PORT", String(config.port || 2222)],
                                ["USERNAME", config.username],
                                ["SECRET KEY", config.hasSecretKey ? "Stored (hidden)" : "Not set"],
                            ].map(([label, val]) => (
                                <Grid key={label} size={{ xs: 12, sm: 6 }}>
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
                                            sx={{ color: tokens.textSubtle, fontWeight: 700, display: "block" }}
                                        >
                                            {label}
                                        </Typography>
                                        <Typography
                                            noWrap
                                            title={val}
                                            sx={{
                                                fontFamily: "monospace",
                                                fontSize: "0.78rem",
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
                                mt: 1.5,
                                mb: 0,
                                p: 1.25,
                                borderRadius: "3px",
                                bgcolor: tokens.subtleSurface,
                                border: `1px solid ${tokens.border}`,
                                color: tokens.textPrimary,
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                                overflowX: "auto",
                            }}
                        >
                            {sshCommand}
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
                            position: "relative",
                            zIndex: 1,
                        }}
                    >
                        {isConfigured ? "Edit InstaBox SSH Config" : "Add InstaBox SSH Config"}
                    </DialogTitle>

                    <DialogContent dividers sx={{ pt: 3, pb: 2.5, borderColor: tokens.border }}>
                        <Stack spacing={2} sx={{ pt: 0.5 }}>
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

                            <TextField
                                size="small"
                                fullWidth
                                multiline={showSecret}
                                minRows={showSecret ? 3 : 1}
                                type={showSecret ? "text" : "password"}
                                label="Secret Key"
                                placeholder={
                                    draft.hasSecretKey
                                        ? "Stored on server — leave blank to keep unchanged"
                                        : "Enter secret key"
                                }
                                value={draft.secretKey || ""}
                                onChange={(e) => setDraft((p) => ({ ...p, secretKey: e.target.value }))}
                                sx={inputSx}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={() => setShowSecret((v) => !v)}
                                                sx={{ color: tokens.textSecondary }}
                                            >
                                                {showSecret ? (
                                                    <VisibilityOffIcon fontSize="small" />
                                                ) : (
                                                    <VisibilityIcon fontSize="small" />
                                                )}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
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