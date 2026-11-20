package com.kamalkavin96.backend.dto.instabox.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.util.Map;

@Data
public class InstaboxMachineRequest {

    // Basic Information
    @NotBlank(message = "Machine ID is required")
    private String machineId;

    private String name;

    // Template Information
    private String templateId;

    private String templateVersion;

    private String templateDigest;

    // Machine Specifications
    @Positive(message = "VCPUs must be greater than zero")
    private Integer vcpus;

    @Positive(message = "Memory must be greater than zero")
    private Integer memMiB;

    @PositiveOrZero(message = "Persistent disk size cannot be negative")
    private Integer persistentDiskGiB;

    @PositiveOrZero(message = "Root disk size cannot be negative")
    private Integer rootDiskGiB;

    // Storage Information
    @PositiveOrZero(message = "Storage size cannot be negative")
    private Integer storageSizeGiB;

    private String storageMountPath;

    private Boolean storagePersistent;

    private Boolean storageSynced;

    private Long snapshotSeq;

    // Runtime Information
    private Boolean runtimeReady;

    private Boolean processesPreserved;

    // Lifecycle Configuration
    @PositiveOrZero(message = "Auto suspend duration cannot be negative")
    private Integer autoSuspendAfterSeconds;

    @PositiveOrZero(message = "Maximum run duration cannot be negative")
    private Integer maxRunMinutes;

    // Additional Metadata
    private Map<String, Object> metadata;

    // Security Information
    private Boolean vault;

    private String guestUser;

    // Organization Information
    private String organizationId;

    // Billing Information
    private Boolean free;
}