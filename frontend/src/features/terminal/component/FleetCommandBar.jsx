import { memo, useCallback, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import ContentPasteGoIcon from "@mui/icons-material/ContentPasteGo";
import KeyboardCommandKeyIcon from "@mui/icons-material/KeyboardCommandKey";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import HistoryIcon from "@mui/icons-material/History";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";

const KEY_COMBINATIONS = [
    { label: "Ctrl + C (Interrupt)", seq: "\x03", hint: "^C" },
    { label: "Ctrl + D (EOF / Logout)", seq: "\x04", hint: "^D" },
    { label: "Ctrl + Z (Suspend)", seq: "\x1a", hint: "^Z" },
    { label: "Ctrl + L (Clear Screen)", seq: "\x0c", hint: "^L" },
    { label: "Ctrl + A (Line Start)", seq: "\x01", hint: "^A" },
    { label: "Ctrl + E (Line End)", seq: "\x05", hint: "^E" },
    { label: "Ctrl + R (History Search)", seq: "\x12", hint: "^R" },
    { label: "Escape (Esc)", seq: "\x1b", hint: "ESC" },
    { label: "Tab (Autocomplete)", seq: "\t", hint: "TAB" },
    { label: "Enter (CR)", seq: "\r", hint: "RET" },
];

const LIVE_KEYS = {
    Enter: "\r",
    Backspace: "\x7f",
    Tab: "\t",
    Escape: "\x1b",
    ArrowUp: "\x1b[A",
    ArrowDown: "\x1b[B",
    ArrowRight: "\x1b[C",
    ArrowLeft: "\x1b[D",
    Home: "\x1b[H",
    End: "\x1b[F",
    Delete: "\x1b[3~",
    PageUp: "\x1b[5~",
    PageDown: "\x1b[6~",
};

const toTerminalNewlines = (text) => String(text).replace(/\r\n/g, "\r").replace(/\n/g, "\r");

const FleetCommandBar = memo(function FleetCommandBar({
    ui,
    isDark,
    selectedCount,
    shortcutLimit = 5,
    liveSync,
    onToggleLive,
    history,
    shortcuts,
    onRun,
    onSendRaw,
    onSaveSnippet,
    onOpenHistory,
    onOpenShortcuts,
    notify,
}) {
    const [text, setText] = useState("");
    const [multilineOpen, setMultilineOpen] = useState(false);
    const [multilineText, setMultilineText] = useState("");
    const [keysAnchor, setKeysAnchor] = useState(null);
    const [customCtrl, setCustomCtrl] = useState("");
    const [pasteOpen, setPasteOpen] = useState(false);
    const [manualPaste, setManualPaste] = useState("");

    const histIdxRef = useRef(-1);
    const draftRef = useRef("");

    const inlineShortcuts = shortcuts.slice(0, Math.max(1, shortcutLimit));
    const extra = Math.max(0, shortcuts.length - inlineShortcuts.length);

    const reportRaw = useCallback(
        (result, okMsg) => {
            if (result.total === 0) {
                notify("warning", "No VMs selected. Select at least one terminal.");
            } else if (result.ready === 0) {
                notify("warning", "Selected terminals are not connected.");
            } else {
                const skipped = result.total - result.ready;
                notify(
                    "success",
                    `${okMsg} ${result.ready} terminal(s)${skipped > 0 ? ` (${skipped} offline skipped)` : ""}.`
                );
            }
        },
        [notify]
    );

    const submit = (e) => {
        e.preventDefault();
        if (liveSync) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        const outcome = onRun(trimmed);
        if (outcome !== "failed") {
            setText("");
            histIdxRef.current = -1;
        }
    };

    const handleKeyDown = (e) => {
        if (liveSync) {
            if (e.nativeEvent.isComposing) return;
            const ctrlOnly = e.ctrlKey && !e.altKey && !e.metaKey;
            if (ctrlOnly && /^[a-z]$/i.test(e.key)) {
                if (e.key.toLowerCase() === "v") return;
                e.preventDefault();
                onSendRaw(String.fromCharCode(e.key.toUpperCase().charCodeAt(0) - 64));
                return;
            }
            if (LIVE_KEYS[e.key]) {
                e.preventDefault();
                onSendRaw(LIVE_KEYS[e.key]);
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                onSendRaw(e.key);
            }
            return;
        }

        if (e.key === "ArrowUp" && history.length > 0) {
            e.preventDefault();
            if (histIdxRef.current === -1) draftRef.current = text;
            const next = Math.min(histIdxRef.current + 1, history.length - 1);
            histIdxRef.current = next;
            setText(history[next].cmd);
        } else if (e.key === "ArrowDown" && histIdxRef.current > -1) {
            e.preventDefault();
            const next = histIdxRef.current - 1;
            histIdxRef.current = next;
            setText(next === -1 ? draftRef.current : history[next].cmd);
        }
    };

    const handlePasteEvent = (e) => {
        if (!liveSync) return;
        e.preventDefault();
        const pasted = e.clipboardData?.getData("text");
        if (pasted) onSendRaw(toTerminalNewlines(pasted));
    };

    const handleChange = (e) => {
        if (liveSync) return;
        histIdxRef.current = -1;
        setText(e.target.value);
    };

    const handlePasteButton = async () => {
        try {
            if (navigator.clipboard?.readText) {
                const clip = await navigator.clipboard.readText();
                if (!clip) {
                    notify("warning", "Clipboard is empty.");
                    return;
                }
                reportRaw(onSendRaw(toTerminalNewlines(clip)), "Pasted to");
                return;
            }
        } catch {
            // fallback modal
        }
        setManualPaste("");
        setPasteOpen(true);
    };

    const handleManualPaste = () => {
        if (manualPaste) reportRaw(onSendRaw(toTerminalNewlines(manualPaste)), "Pasted to");
        setManualPaste("");
        setPasteOpen(false);
    };

    const sendKeyCombo = (seq, label) => {
        reportRaw(onSendRaw(seq), `Sent ${label} to`);
        setKeysAnchor(null);
    };

    const sendCustomCtrl = () => {
        const ch = customCtrl.trim().toUpperCase();
        if (!/^[A-Z]$/.test(ch)) {
            notify("warning", "Enter a single letter A-Z for Ctrl+<letter>.");
            return;
        }
        sendKeyCombo(String.fromCharCode(ch.charCodeAt(0) - 64), `Ctrl+${ch}`);
        setCustomCtrl("");
    };

    const runMultiline = () => {
        const trimmed = multilineText.trim();
        if (!trimmed) return;
        const outcome = onRun(trimmed);
        if (outcome !== "failed") {
            setMultilineOpen(false);
            setMultilineText("");
            setText("");
        }
    };

    const stableBtnSx = {
        textTransform: "none",
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
        borderColor: ui.borderStrong,
        color: ui.textPrimary,
        borderRadius: "4px",
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

    return (
        <>
            <Paper
                elevation={0}
                sx={{
                    p: 1.25,
                    bgcolor: ui.surfaceBg,
                    border: `1px solid ${ui.border}`,
                    borderRadius: "6px",
                }}
            >
                <Stack spacing={1}>
                    {/* Single-Row Command Input + All Action Buttons */}
                    <Box component="form" onSubmit={submit}>
                        <Stack
                            direction="row"
                            spacing={0.85}
                            alignItems="center"
                            sx={{ width: "100%", overflowX: "auto", pb: 0.2 }}
                        >
                            <TextField
                                size="small"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={
                                    liveSync
                                        ? `LIVE SYNC ON: typing streams once to ${selectedCount} VM(s)...`
                                        : "Command on selected VMs (Up/Down = history)..."
                                }
                                value={liveSync ? "" : text}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePasteEvent}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Tooltip title="Open multiline command editor">
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        edge="end"
                                                        disabled={liveSync}
                                                        onClick={() => {
                                                            setMultilineText(text);
                                                            setMultilineOpen(true);
                                                        }}
                                                        sx={{ color: ui.textSecondary }}
                                                    >
                                                        <OpenInFullIcon sx={{ fontSize: 15 }} />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    flex: "1 1 280px",
                                    minWidth: 220,
                                    "& .MuiOutlinedInput-root": {
                                        bgcolor: ui.inputBg,
                                        color: ui.textPrimary,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: "0.8rem",
                                        borderRadius: "4px",
                                        "& fieldset": {
                                            borderColor: liveSync ? ui.accentText : ui.borderStrong,
                                        },
                                    },
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                size="small"
                                disableElevation
                                disabled={liveSync}
                                startIcon={<SendIcon fontSize="small" />}
                                sx={{
                                    textTransform: "none",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    borderRadius: "4px",
                                    bgcolor: ui.accent,
                                    px: 1.5,
                                    "&:hover": { bgcolor: ui.accentHover },
                                }}
                            >
                                Run ({selectedCount})
                            </Button>

                            <Tooltip title="Paste clipboard into selected terminals">
                                <Button
                                    type="button"
                                    variant="outlined"
                                    size="small"
                                    startIcon={<ContentPasteGoIcon fontSize="small" />}
                                    onClick={handlePasteButton}
                                    sx={stableBtnSx}
                                >
                                    Paste
                                </Button>
                            </Tooltip>

                            <Tooltip title="Send Ctrl+C interrupt to selected terminals">
                                <Button
                                    type="button"
                                    variant="outlined"
                                    size="small"
                                    startIcon={<StopCircleOutlinedIcon fontSize="small" />}
                                    onClick={() => sendKeyCombo("\x03", "Ctrl+C")}
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                        flexShrink: 0,
                                        borderRadius: "4px",
                                        borderColor: "#FF5630",
                                        color: "#FF5630",
                                        bgcolor: "rgba(255, 86, 48, 0.1)",
                                    }}
                                >
                                    Ctrl+C
                                </Button>
                            </Tooltip>

                            <Button
                                type="button"
                                variant="outlined"
                                size="small"
                                startIcon={<KeyboardCommandKeyIcon fontSize="small" />}
                                endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                                onClick={(e) => setKeysAnchor(e.currentTarget)}
                                sx={stableBtnSx}
                            >
                                Keys
                            </Button>

                            <Tooltip title="Stream every keystroke live to selected terminals">
                                <Button
                                    type="button"
                                    size="small"
                                    variant={liveSync ? "contained" : "outlined"}
                                    disableElevation
                                    startIcon={<SyncAltIcon fontSize="small" />}
                                    onClick={onToggleLive}
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                        flexShrink: 0,
                                        borderRadius: "4px",
                                        borderColor: liveSync ? ui.accent : ui.borderStrong,
                                        color: liveSync ? "#FFFFFF" : ui.textPrimary,
                                        bgcolor: liveSync ? ui.accent : "transparent",
                                        "&:hover": liveSync ? { bgcolor: ui.accentHover } : undefined,
                                    }}
                                >
                                    {liveSync ? "Live Sync: ON" : "Live Sync"}
                                </Button>
                            </Tooltip>

                            <Tooltip title="Command history">
                                <IconButton
                                    size="small"
                                    onClick={onOpenHistory}
                                    sx={{
                                        flexShrink: 0,
                                        border: `1px solid ${ui.borderStrong}`,
                                        borderRadius: "4px",
                                        color: ui.textSecondary,
                                        p: 0.6,
                                    }}
                                >
                                    <HistoryIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Save this command as a shortcut">
                                <span style={{ flexShrink: 0 }}>
                                    <IconButton
                                        size="small"
                                        disabled={liveSync}
                                        onClick={() => onSaveSnippet(text.trim())}
                                        sx={{
                                            border: `1px solid ${ui.borderStrong}`,
                                            borderRadius: "4px",
                                            color: ui.textSecondary,
                                            p: 0.6,
                                        }}
                                    >
                                        <BookmarkAddIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Box>

                    {/* Shortcuts Strip */}
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="caption" sx={{ color: ui.textSecondary, fontWeight: 600 }}>
                            Shortcuts:
                        </Typography>
                        {inlineShortcuts.map((item) => (
                            <Chip
                                key={item.id}
                                size="small"
                                clickable
                                label={item.label}
                                onClick={() => onRun(item.cmd)}
                                sx={{
                                    bgcolor: ui.chipBg,
                                    color: ui.textPrimary,
                                    fontSize: "0.72rem",
                                    fontWeight: 500,
                                    "&:hover": { bgcolor: ui.chipHover },
                                }}
                            />
                        ))}
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<MoreHorizIcon fontSize="small" />}
                            onClick={onOpenShortcuts}
                            sx={{
                                textTransform: "none",
                                fontSize: "0.72rem",
                                py: 0.2,
                                px: 1,
                                minHeight: 24,
                                whiteSpace: "nowrap",
                                borderRadius: "4px",
                                borderColor: ui.borderStrong,
                                color: ui.accentText,
                            }}
                        >
                            More{extra > 0 ? ` (+${extra})` : ""}
                        </Button>
                    </Stack>
                </Stack>
            </Paper>

            <Menu
                anchorEl={keysAnchor}
                open={Boolean(keysAnchor)}
                onClose={() => setKeysAnchor(null)}
                PaperProps={{ sx: { ...jiraDialogPaper.sx, minWidth: 250 } }}
            >
                {KEY_COMBINATIONS.map((k) => (
                    <MenuItem
                        key={k.label}
                        onClick={() => sendKeyCombo(k.seq, k.label)}
                        sx={{ display: "flex", justifyContent: "space-between", gap: 2, fontSize: "0.8rem" }}
                    >
                        <span>{k.label}</span>
                        <Box
                            component="span"
                            sx={{
                                fontFamily: "monospace",
                                fontSize: "0.72rem",
                                px: 0.6,
                                py: 0.1,
                                borderRadius: "3px",
                                bgcolor: ui.chipBg,
                                color: ui.accentText,
                            }}
                        >
                            {k.hint}
                        </Box>
                    </MenuItem>
                ))}
                <Divider sx={{ borderColor: ui.border, my: 0.5 }} />
                <Box sx={{ px: 1.5, py: 1 }} onKeyDown={(e) => e.stopPropagation()}>
                    <Typography
                        variant="caption"
                        sx={{ color: ui.textSecondary, display: "block", mb: 0.5, fontWeight: 600 }}
                    >
                        Custom Ctrl + Letter (A-Z)
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                        <TextField
                            size="small"
                            placeholder="A-Z"
                            inputProps={{
                                maxLength: 1,
                                style: {
                                    textTransform: "uppercase",
                                    fontFamily: "monospace",
                                    width: 44,
                                    textAlign: "center",
                                    padding: "4px 6px",
                                },
                            }}
                            value={customCtrl}
                            onChange={(e) => setCustomCtrl(e.target.value)}
                            sx={{ "& .MuiOutlinedInput-root": { bgcolor: ui.inputBg, color: ui.textPrimary, borderRadius: "4px" } }}
                        />
                        <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            onClick={sendCustomCtrl}
                            sx={{ textTransform: "none", fontWeight: 600, bgcolor: ui.accent, "&:hover": { bgcolor: ui.accentHover }, fontSize: "0.75rem" }}
                        >
                            Send
                        </Button>
                    </Stack>
                </Box>
            </Menu>

            <Dialog
                open={multilineOpen}
                onClose={() => setMultilineOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={jiraTitleSx}>
                    Multiline Command Runner ({selectedCount} selected VMs)
                </DialogTitle>
                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    <Typography
                        component="label"
                        sx={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: ui.textSecondary, mb: 0.6 }}
                    >
                        Commands (one per line)
                    </Typography>
                    <TextField
                        autoFocus
                        multiline
                        minRows={7}
                        maxRows={16}
                        fullWidth
                        spellCheck={false}
                        placeholder={"cd /app\ngit status\ndocker compose ps"}
                        value={multilineText}
                        onChange={(e) => setMultilineText(e.target.value)}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                bgcolor: ui.inputBg,
                                color: ui.textPrimary,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: "0.82rem",
                                borderRadius: "4px",
                                "& fieldset": { borderColor: ui.borderStrong },
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button
                        onClick={() => setMultilineOpen(false)}
                        sx={{ textTransform: "none", color: ui.textSecondary }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        startIcon={<SendIcon fontSize="small" />}
                        onClick={runMultiline}
                        disabled={!multilineText.trim()}
                        sx={{ textTransform: "none", fontWeight: 600, bgcolor: ui.accent, "&:hover": { bgcolor: ui.accentHover } }}
                    >
                        Run on selected
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={pasteOpen}
                onClose={() => setPasteOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={jiraDialogPaper}
            >
                <DialogTitle sx={jiraTitleSx}>Paste Text to Selected VMs</DialogTitle>
                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    <Typography
                        component="label"
                        sx={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: ui.textSecondary, mb: 0.6 }}
                    >
                        Clipboard Fallback Content
                    </Typography>
                    <TextField
                        autoFocus
                        multiline
                        rows={4}
                        fullWidth
                        placeholder="Browser blocked clipboard access. Paste here, then send."
                        value={manualPaste}
                        onChange={(e) => setManualPaste(e.target.value)}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                bgcolor: ui.inputBg,
                                color: ui.textPrimary,
                                fontFamily: "monospace",
                                fontSize: "0.8rem",
                                borderRadius: "4px",
                                "& fieldset": { borderColor: ui.borderStrong },
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions sx={jiraFooterSx}>
                    <Button
                        onClick={() => setPasteOpen(false)}
                        sx={{ textTransform: "none", color: ui.textSecondary }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={handleManualPaste}
                        sx={{ textTransform: "none", fontWeight: 600, bgcolor: ui.accent, "&:hover": { bgcolor: ui.accentHover } }}
                    >
                        Send to selected ({selectedCount})
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
});

export default FleetCommandBar;