package com.kamalkavin96.backend.dto.response;

import java.time.LocalDateTime;

public record CredentialResponse(
        Long id,
        String name,
        String machineId,
        boolean active,
        boolean apiKeyConfigured,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}