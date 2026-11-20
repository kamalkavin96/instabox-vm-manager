package com.kamalkavin96.backend.controller;

import com.kamalkavin96.backend.dto.request.SshCredentialRequest;
import com.kamalkavin96.backend.dto.response.SshCredentialResponse;
import com.kamalkavin96.backend.service.SshCredentialService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ssh-credentials")
@CrossOrigin(origins = "*")
public class SshCredentialController {

    private final SshCredentialService service;

    public SshCredentialController(SshCredentialService service) {
        this.service = service;
    }

    // CREATE
    @PostMapping
    public ResponseEntity<SshCredentialResponse> create(
            @Valid @RequestBody SshCredentialRequest request) {

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(service.create(request));
    }

    // GET ALL
    @GetMapping
    public ResponseEntity<List<SshCredentialResponse>> getAll() {

        return ResponseEntity.ok(service.getAll());
    }

    // GET ACTIVE
    @GetMapping("/active")
    public ResponseEntity<List<SshCredentialResponse>> getActive() {

        return ResponseEntity.ok(service.getActive());
    }

    // GET BY ID
    @GetMapping("/{id}")
    public ResponseEntity<SshCredentialResponse> getById(
            @PathVariable Long id) {

        return ResponseEntity.ok(service.getById(id));
    }

    // GET BY MACHINE ID
    @GetMapping("/machine/{machineId}")
    public ResponseEntity<List<SshCredentialResponse>> getByMachineId(
            @PathVariable String machineId) {

        return ResponseEntity.ok(
                service.getByMachineId(machineId)
        );
    }

    // UPDATE
    @PutMapping("/{id}")
    public ResponseEntity<SshCredentialResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody SshCredentialRequest request) {

        return ResponseEntity.ok(
                service.update(id, request)
        );
    }

    // ENABLE / DISABLE
    @PatchMapping("/{id}/status")
    public ResponseEntity<SshCredentialResponse> updateStatus(
            @PathVariable Long id,
            @RequestParam boolean active) {

        return ResponseEntity.ok(
                service.updateStatus(id, active)
        );
    }

    // DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id) {

        service.delete(id);

        return ResponseEntity.noContent().build();
    }
}