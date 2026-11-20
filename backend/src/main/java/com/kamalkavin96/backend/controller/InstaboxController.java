package com.kamalkavin96.backend.controller;

import com.kamalkavin96.backend.dto.request.ResumeMachineRequest;
import com.kamalkavin96.backend.dto.request.StartMachineRequest;
import com.kamalkavin96.backend.dto.request.StopMachineRequest;
import com.kamalkavin96.backend.dto.response.BulkMachineResponse;
import com.kamalkavin96.backend.service.InstaboxService;

import tools.jackson.databind.JsonNode;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/instabox")
@Tag(name = "Instabox Controller", description = "Manage Instabox virtual machines.")
public class InstaboxController {

    private final InstaboxService instaboxService;

    public InstaboxController(InstaboxService instaboxService) {
        this.instaboxService = instaboxService;
    }

    @GetMapping("/machines/{id}")
    @Operation(summary = "Get machine", description = "Retrieve details of a specific virtual machine.")
    public JsonNode getMachine(
            @Parameter(description = "Machine ID", example = "m_abc123abc") @PathVariable String id) {
        return instaboxService.getMachine(id);
    }

    @GetMapping("/machines/bulk")
    @Operation(summary = "Get machines", description = "Retrieve multiple virtual machines using their IDs.")
    public ResponseEntity<BulkMachineResponse> getMachines(
            @Parameter(description = "List of machine IDs", example = "m_abc123abc") @RequestParam List<String> ids) {
        return ResponseEntity.ok(instaboxService.getMachines(ids));
    }

    @PostMapping("/machines/{id}/start")
    @Operation(summary = "Start machine", description = "Start a virtual machine. Returns an asynchronous operation.")
    public ResponseEntity<JsonNode> startMachine(
            @Parameter(description = "Machine ID", example = "m_abc123abc") @PathVariable String id,
            @Parameter(description = "Unique idempotency key") @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StartMachineRequest request) {
        JsonNode response = instaboxService.startMachine(id, idempotencyKey, request);
        return ResponseEntity.accepted().body(response);
    }

    @PostMapping("/machines/{id}/stop")
    @Operation(summary = "Stop machine", description = "Stop a virtual machine. Returns an asynchronous operation.")
    public ResponseEntity<JsonNode> stopMachine(
            @Parameter(description = "Machine ID", example = "m_abc123abc") @PathVariable String id,
            @Parameter(description = "Unique idempotency key") @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody(required = false) StopMachineRequest request) {
        JsonNode response = instaboxService.stopMachine(id, idempotencyKey, request);
        return ResponseEntity.accepted().body(response);
    }

    @PostMapping("/machines/{id}/suspend")
    @Operation(summary = "Suspend machine", description = "Suspend a virtual machine. Returns an asynchronous operation.")
    public ResponseEntity<JsonNode> suspendMachine(
            @Parameter(description = "Machine ID", example = "m_abc123abc") @PathVariable String id,
            @Parameter(description = "Unique idempotency key") @RequestHeader("Idempotency-Key") String idempotencyKey) {

        JsonNode response = instaboxService.suspendMachine(id, idempotencyKey);
        return ResponseEntity.accepted().body(response);
    }

    @PostMapping("/machines/{id}/resume")
    @Operation(summary = "Resume machine", description = "Resume a suspended virtual machine. Returns an asynchronous operation.")
    public ResponseEntity<JsonNode> resumeMachine(
            @Parameter(description = "Machine ID", example = "machine_123") @PathVariable String id,
            @Parameter(description = "Unique idempotency key") @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ResumeMachineRequest request) {
        JsonNode response = instaboxService.resumeMachine(id, idempotencyKey, request);
        return ResponseEntity.accepted().body(response);
    }

    @GetMapping("/operations/{id}")
    @Operation(summary = "Get operation", description = "Retrieve operation status and progress. Supports optional long polling.")
    public JsonNode getOperation(
            @Parameter(description = "Operation ID", example = "op_123") @PathVariable String id,
            @Parameter(description = "Optional long-poll duration (e.g. 25s, 500ms)") @RequestParam(required = false) String wait) {
        return instaboxService.getOperation(id, wait);
    }

    @GetMapping("/machines/{id}/ports")
    @Operation(summary = "Get machine ports", description = "Retrieve public port configurations and server availability for a machine.")
    public JsonNode getMachinePorts(
            @Parameter(description = "Machine ID", example = "m_abcdefghijklmnopqrstuvwxyz") @PathVariable String id) {
        return instaboxService.getMachinePorts(id);
    }

    @GetMapping("/usage")
    @Operation(summary = "Get usage and billing", description = "Retrieve sandbox usage, storage limits, monthly cost, credit balance and organization details.")
    public JsonNode getUsage(
            @Parameter(description = "Optional organization ID. Defaults to the organization associated with the API key.", example = "org_123456") @RequestParam(required = false) String org) {
        return instaboxService.getUsage(org);
    }

    @GetMapping("/machines/{id}/secrets")
    @Operation(summary = "Get machine secrets", description = "Retrieve a sandbox's Secret selections, metadata, delivery status and usage statistics. Secret values are never returned.")
    public JsonNode getMachineSecrets(
            @Parameter(description = "Sandbox ID or unique sandbox name", example = "m_abcdefghijklmnopqrstuvwxyz") @PathVariable String id) {
        return instaboxService.getMachineSecrets(id);
    }

}