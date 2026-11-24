import { useState, useMemo } from "react";
import {
    Modal,
    Box,
    Button,
    TextField,
    Typography,
    Stack,
    IconButton,
    InputAdornment,
    CircularProgress,
    Divider,
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import BusinessIcon from "@mui/icons-material/Business";

import { createOrganization } from "../organizationsApi";
import useNotification from "../../../hooks/useNotification";
import { useAppSelector } from "../../../hooks/redux";

const getJiraModalTokens = (isDark) => ({
    modalBg: isDark ? "#22272B" : "#FFFFFF",
    footerBg: isDark ? "#1D2125" : "#FAFBFC",
    inputBg: isDark ? "#161A1D" : "#FFFFFF",
    border: isDark ? "#38414A" : "#DFE1E6",
    textPrimary: isDark ? "#B6C2CF" : "#172B4D",
    textSecondary: isDark ? "#8C9BAB" : "#44546F",
    textSubtle: isDark ? "#738496" : "#626F86",
    brandMain: isDark ? "#579DFF" : "#1868DB",
    brandHover: isDark ? "#85B8FF" : "#0055CC",
    brandBg: isDark ? "#1C2B41" : "#E9F2FF",
    hoverSurface: isDark ? "#282E33" : "#F1F2F4",
    modalShadow: isDark
        ? "0 18px 36px -8px rgba(3, 4, 4, 0.75), 0 0 1px rgba(255, 255, 255, 0.16)"
        : "0 18px 36px -8px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)",
});

const NewOrganizationModal = ({ open, handleClose, onCreated }) => {
    const theme = useTheme();
    const mode = useAppSelector((state) => state.ui?.theme);
    const isDark = (mode || theme.palette.mode) === "dark";
    const tokens = useMemo(() => getJiraModalTokens(isDark), [isDark]);

    const [organizationName, setOrganizationName] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [viewPass, setViewPass] = useState(false);
    const [loading, setLoading] = useState(false);

    const notify = useNotification();

    const resetForm = () => {
        setOrganizationName("");
        setApiKey("");
        setViewPass(false);
    };

    const handleCancel = () => {
        if (loading) return;
        resetForm();
        handleClose();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!organizationName.trim() || !apiKey.trim()) {
            notify.warning("Please enter organization name and API key.");
            return;
        }

        const data = {
            organizationName: organizationName.trim(),
            apiKey: apiKey.trim(),
        };

        try {
            setLoading(true);
            await createOrganization(data);
            notify.success("Organization created successfully!");
            resetForm();
            handleClose();
            onCreated?.();
        } catch (error) {
            console.error("Organization creation failed:", error);
            notify.error(
                error.response?.data?.message ||
                    error.response?.data?.detail ||
                    "Failed to create organization."
            );
        } finally {
            setLoading(false);
        }
    };

    const fieldSx = {
        "& .MuiInputLabel-root": {
            color: tokens.textSecondary,
            fontSize: "0.85rem",
            "&.Mui-focused": {
                color: tokens.brandMain,
            },
        },
        "& .MuiOutlinedInput-root": {
            borderRadius: "3px",
            bgcolor: tokens.inputBg,
            color: tokens.textPrimary,
            fontSize: "0.875rem",
            "& fieldset": {
                borderColor: tokens.border,
            },
            "&:hover fieldset": {
                borderColor: tokens.brandMain,
            },
            "&.Mui-focused fieldset": {
                borderColor: tokens.brandMain,
                borderWidth: "1.5px",
            },
        },
        "& .MuiFormHelperText-root": {
            color: tokens.textSubtle,
            fontSize: "0.75rem",
            mx: 0,
        },
    };

    return (
        <Modal
            open={open}
            onClose={handleCancel}
            aria-labelledby="new-organization-title"
        >
            <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 440,
                    maxWidth: "92%",
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
                {/* Modal Header */}
                <Box
                    sx={{
                        px: 2.5,
                        py: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1.25}>
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "4px",
                                bgcolor: tokens.brandBg,
                                color: tokens.brandMain,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <BusinessIcon fontSize="small" />
                        </Box>
                        <Box>
                            <Typography
                                id="new-organization-title"
                                variant="subtitle1"
                                sx={{
                                    fontWeight: 700,
                                    color: tokens.textPrimary,
                                    lineHeight: 1.25,
                                }}
                            >
                                Create organization
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: tokens.textSecondary }}
                            >
                                Configure workspace name and credentials
                            </Typography>
                        </Box>
                    </Stack>

                    <IconButton
                        size="small"
                        onClick={handleCancel}
                        disabled={loading}
                        sx={{
                            borderRadius: "3px",
                            color: tokens.textSecondary,
                            "&:hover": {
                                bgcolor: tokens.hoverSurface,
                                color: tokens.textPrimary,
                            },
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Divider sx={{ borderColor: tokens.border }} />

                {/* Form Fields */}
                <Stack spacing={2} sx={{ px: 2.5, py: 2.25 }}>
                    <TextField
                        label="Organization Name"
                        placeholder="e.g. example@email.com"
                        helperText="Visible across your organization switcher and cards."
                        fullWidth
                        autoFocus
                        required
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        disabled={loading}
                        sx={fieldSx}
                    />

                    <TextField
                        label="API Key"
                        placeholder="Enter organization API key"
                        helperText="Used to authenticate workspace API requests."
                        type={viewPass ? "text" : "password"}
                        fullWidth
                        required
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        disabled={loading}
                        sx={{
                            ...fieldSx,
                            "& .MuiOutlinedInput-input": {
                                fontFamily: viewPass
                                    ? "'JetBrains Mono', 'Fira Code', monospace"
                                    : "inherit",
                                fontSize: viewPass ? "0.82rem" : "0.875rem",
                            },
                        }}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setViewPass((prev) => !prev)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            edge="end"
                                            aria-label="toggle API key visibility"
                                            disabled={loading}
                                            sx={{
                                                borderRadius: "3px",
                                                color: tokens.textSecondary,
                                                "&:hover": {
                                                    bgcolor: tokens.hoverSurface,
                                                    color: tokens.textPrimary,
                                                },
                                            }}
                                        >
                                            {viewPass ? (
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
                </Stack>

                <Divider sx={{ borderColor: tokens.border }} />

                {/* Footer Actions */}
                <Stack
                    direction="row"
                    justifyContent="flex-end"
                    spacing={1.25}
                    sx={{
                        px: 2.5,
                        py: 1.5,
                        bgcolor: tokens.footerBg,
                    }}
                >
                    <Button
                        type="button"
                        variant="outlined"
                        onClick={handleCancel}
                        disabled={loading}
                        sx={{
                            borderRadius: "3px",
                            borderColor: tokens.border,
                            color: tokens.textPrimary,
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            height: 34,
                            px: 2,
                            "&:hover": {
                                bgcolor: tokens.hoverSurface,
                                borderColor: tokens.border,
                            },
                        }}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        disableElevation
                        sx={{
                            borderRadius: "3px",
                            bgcolor: tokens.brandMain,
                            color: isDark ? "#1D2125" : "#FFFFFF",
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            height: 34,
                            px: 2,
                            minWidth: 88,
                            "&:hover": {
                                bgcolor: tokens.brandHover,
                            },
                        }}
                    >
                        {loading ? (
                            <CircularProgress size={18} color="inherit" />
                        ) : (
                            "Create"
                        )}
                    </Button>
                </Stack>
            </Box>
        </Modal>
    );
};

export default NewOrganizationModal;