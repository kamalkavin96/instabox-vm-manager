package com.kamalkavin96.backend.service.docker;

import com.kamalkavin96.backend.entity.docker.MachineDockerSnapshot;
import com.kamalkavin96.backend.repository.docker.MachineDockerSnapshotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class DockerSnapshotSyncService {

    private static final Logger log = LoggerFactory.getLogger(DockerSnapshotSyncService.class);

    private final MachineDockerSnapshotRepository snapshotRepository;
    private final DockerSocketService dockerSocketService;

    public DockerSnapshotSyncService(
            MachineDockerSnapshotRepository snapshotRepository,
            DockerSocketService dockerSocketService
    ) {
        this.snapshotRepository = snapshotRepository;
        this.dockerSocketService = dockerSocketService;
    }

    @Transactional
    public MachineDockerSnapshot syncMachine(String machineId) {
        MachineDockerSnapshot snapshot = snapshotRepository.findByMachineId(machineId)
                .orElseGet(() -> {
                    MachineDockerSnapshot created = new MachineDockerSnapshot();
                    created.setMachineId(machineId);
                    return created;
                });

        try {
            String containers = dockerSocketService.listContainers(machineId, true);
            String images = dockerSocketService.listImages(machineId, true);
            String volumes = dockerSocketService.listVolumes(machineId);
            String networks = dockerSocketService.listNetworks(machineId);

            String sysInfo = safeCall(() -> dockerSocketService.getSystemInfo(machineId), "{}");
            String diskUsage = safeCall(() -> dockerSocketService.getDiskUsage(machineId), "{}");

            snapshot.setContainersJson(normalizeJsonArray(containers));
            snapshot.setImagesJson(normalizeJsonArray(images));
            snapshot.setVolumesJson(normalizeJsonObject(volumes, "{\"Volumes\":[]}"));
            snapshot.setNetworksJson(normalizeJsonArray(networks));
            snapshot.setSystemInfoJson(normalizeJsonObject(sysInfo, "{}"));
            snapshot.setDiskUsageJson(normalizeJsonObject(diskUsage, "{}"));
            snapshot.setSyncStatus("SUCCESS");
            snapshot.setLastError(null);
            snapshot.setLastSyncedAt(Instant.now());
        } catch (Exception ex) {
            log.warn("Docker snapshot sync failed for machineId={}: {}", machineId, ex.getMessage());
            snapshot.setSyncStatus("FAILED");
            String msg = ex.getMessage() != null ? ex.getMessage() : "Unknown sync error";
            snapshot.setLastError(msg.length() > 950 ? msg.substring(0, 950) : msg);
        }

        return snapshotRepository.save(snapshot);
    }

    @Transactional(readOnly = true)
    public MachineDockerSnapshot getOrEmptySnapshot(String machineId) {
        return snapshotRepository.findByMachineId(machineId)
                .orElseGet(() -> {
                    MachineDockerSnapshot empty = new MachineDockerSnapshot();
                    empty.setMachineId(machineId);
                    empty.setSyncStatus("NOT_SYNCED");
                    return empty;
                });
    }

    private String safeCall(ThrowingSupplier<String> supplier, String fallback) {
        try {
            String val = supplier.get();
            return (val == null || val.isBlank()) ? fallback : val.trim();
        } catch (Exception e) {
            return fallback;
        }
    }

    private String normalizeJsonArray(String raw) {
        if (raw == null || raw.isBlank()) return "[]";
        String trimmed = raw.trim();
        return trimmed.startsWith("[") ? trimmed : "[]";
    }

    private String normalizeJsonObject(String raw, String fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        String trimmed = raw.trim();
        return trimmed.startsWith("{") ? trimmed : fallback;
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}