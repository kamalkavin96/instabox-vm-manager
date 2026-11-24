import apiClient from "../../api/axiosInstance";

const enc = (val) => encodeURIComponent(String(val));

export const getDockerSystemInfo = async (machineId) => {
    const res = await apiClient.get(`/machines/${enc(machineId)}/docker/info`);
    return res.data;
};

export const listDockerContainers = async (machineId, all = true) => {
    const res = await apiClient.get(`/machines/${enc(machineId)}/docker/containers?all=${all}`);
    return Array.isArray(res.data) ? res.data : [];
};

export const getContainerLogs = async (machineId, containerId, tail = 200) => {
    const res = await apiClient.get(
        `/machines/${enc(machineId)}/docker/containers/${enc(containerId)}/logs?tail=${tail}`,
        { responseType: "text" }
    );
    return typeof res.data === "string" ? res.data : String(res.data ?? "");
};

export const getContainerInspect = async (machineId, containerId) => {
    const res = await apiClient.get(`/machines/${enc(machineId)}/docker/containers/${enc(containerId)}`);
    return res.data;
};

export const getContainerStats = async (machineId, containerId) => {
    const res = await apiClient.get(`/machines/${enc(machineId)}/docker/containers/${enc(containerId)}/stats`);
    return res.data;
};

export const execContainerCommand = async (machineId, containerId, cmdArray) => {
    const res = await apiClient.post(
        `/machines/${enc(machineId)}/docker/containers/${enc(containerId)}/exec`,
        { cmd: cmdArray, attachStdout: true, attachStderr: true }
    );
    return res.data;
};

export const listDockerImages = async (machineId, all = false) => {
    const res = await apiClient.get(`/machines/${enc(machineId)}/docker/images?all=${all}`);
    return Array.isArray(res.data) ? res.data : [];
};

export const listDockerVolumes = async (machineId) => {
    const res = await apiClient.get(`/machines/${enc(machineId)}/docker/volumes`);
    return Array.isArray(res.data?.Volumes) ? res.data.Volumes : [];
};

export const listDockerNetworks = async (machineId) => {
    const res = await apiClient.get(`/machines/${enc(machineId)}/docker/networks`);
    return Array.isArray(res.data) ? res.data : [];
};

export const executeDockerAction = async (machineId, payload) => {
    const res = await apiClient.post(`/machines/${enc(machineId)}/docker/action`, payload);
    return res.data;
};

export const syncDockerSnapshot = async (machineId) => {
    const res = await apiClient.post(`/machines/${enc(machineId)}/docker/sync`);
    return res.data;
};