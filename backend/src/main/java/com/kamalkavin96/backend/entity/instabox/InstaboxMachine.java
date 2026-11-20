package com.kamalkavin96.backend.entity.instabox;

import jakarta.persistence.*;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;

@Entity
@Table(name = "instabox_machines")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class InstaboxMachine {

    // Internal database ID
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Basic Information
    @Column(name = "machine_id", nullable = false, unique = true)
    private String machineId;

    @Column(name = "name")
    private String name;

    // Machine State
    @Column(name = "desired_state")
    private String desiredState;

    @Column(name = "state")
    private String state;

    @Column(name = "revision")
    private Long revision;

    @Column(name = "operation_id")
    private String operationId;

    // Template Information
    @Column(name = "template_id")
    private String templateId;

    @Column(name = "template_version")
    private String templateVersion;

    @Column(name = "template_digest")
    private String templateDigest;

    // Machine Specifications
    @Column(name = "vcpus")
    private Integer vcpus;

    @Column(name = "mem_mib")
    private Integer memMiB;

    @Column(name = "persistent_disk_gib")
    private Integer persistentDiskGiB;

    @Column(name = "root_disk_gib")
    private Integer rootDiskGiB;

    // Storage Information
    @Column(name = "storage_size_gib")
    private Integer storageSizeGiB;

    @Column(name = "storage_mount_path")
    private String storageMountPath;

    @Column(name = "storage_persistent")
    private Boolean storagePersistent;

    @Column(name = "storage_synced")
    private Boolean storageSynced;

    @Column(name = "snapshot_seq")
    private Long snapshotSeq;

    // Runtime Information
    @Column(name = "runtime_ready")
    private Boolean runtimeReady;

    @Column(name = "processes_preserved")
    private Boolean processesPreserved;

    // Lifecycle Configuration
    @Column(name = "auto_suspend_after_seconds")
    private Integer autoSuspendAfterSeconds;

    @Column(name = "max_run_minutes")
    private Integer maxRunMinutes;

    // Runtime Timestamps
    @Column(name = "run_started_at")
    private OffsetDateTime runStartedAt;

    @Column(name = "ready_at")
    private OffsetDateTime readyAt;

    @Column(name = "cooldown_until")
    private OffsetDateTime cooldownUntil;

    // Additional Metadata (PostgreSQL JSONB)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    // Security Information
    @Column(name = "vault")
    private Boolean vault;

    @Column(name = "guest_user")
    private String guestUser;

    // Organization Information
    @Column(name = "org_id")
    private String organizationId;

    // Billing Information
    @Column(name = "free")
    private Boolean free;

    // Monitoring Information
    @Column(name = "oom_kills")
    private Integer oomKills;

    // Instabox Timestamps
    @Column(name = "machine_created_at")
    private OffsetDateTime machineCreatedAt;

    @Column(name = "machine_updated_at")
    private OffsetDateTime machineUpdatedAt;

    // Local Synchronization Timestamp
    @Column(name = "synced_at")
    private OffsetDateTime syncedAt;
}