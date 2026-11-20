import { createTheme } from "@mui/material/styles";

export const getAppTheme = (mode) =>
    createTheme({
        palette: {
            mode,

            primary: {
                main: "#6366f1",
            },

            secondary: {
                main: "#8b5cf6",
            },

            background: {
                default: mode === "dark" ? "#0b0f19" : "#f5f6fa",

                paper: mode === "dark" ? "#151b2b" : "#ffffff",
            },

            divider: mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.08)",
        },

        shape: {
            borderRadius: 10,
        },

        typography: {
            fontFamily: [
                "Inter",
                "Roboto",
                "Arial",
                "sans-serif",
            ].join(","),

            button: {
                textTransform: "none",
                fontWeight: 600,
            },
        },

        components: {
            MuiCard: {
                styleOverrides: {
                    root: {
                        boxShadow: "none",
                        border: "1px solid",
                        borderColor: "divider",
                    },
                },
            },

            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
            },
        },
    });