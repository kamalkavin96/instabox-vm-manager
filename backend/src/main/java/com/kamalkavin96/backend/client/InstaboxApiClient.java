package com.kamalkavin96.backend.client;

import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.kamalkavin96.backend.dto.request.ResumeMachineRequest;
import com.kamalkavin96.backend.dto.request.StartMachineRequest;
import com.kamalkavin96.backend.dto.request.StopMachineRequest;

import tools.jackson.databind.JsonNode;

@Component
public class InstaboxApiClient {

    private final RestClient instaboxRestClient;

    public InstaboxApiClient(@Qualifier("instaboxRestClient") RestClient instaboxRestClient) {
        this.instaboxRestClient = instaboxRestClient;
    }

    public JsonNode getMachine(String machineId, String apiToken) {
        return instaboxRestClient.get()
                .uri("/machines/{id}", machineId)
                .header("Authorization", "Bearer " + apiToken)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode startMachine(
            String machineId,
            String apiKey,
            String idempotencyKey,
            StartMachineRequest request) {

        return instaboxRestClient.post()
                .uri("/machines/{id}/start", machineId)
                .header("Authorization", "Bearer " + apiKey)
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode stopMachine(
            String machineId,
            String apiKey,
            String idempotencyKey,
            StopMachineRequest request) {

        return instaboxRestClient.post()
                .uri("/machines/{id}/stop", machineId)
                .header("Authorization", "Bearer " + apiKey)
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(request != null ? request : Map.of())
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode suspendMachine(
            String machineId,
            String apiKey,
            String idempotencyKey) {

        return instaboxRestClient.post()
                .uri("/machines/{id}/suspend", machineId)
                .header("Authorization", "Bearer " + apiKey)
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of())
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode resumeMachine(
            String machineId,
            String apiKey,
            String idempotencyKey,
            ResumeMachineRequest request) {

        return instaboxRestClient.post()
                .uri("/machines/{id}/resume", machineId)
                .header("Authorization", "Bearer " + apiKey)
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode getOperation(
            String operationId,
            String apiKey,
            String wait) {

        return instaboxRestClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/operations/{id}");

                    if (wait != null && !wait.isBlank()) {
                        builder.queryParam("wait", wait);
                    }

                    return builder.build(operationId);
                })
                .header("Authorization", "Bearer " + apiKey)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode getMachinePorts(
            String machineId,
            String apiKey) {

        return instaboxRestClient.get()
                .uri("/machines/{id}/ports", machineId)
                .header("Authorization", "Bearer " + apiKey)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode getUsage(String apiKey, String orgId) {

        return instaboxRestClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/usage");

                    if (orgId != null && !orgId.isBlank()) {
                        builder.queryParam("org", orgId);
                    }

                    return builder.build();
                })
                .header("Authorization", "Bearer " + apiKey)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode getMachineSecrets(String machineId, String apiKey) {

        return instaboxRestClient.get()
                .uri("/machines/{id}/secrets", machineId)
                .header("Authorization", "Bearer " + apiKey)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode getCurrentUser(String apiKey) {

        return instaboxRestClient.get()
                .uri("/me")
                .header("X-API-Key", apiKey)
                .retrieve()
                .body(JsonNode.class);
    }

    public JsonNode getMachines(String apiKey) {

    return instaboxRestClient.get()
            .uri("/machines")
            .header("X-API-Key", apiKey)
            .retrieve()
            .body(JsonNode.class);
}

}
