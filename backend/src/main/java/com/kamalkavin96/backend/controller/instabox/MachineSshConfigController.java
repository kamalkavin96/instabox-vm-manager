package com.kamalkavin96.backend.controller.instabox;

import com.kamalkavin96.backend.dto.instabox.ConnectionTelemetryRequest;
import com.kamalkavin96.backend.dto.instabox.request.SshConfigRequest;
import com.kamalkavin96.backend.dto.instabox.response.SshConfigResponse;
import com.kamalkavin96.backend.service.instabox.MachineSshConfigService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// @RestController
@RequestMapping("/api/machines/{machineId}/ssh-config")
public class MachineSshConfigController {

    private final MachineSshConfigService sshConfigService;

    public MachineSshConfigController(MachineSshConfigService sshConfigService) {
        this.sshConfigService = sshConfigService;
    }

    @GetMapping
    public ResponseEntity<SshConfigResponse> getConfig(@PathVariable String machineId) {
        return ResponseEntity.ok(sshConfigService.getByMachineId(machineId));
    }

    @PutMapping
    public ResponseEntity<SshConfigResponse> upsertConfig(
            @PathVariable String machineId,
            @RequestBody SshConfigRequest request) {
        return ResponseEntity.ok(sshConfigService.upsertByMachineId(machineId, request));
    }

    @PostMapping("/telemetry")
    public ResponseEntity<SshConfigResponse> recordTelemetry(
            @PathVariable String machineId,
            @RequestBody ConnectionTelemetryRequest request) {
        return ResponseEntity.ok(sshConfigService.recordConnectionTelemetry(machineId, request));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteConfig(@PathVariable String machineId) {
        sshConfigService.deleteByMachineId(machineId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<SshConfigResponse> createConfig(
            @PathVariable String machineId,
            @RequestBody SshConfigRequest request) {
        SshConfigResponse created = sshConfigService.upsertByMachineId(machineId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}