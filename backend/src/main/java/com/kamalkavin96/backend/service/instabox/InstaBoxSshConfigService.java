package com.kamalkavin96.backend.service.instabox;

import com.kamalkavin96.backend.dto.instabox.request.InstaBoxConnectionRequest;
import com.kamalkavin96.backend.dto.instabox.response.InstaBoxConnectionResponse;
import com.kamalkavin96.backend.entity.instabox.InstaBoxSshConfig;
import com.kamalkavin96.backend.repository.instabox.InstaBoxSshConfigRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class InstaBoxSshConfigService {

    private final InstaBoxSshConfigRepository repository;

    public InstaBoxSshConfigService(InstaBoxSshConfigRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public InstaBoxConnectionResponse getByMachineId(String machineId) {
        InstaBoxSshConfig entity = repository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "InstaBox SSH config not found for machine: " + machineId));
        return toResponse(entity);
    }

    public InstaBoxConnectionResponse upsertByMachineId(String machineId, InstaBoxConnectionRequest req) {
        if (req == null || !StringUtils.hasText(req.host()) || !StringUtils.hasText(req.username())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "host and username are required");
        }
        int port = req.port() != null ? req.port() : 2222;
        if (port < 1 || port > 65535) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "port must be between 1 and 65535");
        }

        InstaBoxSshConfig entity = repository.findByMachineId(machineId)
                .orElseGet(() -> {
                    InstaBoxSshConfig created = new InstaBoxSshConfig();
                    created.setMachineId(machineId);
                    return created;
                });

        entity.setHost(req.host().trim());
        entity.setPort(port);
        entity.setUsername(req.username().trim());

        if (StringUtils.hasText(req.secretKey())) {
            entity.setSecretKeyCiphertext(encryptSecret(req.secretKey()));
        }

        return toResponse(repository.save(entity));
    }

    public void deleteByMachineId(String machineId) {
        InstaBoxSshConfig entity = repository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "InstaBox SSH config not found for machine: " + machineId));
        repository.delete(entity);
    }

    private String encryptSecret(String raw) {
        // TODO: Plug in AES/KMS encryption before saving
        return raw;
    }

    private InstaBoxConnectionResponse toResponse(InstaBoxSshConfig e) {
        String cmd = "ssh -p " + e.getPort() + " " + e.getUsername() + "@" + e.getHost();
        return new InstaBoxConnectionResponse(
                e.getId(),
                e.getMachineId(),
                e.getHost(),
                e.getPort(),
                e.getUsername(),
                StringUtils.hasText(e.getSecretKeyCiphertext()),
                cmd,
                e.getLastConnectedAt(),
                e.getLastConnectionStatus(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}