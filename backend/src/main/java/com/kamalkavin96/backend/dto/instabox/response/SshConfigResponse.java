package com.kamalkavin96.backend.dto.instabox.response;

import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.AuthType;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.HostKeyPolicy;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record SshConfigResponse(
        Long id,
        String machineId,
        String hostAlias,
        String hostname,
        Integer port,
        String username,
        AuthType authType,
        String identityFile,
        boolean hasPrivateKey,
        boolean hasPassword,
        boolean hasPassphrase,
        String proxyJump,
        Boolean forwardAgent,
        List<String> localForwards,
        List<String> remoteForwards,
        HostKeyPolicy hostKeyPolicy,
        String knownHostFingerprint,
        Integer connectTimeoutSec,
        Integer keepAliveIntervalSec,
        Map<String, String> customDirectives,
        Instant lastConnectedAt,
        String lastConnectionStatus,
        String lastConnectionError,
        Instant createdAt,
        Instant updatedAt
) {}