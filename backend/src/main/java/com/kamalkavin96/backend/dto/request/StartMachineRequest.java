package com.kamalkavin96.backend.dto.request;

public record StartMachineRequest(
        Boolean vault,
        Integer vcpus,
        Integer memMiB,
        Boolean acceptMinimumLease,
        Boolean rescue
) {

    public StartMachineRequest {
        vault = vault != null ? vault : true;
        vcpus = vcpus != null ? vcpus : 4;
        memMiB = memMiB != null ? memMiB : 8192;
        acceptMinimumLease = acceptMinimumLease != null && acceptMinimumLease;
        rescue = rescue != null && rescue;
    }
}