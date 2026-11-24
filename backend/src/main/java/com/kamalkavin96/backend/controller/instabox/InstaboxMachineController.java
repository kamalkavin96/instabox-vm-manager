package com.kamalkavin96.backend.controller.instabox;

import com.kamalkavin96.backend.dto.instabox.request.InstaboxMachineRequest;
import com.kamalkavin96.backend.dto.instabox.response.InstaboxMachineResponse;
import com.kamalkavin96.backend.entity.instabox.InstaboxMachine;
import com.kamalkavin96.backend.service.instabox.InstaboxMachineService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/instabox/machines")
@RequiredArgsConstructor
public class InstaboxMachineController {

    private final InstaboxMachineService service;

    @PostMapping
    public ResponseEntity<InstaboxMachine> create(
            @Valid @RequestBody InstaboxMachineRequest request) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(service.create(request));
    }

    @GetMapping
    public ResponseEntity<List<InstaboxMachineResponse>> getAll(
            @RequestParam(required = false) String organizationId) {
        return ResponseEntity.ok(service.getAllResponses(organizationId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InstaboxMachineResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getResponseById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}