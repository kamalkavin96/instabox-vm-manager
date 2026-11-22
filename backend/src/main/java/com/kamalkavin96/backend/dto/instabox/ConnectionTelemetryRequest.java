package com.kamalkavin96.backend.dto.instabox;

public record ConnectionTelemetryRequest(
        String status,
        String errorMessage,
        String hostFingerprint
) {}