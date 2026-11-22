package com.kamalkavin96.backend.job;

import com.kamalkavin96.backend.entity.docker.MachineDockerSnapshot;
import com.kamalkavin96.backend.repository.instabox.InstaBoxSshConfigRepository;
import com.kamalkavin96.backend.service.docker.DockerSnapshotSyncService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DockerSnapshotScheduler {

    private static final Logger log = LoggerFactory.getLogger(DockerSnapshotScheduler.class);

    private final InstaBoxSshConfigRepository sshConfigRepository;
    private final DockerSnapshotSyncService syncService;

    @Value("${instabox.docker.sync.enabled:true}")
    private boolean syncEnabled;

    public DockerSnapshotScheduler(
            InstaBoxSshConfigRepository sshConfigRepository,
            DockerSnapshotSyncService syncService
    ) {
        this.sshConfigRepository = sshConfigRepository;
        this.syncService = syncService;
    }

    @Scheduled(
            cron = "${instabox.docker.sync.cron:0 */2 * * * *}",
            zone = "${instabox.docker.sync.zone:UTC}"
    )
    public void syncConfiguredMachines() {
        if (!syncEnabled) {
            return;
        }

        List<String> machineIds = sshConfigRepository.findAllConfiguredMachineIds();
        if (machineIds.isEmpty()) {
            return;
        }

        log.info("Starting Docker snapshot sync for {} SSH-configured machine(s)", machineIds.size());
        for (String machineId : machineIds) {
            log.info("Syncing Docker snapshot for machineId={}", machineId);
            try {
                MachineDockerSnapshot result = syncService.syncMachine(machineId);
                if ("SUCCESS".equalsIgnoreCase(result.getSyncStatus())) {
                    log.info("Completed Docker snapshot sync for machineId={} (status={}, syncedAt={})",
                            machineId, result.getSyncStatus(), result.getLastSyncedAt());
                } else {
                    log.warn("Docker snapshot sync finished with status={} for machineId={}: {}",
                            result.getSyncStatus(), machineId, result.getLastError());
                }
            } catch (Exception ex) {
                log.error("Failed Docker snapshot sync for machineId={}: {}", machineId, ex.getMessage(), ex);
            }
        }
    }
}