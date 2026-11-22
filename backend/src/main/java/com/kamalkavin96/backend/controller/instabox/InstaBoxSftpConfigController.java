package com.kamalkavin96.backend.controller.instabox;

import com.kamalkavin96.backend.dto.instabox.request.InstaBoxConnectionRequest;
import com.kamalkavin96.backend.dto.instabox.response.InstaBoxConnectionResponse;
import com.kamalkavin96.backend.service.instabox.InstaBoxSftpConfigService;
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

@RestController
@RequestMapping("/api/v1/machines/{machineId}/instabox/sftp")
public class InstaBoxSftpConfigController {

    private final InstaBoxSftpConfigService service;

    public InstaBoxSftpConfigController(InstaBoxSftpConfigService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<InstaBoxConnectionResponse> get(@PathVariable String machineId) {
        return ResponseEntity.ok(service.getByMachineId(machineId));
    }

    @PostMapping
    public ResponseEntity<InstaBoxConnectionResponse> create(
            @PathVariable String machineId,
            @RequestBody InstaBoxConnectionRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.upsertByMachineId(machineId, request));
    }

    @PutMapping
    public ResponseEntity<InstaBoxConnectionResponse> update(
            @PathVariable String machineId,
            @RequestBody InstaBoxConnectionRequest request
    ) {
        return ResponseEntity.ok(service.upsertByMachineId(machineId, request));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@PathVariable String machineId) {
        service.deleteByMachineId(machineId);
        return ResponseEntity.noContent().build();
    }
}