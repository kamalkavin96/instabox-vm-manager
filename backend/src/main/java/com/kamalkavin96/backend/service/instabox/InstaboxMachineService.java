package com.kamalkavin96.backend.service.instabox;

import com.kamalkavin96.backend.client.InstaboxApiClient;
import com.kamalkavin96.backend.dto.instabox.request.InstaboxMachineRequest;
import com.kamalkavin96.backend.dto.instabox.response.InstaboxMachineResponse;
import com.kamalkavin96.backend.entity.instabox.InstaboxMachine;
import com.kamalkavin96.backend.repository.instabox.InstaboxMachineRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InstaboxMachineService {

    private final InstaboxMachineRepository repository;
    private final InstaboxApiClient instaboxApiClient;

    // ==========================================
    // CREATE
    // ==========================================

    @Transactional
    public InstaboxMachine create(InstaboxMachineRequest request) {

        // Check duplicate machine
        if (repository.existsByMachineId(request.getMachineId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Machine already exists");
        }

        InstaboxMachine machine = new InstaboxMachine();

        // Basic Information
        machine.setMachineId(request.getMachineId());
        machine.setName(request.getName());

        // Template Information
        machine.setTemplateId(request.getTemplateId());
        machine.setTemplateVersion(request.getTemplateVersion());
        machine.setTemplateDigest(request.getTemplateDigest());

        // Machine Specifications
        machine.setVcpus(request.getVcpus());
        machine.setMemMiB(request.getMemMiB());
        machine.setPersistentDiskGiB(request.getPersistentDiskGiB());
        machine.setRootDiskGiB(request.getRootDiskGiB());

        // Storage Information
        machine.setStorageSizeGiB(request.getStorageSizeGiB());
        machine.setStorageMountPath(request.getStorageMountPath());
        machine.setStoragePersistent(request.getStoragePersistent());
        machine.setStorageSynced(request.getStorageSynced());
        machine.setSnapshotSeq(request.getSnapshotSeq());

        // Runtime Information
        machine.setRuntimeReady(request.getRuntimeReady());
        machine.setProcessesPreserved(request.getProcessesPreserved());

        // Lifecycle Configuration
        machine.setAutoSuspendAfterSeconds(request.getAutoSuspendAfterSeconds());
        machine.setMaxRunMinutes(request.getMaxRunMinutes());

        // Additional Metadata
        machine.setMetadata(request.getMetadata());

        // Security Information
        machine.setVault(request.getVault());
        machine.setGuestUser(request.getGuestUser());

        // Organization Information
        machine.setOrganizationId(request.getOrganizationId());

        // Billing Information
        machine.setFree(request.getFree());

        // Local Synchronization Timestamp
        machine.setSyncedAt(OffsetDateTime.now());

        return repository.save(machine);
    }

    // ==========================================
    // GET ALL
    // ==========================================

    public List<InstaboxMachine> getAll() {
        return repository.findAll();
    }

    public List<InstaboxMachineResponse> getAllResponses(String organizationId) {
        List<InstaboxMachine> list = (organizationId != null && !organizationId.isBlank())
                ? repository.findByOrganizationId(organizationId.trim())
                : repository.findAll();

        return list.stream()
                .map(this::toResponse)
                .toList();
    }

    // ==========================================
    // GET BY DATABASE ID
    // ==========================================

    public InstaboxMachine getById(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Machine not found: " + id));
    }

    public InstaboxMachineResponse getResponseById(Long id) {
        return toResponse(getById(id));
    }

    // ==========================================
    // GET BY INSTABOX MACHINE ID
    // ==========================================

    public InstaboxMachine getByMachineId(String machineId) {

        return repository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Machine not found: " + machineId));
    }

    // ==========================================
    // DELETE
    // ==========================================

    @Transactional
    public void delete(Long id) {

        InstaboxMachine machine = getById(id);
        repository.delete(machine);
    }

    @Transactional
    public void deleteByOrganizationId(String organizationId) {
        repository.deleteByOrganizationId(organizationId);
    }

    // ==========================================
    // SYNC MACHINES FROM INSTABOX
    // ==========================================

    @Transactional
    public List<InstaboxMachine> syncMachines(String apiKey) {

        JsonNode response = instaboxApiClient.getMachines(apiKey);

        JsonNode machines = response.path("machines");

        if (!machines.isArray()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Invalid machine response from Instabox");
        }

        List<InstaboxMachine> syncedMachines = new ArrayList<>();

        for (JsonNode node : machines) {

            String machineId = text(node, "id");

            if (machineId == null || machineId.isBlank()) {
                continue;
            }

            InstaboxMachine machine = repository
                    .findByMachineId(machineId)
                    .orElseGet(InstaboxMachine::new);

            mapMachine(node, machine);

            syncedMachines.add(repository.save(machine));
        }

        return syncedMachines;
    }

    @Transactional
    public List<InstaboxMachine> syncMachines(
            JsonNode response,
            String organizationId) {

        JsonNode machines = response.path("machines");

        if (!machines.isArray()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Invalid machine response from Instabox");
        }

        List<InstaboxMachine> syncedMachines = new ArrayList<>();

        for (JsonNode node : machines) {

            String machineId = text(node, "id");

            if (machineId == null || machineId.isBlank()) {
                continue;
            }

            InstaboxMachine machine = repository
                    .findByMachineId(machineId)
                    .orElseGet(InstaboxMachine::new);

            mapMachine(node, machine);

            // Associate machine with its organization
            machine.setOrganizationId(organizationId);

            syncedMachines.add(repository.save(machine));
        }

        return syncedMachines;
    }

    // ==========================================
    // MAP ENTITY TO RESPONSE DTO
    // ==========================================

    public InstaboxMachineResponse toResponse(InstaboxMachine m) {
        return InstaboxMachineResponse.builder()
                .id(m.getId())
                .machineId(m.getMachineId())
                .name(m.getName())
                .desiredState(m.getDesiredState())
                .state(m.getState())
                .revision(m.getRevision())
                .operationId(m.getOperationId())
                .templateId(m.getTemplateId())
                .templateVersion(m.getTemplateVersion())
                .templateDigest(m.getTemplateDigest())
                .vcpus(m.getVcpus())
                .memMiB(m.getMemMiB())
                .persistentDiskGiB(m.getPersistentDiskGiB())
                .rootDiskGiB(m.getRootDiskGiB())
                .storageSizeGiB(m.getStorageSizeGiB())
                .storageMountPath(m.getStorageMountPath())
                .storagePersistent(m.getStoragePersistent())
                .storageSynced(m.getStorageSynced())
                .snapshotSeq(m.getSnapshotSeq())
                .runtimeReady(m.getRuntimeReady())
                .processesPreserved(m.getProcessesPreserved())
                .autoSuspendAfterSeconds(m.getAutoSuspendAfterSeconds())
                .maxRunMinutes(m.getMaxRunMinutes())
                .runStartedAt(m.getRunStartedAt())
                .readyAt(m.getReadyAt())
                .cooldownUntil(m.getCooldownUntil())
                .metadata(m.getMetadata())
                .vault(m.getVault())
                .guestUser(m.getGuestUser())
                .organizationId(m.getOrganizationId())
                .free(m.getFree())
                .oomKills(m.getOomKills())
                .machineCreatedAt(m.getMachineCreatedAt())
                .machineUpdatedAt(m.getMachineUpdatedAt())
                .syncedAt(m.getSyncedAt())
                .build();
    }

    // ==========================================
    // MAP API RESPONSE TO ENTITY
    // ==========================================

    private void mapMachine(
            JsonNode node,
            InstaboxMachine machine) {

        machine.setMachineId(text(node, "id"));
        machine.setName(text(node, "name"));

        // Machine State
        machine.setDesiredState(text(node, "desiredState"));
        machine.setState(text(node, "state"));
        machine.setRevision(longValue(node, "revision"));
        machine.setOperationId(text(node, "operationId"));

        // Template
        JsonNode template = node.path("template");

        machine.setTemplateId(text(template, "id"));
        machine.setTemplateVersion(text(template, "version"));
        machine.setTemplateDigest(text(template, "digest"));

        // Specifications
        JsonNode spec = node.path("spec");

        machine.setVcpus(integer(spec, "vcpus"));
        machine.setMemMiB(integer(spec, "memMiB"));
        machine.setPersistentDiskGiB(integer(spec, "persistentDiskGiB"));
        machine.setRootDiskGiB(integer(spec, "rootDiskGiB"));

        // Storage
        JsonNode storage = node.path("storage");

        machine.setStorageSizeGiB(integer(storage, "sizeGiB"));
        machine.setStorageMountPath(text(storage, "mountPath"));
        machine.setStoragePersistent(bool(storage, "persistent"));
        machine.setStorageSynced(bool(storage, "synced"));
        machine.setSnapshotSeq(longValue(storage, "snapshotSeq"));

        // Runtime
        JsonNode runtime = node.path("runtime");

        machine.setRuntimeReady(bool(runtime, "ready"));
        machine.setProcessesPreserved(bool(runtime, "processesPreserved"));

        // Lifecycle
        machine.setAutoSuspendAfterSeconds(
                integer(node, "autoSuspendAfterSeconds"));

        machine.setMaxRunMinutes(integer(node, "maxRunMinutes"));

        // Runtime Timestamps
        machine.setRunStartedAt(dateTime(node, "runStartedAt"));
        machine.setReadyAt(dateTime(node, "readyAt"));
        machine.setCooldownUntil(dateTime(node, "cooldownUntil"));

        // Metadata
        machine.setMetadata(readMetadata(node.path("metadata")));

        // Security
        machine.setVault(bool(node, "vault"));
        machine.setGuestUser(text(node, "guestUser"));

        // Organization
        machine.setOrganizationId(text(node, "orgId"));

        // Billing
        machine.setFree(bool(node, "free"));

        // Monitoring
        machine.setOomKills(integer(node, "oomKills"));

        // Instabox Timestamps
        machine.setMachineCreatedAt(dateTime(node, "createdAt"));
        machine.setMachineUpdatedAt(dateTime(node, "updatedAt"));

        // Local Synchronization Timestamp
        machine.setSyncedAt(OffsetDateTime.now());
    }

    // ==========================================
    // JSON HELPER METHODS
    // ==========================================

    private String text(JsonNode node, String field) {

        JsonNode value = node.path(field);

        return value.isMissingNode() || value.isNull()
                ? null
                : value.asText();
    }

    private Integer integer(JsonNode node, String field) {

        JsonNode value = node.path(field);

        return value.isNumber()
                ? value.intValue()
                : null;
    }

    private Long longValue(JsonNode node, String field) {

        JsonNode value = node.path(field);

        return value.isNumber()
                ? value.longValue()
                : null;
    }

    private Boolean bool(JsonNode node, String field) {

        JsonNode value = node.path(field);

        return value.isBoolean()
                ? value.booleanValue()
                : null;
    }

    private OffsetDateTime dateTime(JsonNode node, String field) {

        String value = text(node, field);

        return value == null
                ? null
                : OffsetDateTime.parse(value);
    }

    private Map<String, Object> readMetadata(JsonNode node) {

        if (node == null || !node.isObject()) {
            return new HashMap<>();
        }

        return node.properties()
                .stream()
                .collect(
                        Collectors.toMap(
                                Map.Entry::getKey,
                                entry -> {
                                    JsonNode value = entry.getValue();

                                    if (value.isTextual()) {
                                        return value.asText();
                                    }

                                    if (value.isNumber()) {
                                        return value.numberValue();
                                    }

                                    if (value.isBoolean()) {
                                        return value.booleanValue();
                                    }

                                    return value.toString();
                                }));
    }

    @Transactional
    public int syncMachinesForOrganization(String apiKey, String organizationId) {
        JsonNode machineResponse = instaboxApiClient.getMachines(apiKey);
        List<InstaboxMachine> synced = syncMachines(machineResponse, organizationId);
        return synced.size();
    }
}