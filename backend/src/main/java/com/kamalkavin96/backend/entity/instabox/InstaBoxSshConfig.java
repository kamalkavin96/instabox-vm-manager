package com.kamalkavin96.backend.entity.instabox;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(
        name = "instabox_ssh_configs",
        indexes = {
                @Index(name = "idx_ib_ssh_machine_id", columnList = "machine_id", unique = true)
        }
)
public class InstaBoxSshConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "machine_id", nullable = false, unique = true, length = 100)
    private String machineId;

    @Column(name = "host", nullable = false, length = 255)
    private String host;

    @Column(name = "port", nullable = false)
    private Integer port = 2222;

    @Column(name = "username", nullable = false, length = 160)
    private String username;

    @Lob
    @Column(name = "secret_key_ciphertext")
    private String secretKeyCiphertext;

    @Column(name = "last_connected_at")
    private Instant lastConnectedAt;

    @Column(name = "last_connection_status", length = 32)
    private String lastConnectionStatus;

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

    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }

    public Integer getPort() { return port; }
    public void setPort(Integer port) { this.port = port; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getSecretKeyCiphertext() { return secretKeyCiphertext; }
    public void setSecretKeyCiphertext(String secretKeyCiphertext) { this.secretKeyCiphertext = secretKeyCiphertext; }

    public Instant getLastConnectedAt() { return lastConnectedAt; }
    public void setLastConnectedAt(Instant lastConnectedAt) { this.lastConnectedAt = lastConnectedAt; }

    public String getLastConnectionStatus() { return lastConnectionStatus; }
    public void setLastConnectionStatus(String lastConnectionStatus) { this.lastConnectionStatus = lastConnectionStatus; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}