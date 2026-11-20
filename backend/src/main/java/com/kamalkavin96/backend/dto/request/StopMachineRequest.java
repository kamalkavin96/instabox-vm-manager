package com.kamalkavin96.backend.dto.request;

public record StopMachineRequest(
        Integer timeoutSeconds,
        Boolean now
) {

    public StopMachineRequest {
        timeoutSeconds = timeoutSeconds != null ? timeoutSeconds : 30;
        now = now != null && now;
    }
}