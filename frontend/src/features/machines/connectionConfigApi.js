import apiClient from "../../api/axiosInstance";

export const normalizeInstaBoxConfig = (dto, type = "ssh", fallback = null) => {
    const base = fallback || {};
    if (!dto) return null;

    const host = dto.host ?? base.host ?? "";
    const port = Number(dto.port ?? base.port ?? 2222);
    const username = dto.username ?? base.username ?? "";
    const defaultCmd =
        type === "sftp"
            ? `sftp -P ${port} ${username}@${host}`
            : `ssh -p ${port} ${username}@${host}`;

    return {
        ...base,
        host,
        port,
        username,
        secretKey: "",
        hasSecretKey: Boolean(dto.hasSecretKey),
        command: dto.sshCommand || defaultCmd,
        lastConnectedAt: dto.lastConnectedAt ?? null,
        lastConnectionStatus: dto.lastConnectionStatus ?? null,
        createdAt: dto.createdAt ?? null,
        updatedAt: dto.updatedAt ?? null,
    };
};

export const toInstaBoxPayload = (draft) => {
    const payload = {
        host: String(draft.host || "").trim(),
        port: Number(draft.port) || 2222,
        username: String(draft.username || "").trim(),
    };

    if (String(draft.secretKey || "").trim()) {
        payload.secretKey = draft.secretKey;
    }

    return payload;
};

export const getInstaBoxSshConfig = async (machineId) => {
    try {
        const res = await apiClient.get(`/machines/${encodeURIComponent(machineId)}/instabox/ssh`);
        return res.data;
    } catch (err) {
        if (err?.response?.status === 404) return null;
        throw err;
    }
};

export const createInstaBoxSshConfig = async (machineId, draft) => {
    const payload = toInstaBoxPayload(draft);
    const res = await apiClient.post(`/machines/${encodeURIComponent(machineId)}/instabox/ssh`, payload);
    return res.data;
};

export const updateInstaBoxSshConfig = async (machineId, draft) => {
    const payload = toInstaBoxPayload(draft);
    const res = await apiClient.put(`/machines/${encodeURIComponent(machineId)}/instabox/ssh`, payload);
    return res.data;
};

export const deleteInstaBoxSshConfig = async (machineId) => {
    await apiClient.delete(`/machines/${encodeURIComponent(machineId)}/instabox/ssh`);
};

export const getInstaBoxSftpConfig = async (machineId) => {
    try {
        const res = await apiClient.get(`/machines/${encodeURIComponent(machineId)}/instabox/sftp`);
        return res.data;
    } catch (err) {
        if (err?.response?.status === 404) return null;
        throw err;
    }
};

export const createInstaBoxSftpConfig = async (machineId, draft) => {
    const payload = toInstaBoxPayload(draft);
    const res = await apiClient.post(`/machines/${encodeURIComponent(machineId)}/instabox/sftp`, payload);
    return res.data;
};

export const updateInstaBoxSftpConfig = async (machineId, draft) => {
    const payload = toInstaBoxPayload(draft);
    const res = await apiClient.put(`/machines/${encodeURIComponent(machineId)}/instabox/sftp`, payload);
    return res.data;
};

export const deleteInstaBoxSftpConfig = async (machineId) => {
    await apiClient.delete(`/machines/${encodeURIComponent(machineId)}/instabox/sftp`);
};