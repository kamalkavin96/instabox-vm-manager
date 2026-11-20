package com.kamalkavin96.backend.dto.instabox.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstaboxMachineResponse {

    private Long id;
    private String machineId;
    private String name;

    private String desiredState;
    private String state;
    private Long revision;
    private String operationId;

    private String templateId;
    private String templateVersion;
    private String templateDigest;

    private Integer vcpus;
    private Integer memMiB;
    private Integer persistentDiskGiB;
    private Integer rootDiskGiB;

    private Integer storageSizeGiB;
    private String storageMountPath;
    private Boolean storagePersistent;
    private Boolean storageSynced;
    private Long snapshotSeq;

    private Boolean runtimeReady;
    private Boolean processesPreserved;

    private Integer autoSuspendAfterSeconds;
    private Integer maxRunMinutes;

    private OffsetDateTime runStartedAt;
    private OffsetDateTime readyAt;
    private OffsetDateTime cooldownUntil;

    private Map<String, Object> metadata;

    private Boolean vault;
    private String guestUser;

    private String organizationId;
    private Boolean free;
    private Integer oomKills;

    private OffsetDateTime machineCreatedAt;
    private OffsetDateTime machineUpdatedAt;
    private OffsetDateTime syncedAt;
}