package com.kamalkavin96.backend.service.instabox;

import com.kamalkavin96.backend.dto.instabox.ConnectionTelemetryRequest;
import com.kamalkavin96.backend.dto.instabox.request.SftpConfigRequest;
import com.kamalkavin96.backend.dto.instabox.response.SftpConfigResponse;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.AuthType;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.HostKeyPolicy;
import com.kamalkavin96.backend.entity.instabox.MachineSftpConfig;
import com.kamalkavin96.backend.entity.instabox.MachineSftpConfig.TransferMode;
import com.kamalkavin96.backend.repository.instabox.MachineSftpConfigRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Transactional
public class MachineSftpConfigService {

    private final MachineSftpConfigRepository sftpConfigRepository;

    public MachineSftpConfigService(MachineSftpConfigRepository sftpConfigRepository) {
        this.sftpConfigRepository = sftpConfigRepository;
    }

    @Transactional(readOnly = true)
    public SftpConfigResponse getByMachineId(String machineId) {
        MachineSftpConfig entity = sftpConfigRepository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "SFTP config not found for machine: " + machineId));
        return toResponse(entity);
    }

    public SftpConfigResponse upsertByMachineId(String machineId, SftpConfigRequest req) {
        validateEndpoint(req.hostname(), req.username(), req.port());

        MachineSftpConfig entity = sftpConfigRepository.findByMachineId(machineId)
                .orElseGet(() -> {
                    MachineSftpConfig created = new MachineSftpConfig();
                    created.setMachineId(machineId);
                    return created;
                });

        applyRequest(entity, req);
        MachineSftpConfig saved = sftpConfigRepository.save(entity);
        return toResponse(saved);
    }

    public void deleteByMachineId(String machineId) {
        MachineSftpConfig entity = sftpConfigRepository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "SFTP config not found for machine: " + machineId));
        sftpConfigRepository.delete(entity);
    }

    public SftpConfigResponse recordConnectionTelemetry(String machineId, ConnectionTelemetryRequest telemetry) {
        MachineSftpConfig entity = sftpConfigRepository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "SFTP config not found for machine: " + machineId));

        entity.setLastConnectedAt(Instant.now());
        entity.setLastConnectionStatus(telemetry.status());
        entity.setLastConnectionError(telemetry.errorMessage());
        if (StringUtils.hasText(telemetry.hostFingerprint())) {
            entity.setKnownHostFingerprint(telemetry.hostFingerprint().trim());
        }

        return toResponse(sftpConfigRepository.save(entity));
    }

    private void validateEndpoint(String hostname, String username, Integer port) {
        if (!StringUtils.hasText(hostname)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "hostname is required");
        }
        if (!StringUtils.hasText(username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username is required");
        }
        int effectivePort = port != null ? port : 22;
        if (effectivePort < 1 || effectivePort > 65535) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "port must be between 1 and 65535");
        }
    }

    private void applyRequest(MachineSftpConfig entity, SftpConfigRequest req) {
        entity.setHostname(req.hostname().trim());
        entity.setPort(req.port() != null ? req.port() : 22);
        entity.setUsername(req.username().trim());
        entity.setAuthType(req.authType() != null ? req.authType() : AuthType.KEY);
        entity.setIdentityFile(StringUtils.hasText(req.identityFile()) ? req.identityFile().trim() : null);

        if (StringUtils.hasText(req.privateKey())) {
            entity.setPrivateKeyCiphertext(encryptSecret(req.privateKey()));
        }
        if (StringUtils.hasText(req.password())) {
            entity.setPasswordCiphertext(encryptSecret(req.password()));
        }
        if (StringUtils.hasText(req.passphrase())) {
            entity.setPassphraseCiphertext(encryptSecret(req.passphrase()));
        }

        entity.setTransferMode(req.transferMode() != null ? req.transferMode() : TransferMode.SFTP);
        entity.setRemotePath(StringUtils.hasText(req.remotePath()) ? req.remotePath().trim() : "/");
        entity.setLocalPath(StringUtils.hasText(req.localPath()) ? req.localPath().trim() : null);
        entity.setPreservePermissions(req.preservePermissions() != null ? req.preservePermissions() : Boolean.TRUE);
        entity.setMaxConcurrentTransfers(
                req.maxConcurrentTransfers() != null && req.maxConcurrentTransfers() > 0
                        ? req.maxConcurrentTransfers()
                        : 4
        );

        entity.setHostKeyPolicy(req.hostKeyPolicy() != null ? req.hostKeyPolicy() : HostKeyPolicy.ACCEPT_NEW);
        if (StringUtils.hasText(req.knownHostFingerprint())) {
            entity.setKnownHostFingerprint(req.knownHostFingerprint().trim());
        }
        entity.setConnectTimeoutSec(req.connectTimeoutSec() != null ? req.connectTimeoutSec() : 15);
        entity.setKeepAliveIntervalSec(req.keepAliveIntervalSec() != null ? req.keepAliveIntervalSec() : 60);

        Map<String, String> options = new LinkedHashMap<>();
        if (req.customOptions() != null) {
            req.customOptions().forEach((k, v) -> {
                if (StringUtils.hasText(k) && StringUtils.hasText(v)) {
                    options.put(k.trim(), v.trim());
                }
            });
        }
        entity.setCustomOptions(options);
    }

    private String encryptSecret(String rawValue) {
        // TODO: Plug in your envelope/AES encryption service here
        return rawValue;
    }

    private SftpConfigResponse toResponse(MachineSftpConfig e) {
        return new SftpConfigResponse(
                e.getId(),
                e.getMachineId(),
                e.getHostname(),
                e.getPort(),
                e.getUsername(),
                e.getAuthType(),
                e.getIdentityFile(),
                StringUtils.hasText(e.getPrivateKeyCiphertext()),
                StringUtils.hasText(e.getPasswordCiphertext()),
                StringUtils.hasText(e.getPassphraseCiphertext()),
                e.getTransferMode(),
                e.getRemotePath(),
                e.getLocalPath(),
                e.getPreservePermissions(),
                e.getMaxConcurrentTransfers(),
                e.getHostKeyPolicy(),
                e.getKnownHostFingerprint(),
                e.getConnectTimeoutSec(),
                e.getKeepAliveIntervalSec(),
                e.getCustomOptions() != null ? Map.copyOf(e.getCustomOptions()) : Map.of(),
                e.getLastConnectedAt(),
                e.getLastConnectionStatus(),
                e.getLastConnectionError(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}