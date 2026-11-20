package com.kamalkavin96.backend.controller;

import com.kamalkavin96.backend.dto.request.CredentialRequest;
import com.kamalkavin96.backend.dto.response.CredentialResponse;
import com.kamalkavin96.backend.service.InstaboxCredentialService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/instabox/credentials")
public class InstaboxCredentialController {

    private final InstaboxCredentialService credentialService;

    public InstaboxCredentialController(
            InstaboxCredentialService credentialService) {

        this.credentialService = credentialService;
    }

    // CREATE
    @PostMapping
    public ResponseEntity<CredentialResponse> create(
            @RequestBody CredentialRequest request) {

        CredentialResponse response = credentialService.create(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // GET ALL
    @GetMapping
    public ResponseEntity<List<CredentialResponse>> findAll() {

        return ResponseEntity.ok(
                credentialService.findAll()
        );
    }

    // GET BY ID
    @GetMapping("/{id}")
    public ResponseEntity<CredentialResponse> findById(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                credentialService.findById(id)
        );
    }

    // UPDATE
    @PutMapping("/{id}")
    public ResponseEntity<CredentialResponse> update(
            @PathVariable Long id,
            @RequestBody CredentialRequest request) {

        return ResponseEntity.ok(
                credentialService.update(id, request)
        );
    }

    // DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id) {

        credentialService.delete(id);

        return ResponseEntity.noContent().build();
    }

    // ACTIVATE
    @PatchMapping("/{id}/activate")
    public ResponseEntity<CredentialResponse> activate(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                credentialService.activate(id)
        );
    }

    // CHECK ACTIVE CREDENTIAL
    @GetMapping("/active")
    public ResponseEntity<Map<String, Boolean>> hasActiveCredential() {

        boolean active = credentialService.findAll()
                .stream()
                .anyMatch(CredentialResponse::active);

        return ResponseEntity.ok(
                Map.of("active", active)
        );
    }

    
}