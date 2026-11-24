package com.kamalkavin96.backend.entity.docker;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(
        name = "machine_docker_snapshots",
        indexes = {
                @Index(name = "idx_docker_snap_machine_id", columnList = "machine_id", unique = true)
        }
)
public class MachineDockerSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "machine_id", nullable = false, unique = true, length = 100)
    private String machineId;

    @Column(name = "containers_json", columnDefinition = "TEXT")
    private String containersJson = "[]";

    @Column(name = "images_json", columnDefinition = "TEXT")
    private String imagesJson = "[]";

    @Column(name = "volumes_json", columnDefinition = "TEXT")
    private String volumesJson = "{\"Volumes\":[]}";

    @Column(name = "networks_json", columnDefinition = "TEXT")
    private String networksJson = "[]";

    @Column(name = "system_info_json", columnDefinition = "TEXT")
    private String systemInfoJson = "{}";

    @Column(name = "disk_usage_json", columnDefinition = "TEXT")
    private String diskUsageJson = "{}";

    @Column(name = "sync_status", nullable = false, length = 32)
    private String syncStatus = "PENDING"; // SUCCESS | FAILED | PENDING

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getMachineId() { return machineId; }
    public void setMachineId(String machineId) { this.machineId = machineId; }

    public String getContainersJson() { return containersJson; }
    public void setContainersJson(String containersJson) { this.containersJson = containersJson; }

    public String getImagesJson() { return imagesJson; }
    public void setImagesJson(String imagesJson) { this.imagesJson = imagesJson; }

    public String getVolumesJson() { return volumesJson; }
    public void setVolumesJson(String volumesJson) { this.volumesJson = volumesJson; }

    public String getNetworksJson() { return networksJson; }
    public void setNetworksJson(String networksJson) { this.networksJson = networksJson; }

    public String getSystemInfoJson() { return systemInfoJson; }
    public void setSystemInfoJson(String systemInfoJson) { this.systemInfoJson = systemInfoJson; }

    public String getDiskUsageJson() { return diskUsageJson; }
    public void setDiskUsageJson(String diskUsageJson) { this.diskUsageJson = diskUsageJson; }

    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public Instant getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(Instant lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}