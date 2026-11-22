package com.kamalkavin96.backend.controller.docker;

import com.kamalkavin96.backend.dto.docker.DockerExecRequest;
import com.kamalkavin96.backend.dto.docker.DockerOperationRequest;
import com.kamalkavin96.backend.entity.docker.MachineDockerSnapshot;
import com.kamalkavin96.backend.service.docker.DockerSnapshotSyncService;
import com.kamalkavin96.backend.service.docker.DockerSocketService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/machines/{machineId}/docker")
public class MachineDockerController {

    private final DockerSocketService dockerService;
    private final DockerSnapshotSyncService snapshotSyncService;

    public MachineDockerController(
            DockerSocketService dockerService,
            DockerSnapshotSyncService snapshotSyncService
    ) {
        this.dockerService = dockerService;
        this.snapshotSyncService = snapshotSyncService;
    }

    // --- Snapshot & Sync (DB-backed fast reads) ---

    @GetMapping(value = "/snapshot-status", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MachineDockerSnapshot> snapshotStatus(@PathVariable String machineId) {
        return ResponseEntity.ok(snapshotSyncService.getOrEmptySnapshot(machineId));
    }

    @PostMapping(value = "/sync", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MachineDockerSnapshot> syncNow(@PathVariable String machineId) {
        return ResponseEntity.ok(snapshotSyncService.syncMachine(machineId));
    }

    @GetMapping(value = "/info", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> info(@PathVariable String machineId) {
        return ResponseEntity.ok(snapshotSyncService.getOrEmptySnapshot(machineId).getSystemInfoJson());
    }

    @GetMapping(value = "/version", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> version(@PathVariable String machineId) {
        return ResponseEntity.ok(dockerService.getVersion(machineId));
    }

    @GetMapping(value = "/df", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> df(@PathVariable String machineId) {
        return ResponseEntity.ok(snapshotSyncService.getOrEmptySnapshot(machineId).getDiskUsageJson());
    }

    // --- Unified Action Dispatcher ---

    @PostMapping("/action")
    public ResponseEntity<Object> action(
            @PathVariable String machineId,
            @RequestBody DockerOperationRequest request
    ) {
        Object result = dockerService.executeAction(machineId, request);
        snapshotSyncService.syncMachine(machineId);
        return ResponseEntity.ok(result);
    }

    // --- Containers ---

    @GetMapping(value = "/containers", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listContainers(
            @PathVariable String machineId,
            @RequestParam(defaultValue = "true") boolean all
    ) {
        return ResponseEntity.ok(snapshotSyncService.getOrEmptySnapshot(machineId).getContainersJson());
    }

    @GetMapping(value = "/containers/{containerId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> inspectContainer(
            @PathVariable String machineId,
            @PathVariable String containerId
    ) {
        return ResponseEntity.ok(dockerService.inspectContainer(machineId, containerId));
    }

    @GetMapping(value = "/containers/{containerId}/logs", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> logs(
            @PathVariable String machineId,
            @PathVariable String containerId,
            @RequestParam(defaultValue = "200") int tail
    ) {
        return ResponseEntity.ok(dockerService.containerLogs(machineId, containerId, tail));
    }

    @GetMapping(value = "/containers/{containerId}/stats", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> stats(
            @PathVariable String machineId,
            @PathVariable String containerId
    ) {
        return ResponseEntity.ok(dockerService.containerStats(machineId, containerId));
    }

    @GetMapping(value = "/containers/{containerId}/top", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> top(
            @PathVariable String machineId,
            @PathVariable String containerId
    ) {
        return ResponseEntity.ok(dockerService.containerTop(machineId, containerId));
    }

    @PostMapping("/containers/{containerId}/exec")
    public ResponseEntity<Map<String, Object> > exec(
            @PathVariable String machineId,
            @PathVariable String containerId,
            @RequestBody DockerExecRequest request
    ) {
        Map<String, Object> result = dockerService.execInContainer(machineId, containerId, request);
        return ResponseEntity.ok(result != null ? result : Map.of());
    }

    @DeleteMapping("/containers/{containerId}")
    public ResponseEntity<String> removeContainer(
            @PathVariable String machineId,
            @PathVariable String containerId,
            @RequestParam(defaultValue = "false") boolean force
    ) {
        String output = dockerService.removeContainer(machineId, containerId, force);
        snapshotSyncService.syncMachine(machineId);
        return ResponseEntity.ok(output);
    }

    // --- Images ---

    @GetMapping(value = "/images", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listImages(
            @PathVariable String machineId,
            @RequestParam(defaultValue = "false") boolean all
    ) {
        return ResponseEntity.ok(snapshotSyncService.getOrEmptySnapshot(machineId).getImagesJson());
    }

    @DeleteMapping("/images/{imageId}")
    public ResponseEntity<String> removeImage(
            @PathVariable String machineId,
            @PathVariable String imageId,
            @RequestParam(defaultValue = "false") boolean force
    ) {
        String output = dockerService.removeImage(machineId, imageId, force);
        snapshotSyncService.syncMachine(machineId);
        return ResponseEntity.ok(output);
    }

    // --- Volumes ---

    @GetMapping(value = "/volumes", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listVolumes(@PathVariable String machineId) {
        return ResponseEntity.ok(snapshotSyncService.getOrEmptySnapshot(machineId).getVolumesJson());
    }

    @DeleteMapping("/volumes/{volumeName}")
    public ResponseEntity<String> removeVolume(
            @PathVariable String machineId,
            @PathVariable String volumeName,
            @RequestParam(defaultValue = "false") boolean force
    ) {
        String output = dockerService.removeVolume(machineId, volumeName, force);
        snapshotSyncService.syncMachine(machineId);
        return ResponseEntity.ok(output);
    }

    // --- Networks ---

    @GetMapping(value = "/networks", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listNetworks(@PathVariable String machineId) {
        return ResponseEntity.ok(snapshotSyncService.getOrEmptySnapshot(machineId).getNetworksJson());
    }

    @DeleteMapping("/networks/{networkId}")
    public ResponseEntity<String> removeNetwork(
            @PathVariable String machineId,
            @PathVariable String networkId
    ) {
        String output = dockerService.removeNetwork(machineId, networkId);
        snapshotSyncService.syncMachine(machineId);
        return ResponseEntity.ok(output);
    }
}