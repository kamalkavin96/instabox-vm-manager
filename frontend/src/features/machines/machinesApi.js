import apiClient from "../../api/axiosInstance";

const MACHINES_BASE_URL = "/instabox/machines";

export const getMachineList = async (organizationId = "") => {
    const params = organizationId ? { organizationId } : {};
    const response = await apiClient.get(MACHINES_BASE_URL, { params });
    return response.data;
};

export const getMachineById = async (id) => {
    const response = await apiClient.get(`${MACHINES_BASE_URL}/${id}`);
    return response.data;
};

export const deleteMachineById = async (id) => {
    const response = await apiClient.delete(`${MACHINES_BASE_URL}/${id}`);
    return response.data;
};