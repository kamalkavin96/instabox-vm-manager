package com.kamalkavin96.backend.service;

import com.kamalkavin96.backend.dto.request.CredentialRequest;
import com.kamalkavin96.backend.dto.response.CredentialResponse;
import com.kamalkavin96.backend.entity.InstaboxCredential;
import com.kamalkavin96.backend.repository.InstaboxCredentialRepository;
import com.kamalkavin96.backend.utils.CredentialEncryptionService;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
public class InstaboxCredentialService {

    private static final ZoneId TIME_ZONE = ZoneId.of("Asia/Kolkata");

    private final InstaboxCredentialRepository repository;
    private final CredentialEncryptionService encryptionService;

    public InstaboxCredentialService(
            InstaboxCredentialRepository repository,
            CredentialEncryptionService encryptionService) {

        this.repository = repository;
        this.encryptionService = encryptionService;
    }

    // CREATE
    @Transactional
    public CredentialResponse create(CredentialRequest request) {

        validateName(request.name());

        if (request.apiKey() == null || request.apiKey().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Instabox API key is required");
        }

        if (Boolean.TRUE.equals(request.active())) {
            deactivateAll();
        }

        InstaboxCredential credential = new InstaboxCredential();

        credential.setName(request.name());
        credential.setEncryptedApiKey(
                encryptionService.encrypt(request.apiKey()));
        credential.setMachineId(request.machineId());
        credential.setActive(Boolean.TRUE.equals(request.active()));

        LocalDateTime now = now();

        credential.setCreatedAt(now);
        credential.setUpdatedAt(now);

        return toResponse(repository.save(credential));
    }

    // GET ALL
    @Transactional(readOnly = true)
    public List<CredentialResponse> findAll() {

        return repository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // GET BY ID
    @Transactional(readOnly = true)
    public CredentialResponse findById(Long id) {

        return toResponse(getCredential(id));
    }

    // UPDATE
    @Transactional
    public CredentialResponse update(
            Long id,
            CredentialRequest request) {

        InstaboxCredential credential = getCredential(id);

        if (request.name() != null) {
            validateName(request.name());
            credential.setName(request.name());
        }

        if (request.apiKey() != null && !request.apiKey().isBlank()) {
            credential.setEncryptedApiKey(
                    encryptionService.encrypt(request.apiKey()));
        }

        if (request.machineId() != null) {
            credential.setMachineId(request.machineId());
        }

        if (request.active() != null) {

            if (request.active()) {
                deactivateAll();
            }

            credential.setActive(request.active());
        }

        credential.setUpdatedAt(now());

        return toResponse(repository.save(credential));
    }

    // DELETE
    @Transactional
    public void delete(Long id) {

        InstaboxCredential credential = getCredential(id);

        repository.delete(credential);
    }

    // ACTIVATE
    @Transactional
    public CredentialResponse activate(Long id) {

        InstaboxCredential credential = getCredential(id);

        deactivateAll();

        credential.setActive(true);
        credential.setUpdatedAt(now());

        return toResponse(repository.save(credential));
    }

    // GET ACTIVE API KEY - INTERNAL USE
    @Transactional(readOnly = true)
    public String getActiveApiKey() {

        InstaboxCredential credential = repository
                .findFirstByActiveTrue()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No active Instabox credential found"));

        return encryptionService.decrypt(
                credential.getEncryptedApiKey());
    }

    // GET ACTIVE CREDENTIAL
    @Transactional(readOnly = true)
    public InstaboxCredential getActiveCredential() {

        return repository.findFirstByActiveTrue()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No active Instabox credential found"));
    }

    // HELPERS

    private InstaboxCredential getCredential(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Instabox credential not found: " + id));
    }

    private void deactivateAll() {

        repository.findAll().forEach(credential -> {

            if (credential.isActive()) {
                credential.setActive(false);
                credential.setUpdatedAt(now());
            }
        });
    }

    private void validateName(String name) {

        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Credential name is required");
        }
    }

    private CredentialResponse toResponse(
            InstaboxCredential credential) {

        return new CredentialResponse(
                credential.getId(),
                credential.getName(),
                credential.getMachineId(),
                credential.isActive(),
                credential.getEncryptedApiKey() != null,
                credential.getCreatedAt(),
                credential.getUpdatedAt());
    }

    private LocalDateTime now() {
        return LocalDateTime.now(TIME_ZONE);
    }
}