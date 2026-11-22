package com.kamalkavin96.backend.entity.instabox;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

import java.time.Instant;

@MappedSuperclass
public abstract class BaseConnectionConfig {

    public enum AuthType {
        KEY,
        PASSWORD,
        AGENT
    }

    public enum HostKeyPolicy {
        ACCEPT_NEW,
        STRICT,
        NO
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "machine_id", nullable = false, length = 100)
    private String machineId;

    @Column(name = "hostname", nullable = false, length = 255)
    private String hostname;

    @Column(name = "port", nullable = false)
    private Integer port = 22;

    @Column(name = "username", nullable = false, length = 120)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_type", nullable = false, length = 20)
    private AuthType authType = AuthType.KEY;

    @Column(name = "identity_file", length = 500)
    private String identityFile;

    @Lob
    @Column(name = "private_key_ciphertext")
    private String privateKeyCiphertext;

    @Column(name = "password_ciphertext", length = 1024)
    private String passwordCiphertext;

    @Column(name = "passphrase_ciphertext", length = 1024)
    private String passphraseCiphertext;

    @Enumerated(EnumType.STRING)
    @Column(name = "host_key_policy", nullable = false, length = 20)
    private HostKeyPolicy hostKeyPolicy = HostKeyPolicy.ACCEPT_NEW;

    @Column(name = "known_host_fingerprint", length = 255)
    private String knownHostFingerprint;

    @Column(name = "connect_timeout_sec", nullable = false)
    private Integer connectTimeoutSec = 15;

    @Column(name = "keep_alive_interval_sec", nullable = false)
    private Integer keepAliveIntervalSec = 60;

    @Column(name = "last_connected_at")
    private Instant lastConnectedAt;

    @Column(name = "last_connection_status", length = 32)
    private String lastConnectionStatus;

    @Column(name = "last_connection_error", length = 1000)
    private String lastConnectionError;

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

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }

    public Integer getPort() { return port; }
    public void setPort(Integer port) { this.port = port; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public AuthType getAuthType() { return authType; }
    public void setAuthType(AuthType authType) { this.authType = authType; }

    public String getIdentityFile() { return identityFile; }
    public void setIdentityFile(String identityFile) { this.identityFile = identityFile; }

    public String getPrivateKeyCiphertext() { return privateKeyCiphertext; }
    public void setPrivateKeyCiphertext(String privateKeyCiphertext) { this.privateKeyCiphertext = privateKeyCiphertext; }

    public String getPasswordCiphertext() { return passwordCiphertext; }
    public void setPasswordCiphertext(String passwordCiphertext) { this.passwordCiphertext = passwordCiphertext; }

    public String getPassphraseCiphertext() { return passphraseCiphertext; }
    public void setPassphraseCiphertext(String passphraseCiphertext) { this.passphraseCiphertext = passphraseCiphertext; }

    public HostKeyPolicy getHostKeyPolicy() { return hostKeyPolicy; }
    public void setHostKeyPolicy(HostKeyPolicy hostKeyPolicy) { this.hostKeyPolicy = hostKeyPolicy; }

    public String getKnownHostFingerprint() { return knownHostFingerprint; }
    public void setKnownHostFingerprint(String knownHostFingerprint) { this.knownHostFingerprint = knownHostFingerprint; }

    public Integer getConnectTimeoutSec() { return connectTimeoutSec; }
    public void setConnectTimeoutSec(Integer connectTimeoutSec) { this.connectTimeoutSec = connectTimeoutSec; }

    public Integer getKeepAliveIntervalSec() { return keepAliveIntervalSec; }
    public void setKeepAliveIntervalSec(Integer keepAliveIntervalSec) { this.keepAliveIntervalSec = keepAliveIntervalSec; }

    public Instant getLastConnectedAt() { return lastConnectedAt; }
    public void setLastConnectedAt(Instant lastConnectedAt) { this.lastConnectedAt = lastConnectedAt; }

    public String getLastConnectionStatus() { return lastConnectionStatus; }
    public void setLastConnectionStatus(String lastConnectionStatus) { this.lastConnectionStatus = lastConnectionStatus; }

    public String getLastConnectionError() { return lastConnectionError; }
    public void setLastConnectionError(String lastConnectionError) { this.lastConnectionError = lastConnectionError; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}