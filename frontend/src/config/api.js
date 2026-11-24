const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const API_VERSION = import.meta.env.VITE_API_BASE_URL || "api/v1";


export const API_URL = `${BASE_URL}/${API_VERSION}`;