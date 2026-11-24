import { createSlice } from "@reduxjs/toolkit";

const savedTheme = localStorage.getItem("theme") || "dark";

const initialState = {
    sidebarOpen: true,
    theme: savedTheme,
};

const uiSlice = createSlice({
    name: "ui",

    initialState,

    reducers: {
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen;
        },

        setSidebarOpen: (state, action) => {
            state.sidebarOpen = action.payload;
        },

        toggleTheme: (state) => {
            state.theme =
                state.theme === "dark" ? "light" : "dark";

            localStorage.setItem("theme", state.theme);
        },

        setTheme: (state, action) => {
            state.theme = action.payload;
            localStorage.setItem("theme", action.payload);
        },
    },
});

export const {
    toggleSidebar,
    setSidebarOpen,
    toggleTheme,
    setTheme,
} = uiSlice.actions;

export default uiSlice.reducer;