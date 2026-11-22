package com.kamalkavin96.backend.dto.instabox.response;


import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.AuthType;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.HostKeyPolicy;
import com.kamalkavin96.backend.entity.instabox.MachineSftpConfig.TransferMode;

import java.time.Instant;
import java.util.Map;

public record SftpConfigResponse(
        Long id,
        String machineId,
        String hostname,
        Integer port,
        String username,
        AuthType authType,
        String identityFile,
        boolean hasPrivateKey,
        boolean hasPassword,
        boolean hasPassphrase,
        TransferMode transferMode,
        String remotePath,
        String localPath,
        Boolean preservePermissions,
        Integer maxConcurrentTransfers,
        HostKeyPolicy hostKeyPolicy,
        String knownHostFingerprint,
        Integer connectTimeoutSec,
        Integer keepAliveIntervalSec,
        Map<String, String> customOptions,
        Instant lastConnectedAt,
        String lastConnectionStatus,
        String lastConnectionError,
        Instant createdAt,
        Instant updatedAt
) {}