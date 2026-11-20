package com.kamalkavin96.backend.service;

import com.kamalkavin96.backend.client.InstaboxApiClient;
import com.kamalkavin96.backend.dto.request.ResumeMachineRequest;
import com.kamalkavin96.backend.dto.request.StartMachineRequest;
import com.kamalkavin96.backend.dto.request.StopMachineRequest;
import com.kamalkavin96.backend.dto.response.BulkMachineResponse;

import tools.jackson.databind.JsonNode;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class InstaboxService {

    private static final int MAX_BULK_SIZE = 50;

    private final InstaboxApiClient instaboxApiClient;
    private final InstaboxCredentialService credentialService;

    public InstaboxService(
            InstaboxApiClient instaboxApiClient,
            InstaboxCredentialService credentialService) {

        this.instaboxApiClient = instaboxApiClient;
        this.credentialService = credentialService;
    }

    public JsonNode getMachine(String machineId) {

        String apiKey = credentialService.getActiveApiKey();

        return instaboxApiClient.getMachine(machineId, apiKey);
    }

    public BulkMachineResponse getMachines(List<String> machineIds) {

        if (machineIds == null || machineIds.isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one machine ID is required.");
        }

        List<String> ids = new ArrayList<>(
                new LinkedHashSet<>(
                        machineIds.stream()
                                .filter(id -> id != null && !id.isBlank())
                                .map(String::trim)
                                .toList()));

        if (ids.isEmpty()) {
            throw new IllegalArgumentException("No valid machine IDs provided.");
        }

        if (ids.size() > MAX_BULK_SIZE) {
            throw new IllegalArgumentException("Maximum " + MAX_BULK_SIZE + " machines allowed per request.");
        }

        String apiKey = credentialService.getActiveApiKey();
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {

            List<CompletableFuture<BulkMachineResponse.MachineResult>> futures = ids.stream()
                    .map(id -> CompletableFuture.supplyAsync(() -> fetchMachine(id, apiKey), executor))
                    .toList();

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            List<BulkMachineResponse.MachineResult> results = futures.stream()
                    .map(CompletableFuture::join)
                    .toList();

            int succeeded = (int) results.stream()
                    .filter(BulkMachineResponse.MachineResult::success)
                    .count();

            int failed = results.size() - succeeded;

            return new BulkMachineResponse(
                    results.size(), succeeded,
                    failed, results);
        }
    }

    private BulkMachineResponse.MachineResult fetchMachine(String machineId, String apiKey) {

        try {

            JsonNode machine = instaboxApiClient.getMachine(machineId, apiKey);
            return new BulkMachineResponse.MachineResult(machineId, true, machine, null);

        } catch (RestClientResponseException ex) {

            return new BulkMachineResponse.MachineResult(
                    machineId, false, null,
                    "Instabox API returned HTTP " + ex.getStatusCode().value());

        } catch (Exception ex) {

            return new BulkMachineResponse.MachineResult(
                    machineId, false, null,
                    "Failed to fetch machine.");
        }
    }

    public JsonNode startMachine(String machineId, String idempotencyKey, StartMachineRequest request) {

        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.startMachine(machineId, apiKey, idempotencyKey, request);
    }

    public JsonNode stopMachine(
            String machineId,
            String idempotencyKey,
            StopMachineRequest request) {

        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.stopMachine(machineId, apiKey, idempotencyKey, request);
    }

    public JsonNode suspendMachine(String machineId, String idempotencyKey) {

        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.suspendMachine(machineId, apiKey, idempotencyKey);
    }

    public JsonNode resumeMachine(
            String machineId,
            String idempotencyKey,
            ResumeMachineRequest request) {

        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.resumeMachine(machineId, apiKey, idempotencyKey, request);
    }

    public JsonNode getOperation(String operationId, String wait) {
        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.getOperation(operationId, apiKey, wait);
    }

    public JsonNode getMachinePorts(String machineId) {

        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.getMachinePorts(machineId, apiKey);
    }

    public JsonNode getUsage(String orgId) {

        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.getUsage(apiKey, orgId);
    }

    public JsonNode getMachineSecrets(String machineId) {
        String apiKey = credentialService.getActiveApiKey();
        return instaboxApiClient.getMachineSecrets(machineId, apiKey);
    }

}