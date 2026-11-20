import { configureStore } from "@reduxjs/toolkit";

import uiReducer from "../store/uiSlice";
import { api } from "../services/api";

export const store = configureStore({
    reducer: {
        ui: uiReducer,

        [api.reducerPath]: api.reducer,
    },

    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
});