import apiClient from "../../api/axiosInstance";

import {
    listDockerContainers,
    listDockerImages,
    listDockerNetworks,
    listDockerVolumes,
} from "../machines/dockerApi";

const enc = (val) => encodeURIComponent(String(val));

const parseJsonSafe = (raw, fallback) => {
    if (raw == null) return fallback;
    if (typeof raw === "object") return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
};

export const fetchDashboardOverview = async () => {
    const machinesRes = await apiClient.get("/instabox/machines");
    const rawMachines = Array.isArray(machinesRes.data)
        ? machinesRes.data
        : Array.isArray(machinesRes.data?.data)
        ? machinesRes.data.data
        : [];

    const machineDetails = await Promise.all(
        rawMachines.map(async (m) => {
            const id = m.machineId ?? m.id;
            const name = m.name ?? m.hostname ?? id;
            const ip = m.ipAddress ?? m.ip ?? m.privateIp ?? "-";
            const status = m.status ?? (m.online ? "Running" : "Stopped");
            const isRunning = String(status).toLowerCase() === "running";

            const cpuPct = Number(m.cpuUsage ?? m.cpuPercent ?? m.cpu ?? 0) || 0;
            const memUsedGb = Number(m.memoryUsedGb ?? m.usedMemoryGb ?? 0) || 0;
            const memTotalGb = Number(m.memoryTotalGb ?? m.totalMemoryGb ?? 0) || 0;
            const memPct =
                Number(m.memoryUsage ?? m.memoryPercent ?? m.memory) ||
                (memTotalGb > 0 ? Math.round((memUsedGb / memTotalGb) * 100) : 0);

            const diskUsedGb = Number(m.storageUsedGb ?? m.diskUsedGb ?? 0) || 0;
            const diskTotalGb = Number(m.storageTotalGb ?? m.diskTotalGb ?? 0) || 0;
            const diskPct =
                Number(m.storageUsage ?? m.diskPercent ?? m.storage) ||
                (diskTotalGb > 0 ? Math.round((diskUsedGb / diskTotalGb) * 100) : 0);

            let portsCount = Array.isArray(m.ports) ? m.ports.length : Number(m.portCount ?? 0) || 0;
            let hasSshConfig = false;
            let hasSftpConfig = false;
            let containers = [];
            let images = [];
            let volumes = [];
            let networks = [];

            if (id) {
                const [portsSettled, sshSettled, sftpSettled, cSettled, iSettled, vSettled, nSettled] =
                    await Promise.allSettled([
                        apiClient.get(`/machines/${enc(id)}/ports`),
                        apiClient.get(`/machines/${enc(id)}/instabox/ssh`),
                        apiClient.get(`/machines/${enc(id)}/instabox/sftp`),
                        listDockerContainers(id, true),
                        listDockerImages(id, true),
                        listDockerVolumes(id),
                        listDockerNetworks(id),
                    ]);

                if (portsSettled.status === "fulfilled") {
                    const pData = portsSettled.value?.data;
                    if (Array.isArray(pData)) portsCount = pData.length;
                    else if (Array.isArray(pData?.data)) portsCount = pData.data.length;
                }
                if (sshSettled.status === "fulfilled" && sshSettled.value?.data) {
                    hasSshConfig = true;
                }
                if (sftpSettled.status === "fulfilled" && sftpSettled.value?.data) {
                    hasSftpConfig = true;
                }
                if (cSettled.status === "fulfilled") containers = cSettled.value;
                if (iSettled.status === "fulfilled") images = iSettled.value;
                if (vSettled.status === "fulfilled") volumes = vSettled.value;
                if (nSettled.status === "fulfilled") networks = nSettled.value;
            }

            const runningContainers = containers.filter(
                (c) => String(c.State || "").toLowerCase() === "running"
            ).length;

            return {
                id,
                name,
                ip,
                status: isRunning ? "Running" : "Stopped",
                isRunning,
                cpu: Math.min(100, Math.max(0, Math.round(cpuPct))),
                memory: Math.min(100, Math.max(0, Math.round(memPct))),
                memUsedGb,
                memTotalGb,
                storage: Math.min(100, Math.max(0, Math.round(diskPct))),
                diskUsedGb,
                diskTotalGb,
                portsCount,
                hasSshConfig,
                hasSftpConfig,
                containersTotal: containers.length,
                containersRunning: runningContainers,
                imagesCount: images.length,
                volumesCount: volumes.length,
                networksCount: networks.length,
            };
        })
    );

    const totalMachines = machineDetails.length;
    const onlineMachines = machineDetails.filter((m) => m.isRunning).length;
    const offlineMachines = totalMachines - onlineMachines;

    const avgCpu =
        totalMachines > 0
            ? Math.round(machineDetails.reduce((acc, m) => acc + m.cpu, 0) / totalMachines)
            : 0;
    const avgMemory =
        totalMachines > 0
            ? Math.round(machineDetails.reduce((acc, m) => acc + m.memory, 0) / totalMachines)
            : 0;
    const avgStorage =
        totalMachines > 0
            ? Math.round(machineDetails.reduce((acc, m) => acc + m.storage, 0) / totalMachines)
            : 0;

    const totalMemUsedGb = machineDetails.reduce((acc, m) => acc + m.memUsedGb, 0);
    const totalMemCapGb = machineDetails.reduce((acc, m) => acc + m.memTotalGb, 0);
    const totalDiskUsedGb = machineDetails.reduce((acc, m) => acc + m.diskUsedGb, 0);
    const totalDiskCapGb = machineDetails.reduce((acc, m) => acc + m.diskTotalGb, 0);

    const orgMetrics = {
        totalPorts: machineDetails.reduce((acc, m) => acc + m.portsCount, 0),
        sshConfiguredCount: machineDetails.filter((m) => m.hasSshConfig).length,
        sftpConfiguredCount: machineDetails.filter((m) => m.hasSftpConfig).length,
        totalContainers: machineDetails.reduce((acc, m) => acc + m.containersTotal, 0),
        runningContainers: machineDetails.reduce((acc, m) => acc + m.containersRunning, 0),
        totalImages: machineDetails.reduce((acc, m) => acc + m.imagesCount, 0),
        totalVolumes: machineDetails.reduce((acc, m) => acc + m.volumesCount, 0),
        totalNetworks: machineDetails.reduce((acc, m) => acc + m.networksCount, 0),
    };

    return {
        kpis: {
            totalMachines,
            onlineMachines,
            offlineMachines,
            avgCpu,
        },
        resources: {
            memory: {
                percent: avgMemory,
                label: totalMemUsedGb > 0 ? `${totalMemUsedGb.toFixed(1)} GB` : `${avgMemory}%`,
                caption:
                    totalMemCapGb > 0
                        ? `${avgMemory}% of ${totalMemCapGb.toFixed(0)} GB allocated`
                        : `${avgMemory}% average memory utilization`,
            },
            storage: {
                percent: avgStorage,
                label: totalDiskUsedGb > 0 ? `${totalDiskUsedGb.toFixed(1)} GB` : `${avgStorage}%`,
                caption:
                    totalDiskCapGb > 0
                        ? `${avgStorage}% of ${totalDiskCapGb.toFixed(0)} GB provisioned`
                        : `${avgStorage}% average storage utilization`,
            },
            cpu: {
                percent: avgCpu,
                label: `${avgCpu}%`,
                caption: "Average cluster CPU utilization",
            },
        },
        orgMetrics,
        machines: machineDetails,
    };
};