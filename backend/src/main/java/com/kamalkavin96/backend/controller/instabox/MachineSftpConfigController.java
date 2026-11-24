package com.kamalkavin96.backend.controller.instabox;


import com.kamalkavin96.backend.dto.instabox.ConnectionTelemetryRequest;
import com.kamalkavin96.backend.dto.instabox.request.SftpConfigRequest;
import com.kamalkavin96.backend.dto.instabox.response.SftpConfigResponse;
import com.kamalkavin96.backend.service.instabox.MachineSftpConfigService;
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
@RequestMapping("/api/machines/{machineId}/sftp-config")
public class MachineSftpConfigController {

    private final MachineSftpConfigService sftpConfigService;

    public MachineSftpConfigController(MachineSftpConfigService sftpConfigService) {
        this.sftpConfigService = sftpConfigService;
    }

    @GetMapping
    public ResponseEntity<SftpConfigResponse> getConfig(@PathVariable String machineId) {
        return ResponseEntity.ok(sftpConfigService.getByMachineId(machineId));
    }

    @PutMapping
    public ResponseEntity<SftpConfigResponse> upsertConfig(
            @PathVariable String machineId,
            @RequestBody SftpConfigRequest request
    ) {
        return ResponseEntity.ok(sftpConfigService.upsertByMachineId(machineId, request));
    }

    @PostMapping("/telemetry")
    public ResponseEntity<SftpConfigResponse> recordTelemetry(
            @PathVariable String machineId,
            @RequestBody ConnectionTelemetryRequest request
    ) {
        return ResponseEntity.ok(sftpConfigService.recordConnectionTelemetry(machineId, request));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteConfig(@PathVariable String machineId) {
        sftpConfigService.deleteByMachineId(machineId);
        return ResponseEntity.noContent().build();
    }
}