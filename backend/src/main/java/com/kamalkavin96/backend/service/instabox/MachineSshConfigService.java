package com.kamalkavin96.backend.service.instabox;

import com.kamalkavin96.backend.dto.instabox.ConnectionTelemetryRequest;
import com.kamalkavin96.backend.dto.instabox.request.SshConfigRequest;
import com.kamalkavin96.backend.dto.instabox.response.SshConfigResponse;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.AuthType;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.HostKeyPolicy;
import com.kamalkavin96.backend.entity.instabox.MachineSshConfig;
import com.kamalkavin96.backend.repository.instabox.MachineSshConfigRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class MachineSshConfigService {

    private final MachineSshConfigRepository sshConfigRepository;

    public MachineSshConfigService(MachineSshConfigRepository sshConfigRepository) {
        this.sshConfigRepository = sshConfigRepository;
    }

    @Transactional(readOnly = true)
    public SshConfigResponse getByMachineId(String machineId) {
        MachineSshConfig entity = sshConfigRepository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "SSH config not found for machine: " + machineId));
        return toResponse(entity);
    }

    public SshConfigResponse upsertByMachineId(String machineId, SshConfigRequest req) {
        validateEndpoint(req.hostname(), req.username(), req.port());

        MachineSshConfig entity = sshConfigRepository.findByMachineId(machineId)
                .orElseGet(() -> {
                    MachineSshConfig created = new MachineSshConfig();
                    created.setMachineId(machineId);
                    return created;
                });

        applyRequest(entity, req);
        MachineSshConfig saved = sshConfigRepository.save(entity);
        return toResponse(saved);
    }

    public void deleteByMachineId(String machineId) {
        MachineSshConfig entity = sshConfigRepository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "SSH config not found for machine: " + machineId));
        sshConfigRepository.delete(entity);
    }

    public SshConfigResponse recordConnectionTelemetry(String machineId, ConnectionTelemetryRequest telemetry) {
        MachineSshConfig entity = sshConfigRepository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "SSH config not found for machine: " + machineId));

        entity.setLastConnectedAt(Instant.now());
        entity.setLastConnectionStatus(telemetry.status());
        entity.setLastConnectionError(telemetry.errorMessage());
        if (StringUtils.hasText(telemetry.hostFingerprint())) {
            entity.setKnownHostFingerprint(telemetry.hostFingerprint().trim());
        }

        return toResponse(sshConfigRepository.save(entity));
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

    private void applyRequest(MachineSshConfig entity, SshConfigRequest req) {
        String cleanHost = req.hostname().trim();
        entity.setHostname(cleanHost);
        entity.setPort(req.port() != null ? req.port() : 22);
        entity.setUsername(req.username().trim());
        entity.setHostAlias(StringUtils.hasText(req.hostAlias()) ? req.hostAlias().trim() : cleanHost);
        entity.setAuthType(req.authType() != null ? req.authType() : AuthType.KEY);
        entity.setIdentityFile(StringUtils.hasText(req.identityFile()) ? req.identityFile().trim() : null);

        // Replace with your KMS/AES encryption helper before persisting secrets
        if (StringUtils.hasText(req.privateKey())) {
            entity.setPrivateKeyCiphertext(encryptSecret(req.privateKey()));
        }
        if (StringUtils.hasText(req.password())) {
            entity.setPasswordCiphertext(encryptSecret(req.password()));
        }
        if (StringUtils.hasText(req.passphrase())) {
            entity.setPassphraseCiphertext(encryptSecret(req.passphrase()));
        }

        entity.setProxyJump(StringUtils.hasText(req.proxyJump()) ? req.proxyJump().trim() : null);
        entity.setForwardAgent(req.forwardAgent() != null ? req.forwardAgent() : Boolean.FALSE);

        List<String> locals = new ArrayList<>();
        if (req.localForwards() != null) {
            for (String item : req.localForwards()) {
                if (StringUtils.hasText(item)) locals.add(item.trim());
            }
        }
        entity.setLocalForwards(locals);

        List<String> remotes = new ArrayList<>();
        if (req.remoteForwards() != null) {
            for (String item : req.remoteForwards()) {
                if (StringUtils.hasText(item)) remotes.add(item.trim());
            }
        }
        entity.setRemoteForwards(remotes);

        entity.setHostKeyPolicy(req.hostKeyPolicy() != null ? req.hostKeyPolicy() : HostKeyPolicy.ACCEPT_NEW);
        if (StringUtils.hasText(req.knownHostFingerprint())) {
            entity.setKnownHostFingerprint(req.knownHostFingerprint().trim());
        }
        entity.setConnectTimeoutSec(req.connectTimeoutSec() != null ? req.connectTimeoutSec() : 15);
        entity.setKeepAliveIntervalSec(req.keepAliveIntervalSec() != null ? req.keepAliveIntervalSec() : 60);

        Map<String, String> directives = new LinkedHashMap<>();
        if (req.customDirectives() != null) {
            req.customDirectives().forEach((k, v) -> {
                if (StringUtils.hasText(k) && StringUtils.hasText(v)) {
                    directives.put(k.trim(), v.trim());
                }
            });
        }
        entity.setCustomDirectives(directives);
    }

    private String encryptSecret(String rawValue) {
        // TODO: Plug in your envelope/AES encryption service here
        return rawValue;
    }

    private SshConfigResponse toResponse(MachineSshConfig e) {
        return new SshConfigResponse(
                e.getId(),
                e.getMachineId(),
                e.getHostAlias(),
                e.getHostname(),
                e.getPort(),
                e.getUsername(),
                e.getAuthType(),
                e.getIdentityFile(),
                StringUtils.hasText(e.getPrivateKeyCiphertext()),
                StringUtils.hasText(e.getPasswordCiphertext()),
                StringUtils.hasText(e.getPassphraseCiphertext()),
                e.getProxyJump(),
                e.getForwardAgent(),
                e.getLocalForwards() != null ? List.copyOf(e.getLocalForwards()) : List.of(),
                e.getRemoteForwards() != null ? List.copyOf(e.getRemoteForwards()) : List.of(),
                e.getHostKeyPolicy(),
                e.getKnownHostFingerprint(),
                e.getConnectTimeoutSec(),
                e.getKeepAliveIntervalSec(),
                e.getCustomDirectives() != null ? Map.copyOf(e.getCustomDirectives()) : Map.of(),
                e.getLastConnectedAt(),
                e.getLastConnectionStatus(),
                e.getLastConnectionError(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}