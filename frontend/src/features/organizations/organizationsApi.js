import apiClient from "../../api/axiosInstance";

const ORGS_BASE_URL = "/instabox/organizations";

export const getOrginizationList = async () => {
    const response = await apiClient.get(ORGS_BASE_URL);
    return response.data;
};

export const createOrganization = async (data) => {
    const response = await apiClient.post(ORGS_BASE_URL, data);
    return response.data;
};

export const updateOrganization = async (id, data) => {
    const response = await apiClient.put(`${ORGS_BASE_URL}/${id}`, data);
    return response.data;
};

export const deleteOrganization = async (id) => {
    const response = await apiClient.delete(`${ORGS_BASE_URL}/${id}`);
    return response.data;
};

export const syncOrganizationMachines = async (id, apiKey) => {
    const response = await apiClient.post(`${ORGS_BASE_URL}/${id}/sync`, { apiKey });
    return response.data;
};
