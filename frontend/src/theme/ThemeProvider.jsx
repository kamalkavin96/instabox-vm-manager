import { useMemo } from "react";

import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { useAppSelector } from "../hooks/redux";

import { getAppTheme } from "./theme";

export default function AppThemeProvider({ children }) {
    const mode = useAppSelector((state) => state.ui.theme);

    const theme = useMemo(
        () => getAppTheme(mode),
        [mode]
    );

    return (
        <MuiThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </MuiThemeProvider>
    );
}