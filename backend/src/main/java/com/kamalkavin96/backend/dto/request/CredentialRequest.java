package com.kamalkavin96.backend.dto.request;

public record CredentialRequest(
        String name,
        String apiKey,
        String machineId,
        Boolean active
) {
}