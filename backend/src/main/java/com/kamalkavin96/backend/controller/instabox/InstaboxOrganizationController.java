package com.kamalkavin96.backend.controller.instabox;

import com.kamalkavin96.backend.dto.instabox.request.InstaboxOrganizationRequest;
import com.kamalkavin96.backend.dto.instabox.response.InstaboxOrginizationResponse;
import com.kamalkavin96.backend.service.instabox.InstaboxOrganizationService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/instabox/organizations")
@RequiredArgsConstructor
public class InstaboxOrganizationController {

    private final InstaboxOrganizationService service;

    @PostMapping
    public ResponseEntity<InstaboxOrginizationResponse> create(
            @Valid @RequestBody InstaboxOrganizationRequest request) {

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(service.create(request));
    }

    @GetMapping
    public ResponseEntity<List<InstaboxOrginizationResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<InstaboxOrginizationResponse> getById(
            @PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @GetMapping("/org/{organizationId}")
    public ResponseEntity<InstaboxOrginizationResponse> getByOrganizationId(
            @PathVariable String organizationId) {
        return ResponseEntity.ok(service.getByOrganizationId(organizationId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InstaboxOrginizationResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody InstaboxOrganizationRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/sync")
    public ResponseEntity<InstaboxOrginizationResponse> syncMachines(
            @PathVariable Long id,
            @RequestBody InstaboxOrganizationRequest request) {

        return ResponseEntity.ok(service.syncMachines(id, request.getApiKey()));
    }
}