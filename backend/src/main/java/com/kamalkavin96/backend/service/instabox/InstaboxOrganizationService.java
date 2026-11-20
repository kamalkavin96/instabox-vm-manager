package com.kamalkavin96.backend.service.instabox;

import com.kamalkavin96.backend.client.InstaboxApiClient;
import com.kamalkavin96.backend.dto.instabox.request.InstaboxOrganizationRequest;
import com.kamalkavin96.backend.dto.instabox.response.InstaboxOrginizationResponse;
import com.kamalkavin96.backend.entity.instabox.InstaboxOrganization;
import com.kamalkavin96.backend.repository.instabox.InstaboxMachineRepository;
import com.kamalkavin96.backend.repository.instabox.InstaboxOrganizationRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InstaboxOrganizationService {

    private final InstaboxOrganizationRepository repository;
    private final InstaboxMachineRepository machineRepository;
    private final InstaboxApiClient instaboxApiClient;
    private final InstaboxMachineService machineService;

    @Transactional
    public InstaboxOrginizationResponse create(
            InstaboxOrganizationRequest request) {

        JsonNode userResponse = instaboxApiClient.getCurrentUser(
                request.getApiKey());

        String organizationId = userResponse
                .path("org")
                .path("id")
                .asText(null);

        if (organizationId == null || organizationId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve Instabox organization ID");
        }

        if (repository.existsByOrganizationId(organizationId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Organization already exists");
        }

        JsonNode machineResponse = instaboxApiClient.getMachines(
                request.getApiKey());

        if (!machineResponse.path("machines").isArray()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve Instabox machines");
        }

        InstaboxOrganization organization = new InstaboxOrganization();
        organization.setOrganizationId(organizationId);
        organization.setOrganizationName(request.getOrganizationName());

        InstaboxOrganization savedOrganization = repository.save(organization);

        machineService.syncMachines(machineResponse, organizationId);

        return toResponse(savedOrganization);
    }

    public List<InstaboxOrginizationResponse> getAll() {
        return repository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public InstaboxOrginizationResponse getById(Long id) {
        InstaboxOrganization organization = findEntityById(id);
        return toResponse(organization);
    }

    public InstaboxOrginizationResponse getByOrganizationId(String organizationId) {
        InstaboxOrganization organization = repository.findByOrganizationId(organizationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Organization not found: " + organizationId));
        return toResponse(organization);
    }

    @Transactional
    public InstaboxOrginizationResponse update(
            Long id,
            InstaboxOrganizationRequest request) {

        InstaboxOrganization organization = findEntityById(id);
        organization.setOrganizationName(request.getOrganizationName());
        InstaboxOrganization updated = repository.save(organization);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long id) {
        InstaboxOrganization organization = findEntityById(id);
        machineService.deleteByOrganizationId(organization.getOrganizationId());
        repository.delete(organization);
    }

    private InstaboxOrganization findEntityById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Organization not found: " + id));
    }

    private InstaboxOrginizationResponse toResponse(InstaboxOrganization org) {
        long count = machineRepository.countByOrganizationId(org.getOrganizationId());
        return InstaboxOrginizationResponse.builder()
                .id(org.getId())
                .organizationId(org.getOrganizationId())
                .organizationName(org.getOrganizationName())
                .machineCount(count)
                .createdAt(org.getCreatedAt())
                .updatedAt(org.getUpdatedAt())
                .build();
    }

    @Transactional
    public InstaboxOrginizationResponse syncMachines(Long id, String apiKey) {
        InstaboxOrganization organization = findEntityById(id);

        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "API key is required to sync machines");
        }

        // Verify the API key belongs to this organization
        JsonNode userResponse = instaboxApiClient.getCurrentUser(apiKey.trim());
        String keyOrgId = userResponse.path("org").path("id").asText(null);
        if (keyOrgId != null && !keyOrgId.isBlank() && !keyOrgId.equals(organization.getOrganizationId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "API key belongs to a different organization (" + keyOrgId + ")");
        }

        machineService.syncMachinesForOrganization(apiKey.trim(), organization.getOrganizationId());
        InstaboxOrganization saved = repository.save(organization);
        return toResponse(saved);
    }
}