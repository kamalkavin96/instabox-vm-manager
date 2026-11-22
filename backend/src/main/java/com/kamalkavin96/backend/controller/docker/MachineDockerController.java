package com.kamalkavin96.backend.controller.docker;

import com.kamalkavin96.backend.dto.docker.DockerExecRequest;
import com.kamalkavin96.backend.dto.docker.DockerOperationRequest;
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

    public MachineDockerController(DockerSocketService dockerService) {
        this.dockerService = dockerService;
    }

    @GetMapping(value = "/info", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> info(@PathVariable String machineId) {
        return ResponseEntity.ok(dockerService.getSystemInfo(machineId));
    }

    @GetMapping(value = "/version", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> version(@PathVariable String machineId) {
        return ResponseEntity.ok(dockerService.getVersion(machineId));
    }

    @GetMapping(value = "/df", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> df(@PathVariable String machineId) {
        return ResponseEntity.ok(dockerService.getDiskUsage(machineId));
    }

    @PostMapping("/action")
    public ResponseEntity<Object> action(
            @PathVariable String machineId,
            @RequestBody DockerOperationRequest request
    ) {
        return ResponseEntity.ok(dockerService.executeAction(machineId, request));
    }

    // Containers
    @GetMapping(value = "/containers", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listContainers(
            @PathVariable String machineId,
            @RequestParam(defaultValue = "true") boolean all
    ) {
        return ResponseEntity.ok(dockerService.listContainers(machineId, all));
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
        return ResponseEntity.ok(dockerService.execInContainer(machineId, containerId, request));
    }

    @DeleteMapping("/containers/{containerId}")
    public ResponseEntity<String> removeContainer(
            @PathVariable String machineId,
            @PathVariable String containerId,
            @RequestParam(defaultValue = "false") boolean force
    ) {
        return ResponseEntity.ok(dockerService.removeContainer(machineId, containerId, force));
    }

    // Images
    @GetMapping(value = "/images", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listImages(
            @PathVariable String machineId,
            @RequestParam(defaultValue = "false") boolean all
    ) {
        return ResponseEntity.ok(dockerService.listImages(machineId, all));
    }

    @DeleteMapping("/images/{imageId}")
    public ResponseEntity<String> removeImage(
            @PathVariable String machineId,
            @PathVariable String imageId,
            @RequestParam(defaultValue = "false") boolean force
    ) {
        return ResponseEntity.ok(dockerService.removeImage(machineId, imageId, force));
    }

    // Volumes
    @GetMapping(value = "/volumes", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listVolumes(@PathVariable String machineId) {
        return ResponseEntity.ok(dockerService.listVolumes(machineId));
    }

    @DeleteMapping("/volumes/{volumeName}")
    public ResponseEntity<String> removeVolume(
            @PathVariable String machineId,
            @PathVariable String volumeName,
            @RequestParam(defaultValue = "false") boolean force
    ) {
        return ResponseEntity.ok(dockerService.removeVolume(machineId, volumeName, force));
    }

    // Networks
    @GetMapping(value = "/networks", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> listNetworks(@PathVariable String machineId) {
        return ResponseEntity.ok(dockerService.listNetworks(machineId));
    }

    @DeleteMapping("/networks/{networkId}")
    public ResponseEntity<String> removeNetwork(
            @PathVariable String machineId,
            @PathVariable String networkId
    ) {
        return ResponseEntity.ok(dockerService.removeNetwork(machineId, networkId));
    }
}
