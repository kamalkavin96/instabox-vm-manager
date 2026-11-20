package com.kamalkavin96.backend.dto.request;

public record ResumeMachineRequest( Boolean vault) {
    public ResumeMachineRequest {
        vault = vault == null ? true : vault;
    }
}