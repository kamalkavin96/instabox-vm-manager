package com.kamalkavin96.backend.dto.response;

import tools.jackson.databind.JsonNode;

import java.util.List;

public record BulkMachineResponse(
        int total,
        int succeeded,
        int failed,
        List<MachineResult> results
) {

    public record MachineResult(
            String machineId,
            boolean success,
            JsonNode data,
            String error
    ) {
    }
}