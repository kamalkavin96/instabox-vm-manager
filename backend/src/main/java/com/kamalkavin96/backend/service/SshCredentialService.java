package com.kamalkavin96.backend.service;

import com.kamalkavin96.backend.dto.request.SshCredentialRequest;
import com.kamalkavin96.backend.dto.response.SshCredentialResponse;
import com.kamalkavin96.backend.entity.SshAuthType;
import com.kamalkavin96.backend.entity.SshCredential;
import com.kamalkavin96.backend.repository.SshCredentialRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional
public class SshCredentialService {

    private final SshCredentialRepository repository;

    private final SecretEncryptionService encryptionService;

    public SshCredentialService(
            SshCredentialRepository repository,
            SecretEncryptionService encryptionService) {

        this.repository = repository;
        this.encryptionService = encryptionService;
    }

    // CREATE
    public SshCredentialResponse create(SshCredentialRequest request) {

        validateCredentials(request);

        SshCredential credential = new SshCredential();

        credential.setName(request.getName());
        credential.setHost(request.getHost());
        credential.setPort(request.getPort());
        credential.setUsername(request.getUsername());
        credential.setAuthType(request.getAuthType());
        credential.setMachineId(request.getMachineId());

        credential.setActive(
                request.getActive() == null || request.getActive()
        );

        applySecrets(credential, request);

        return toResponse(repository.save(credential));
    }

    // GET ALL
    @Transactional(readOnly = true)
    public List<SshCredentialResponse> getAll() {

        return repository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // GET ACTIVE
    @Transactional(readOnly = true)
    public List<SshCredentialResponse> getActive() {

        return repository.findByActiveTrue()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // GET BY ID
    @Transactional(readOnly = true)
    public SshCredentialResponse getById(Long id) {

        return toResponse(findById(id));
    }

    // GET BY MACHINE ID
    @Transactional(readOnly = true)
    public List<SshCredentialResponse> getByMachineId(String machineId) {

        return repository.findByMachineId(machineId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // UPDATE
    public SshCredentialResponse update(
            Long id,
            SshCredentialRequest request) {

        validateCredentials(request);

        SshCredential credential = findById(id);

        credential.setName(request.getName());
        credential.setHost(request.getHost());
        credential.setPort(request.getPort());
        credential.setUsername(request.getUsername());
        credential.setAuthType(request.getAuthType());
        credential.setMachineId(request.getMachineId());

        if (request.getActive() != null) {
            credential.setActive(request.getActive());
        }

        applySecrets(credential, request);

        return toResponse(repository.save(credential));
    }

    // ENABLE / DISABLE
    public SshCredentialResponse updateStatus(Long id, boolean active) {

        SshCredential credential = findById(id);

        credential.setActive(active);

        return toResponse(repository.save(credential));
    }

    // DELETE
    public void delete(Long id) {

        SshCredential credential = findById(id);

        repository.delete(credential);
    }

    // FIND ENTITY
    private SshCredential findById(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "SSH credential not found with ID: " + id
                ));
    }

    // VALIDATE AUTHENTICATION
    private void validateCredentials(SshCredentialRequest request) {

        if (request.getAuthType() == SshAuthType.PRIVATE_KEY && (request.getPrivateKey() == null
                    || request.getPrivateKey().isBlank())) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Private key is required for PRIVATE_KEY authentication"
                );
            }
        

        if (request.getAuthType() == SshAuthType.PASSWORD && (request.getPassword() == null
                    || request.getPassword().isBlank())) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Password is required for PASSWORD authentication"
                );
            }
        

        if (request.getPort() == null
                || request.getPort() < 1
                || request.getPort() > 65535) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Port must be between 1 and 65535"
            );
        }
    }

    // ENCRYPT AND SAVE SECRETS
    private void applySecrets(
            SshCredential credential,
            SshCredentialRequest request) {

        if (request.getAuthType() == SshAuthType.PRIVATE_KEY) {

            if (request.getPrivateKey() != null
                    && !request.getPrivateKey().isBlank()) {

                credential.setEncryptedPrivateKey(
                        encryptionService.encrypt(request.getPrivateKey())
                );
            }

            if (request.getPassphrase() != null) {

                credential.setEncryptedPassphrase(
                        encryptionService.encrypt(request.getPassphrase())
                );
            }

            credential.setEncryptedPassword(null);
        }

        if (request.getAuthType() == SshAuthType.PASSWORD) {

            if (request.getPassword() != null
                    && !request.getPassword().isBlank()) {

                credential.setEncryptedPassword(
                        encryptionService.encrypt(request.getPassword())
                );
            }

            credential.setEncryptedPrivateKey(null);
            credential.setEncryptedPassphrase(null);
        }
    }

    // ENTITY TO RESPONSE DTO
    private SshCredentialResponse toResponse(
            SshCredential credential) {

        return SshCredentialResponse.builder()
                .id(credential.getId())
                .name(credential.getName())
                .host(credential.getHost())
                .port(credential.getPort())
                .username(credential.getUsername())
                .authType(credential.getAuthType())
                .machineId(credential.getMachineId())
                .active(credential.isActive())
                .createdAt(credential.getCreatedAt())
                .updatedAt(credential.getUpdatedAt())
                .hasPrivateKey(
                        credential.getEncryptedPrivateKey() != null
                )
                .hasPassword(
                        credential.getEncryptedPassword() != null
                )
                .hasPassphrase(
                        credential.getEncryptedPassphrase() != null
                )
                .build();
    }
}