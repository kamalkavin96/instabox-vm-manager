package com.kamalkavin96.backend.dto.instabox.response;

import java.time.Instant;

public record InstaBoxConnectionResponse(
        Long id,
        String machineId,
        String host,
        Integer port,
        String username,
        boolean hasSecretKey,
        String sshCommand,
        Instant lastConnectedAt,
        String lastConnectionStatus,
        Instant createdAt,
        Instant updatedAt
) {}