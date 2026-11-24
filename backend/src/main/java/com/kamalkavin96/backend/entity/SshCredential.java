package com.kamalkavin96.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "ssh_credentials")
@Data 
@AllArgsConstructor
@NoArgsConstructor
public class SshCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "host", nullable = false)
    private String host;

    @Column(name = "port", nullable = false)
    private Integer port = 22;

    @Column(name = "username", nullable = false)
    private String username;

    // PRIVATE_KEY or PASSWORD
    @Enumerated(EnumType.STRING)
    @Column(name = "auth_type", nullable = false)
    private SshAuthType authType;

    // Encrypted SSH private key
    @Column(name = "encrypted_private_key", columnDefinition = "TEXT")
    private String encryptedPrivateKey;

    // Optional encrypted passphrase for private key
    @Column(name = "encrypted_passphrase", columnDefinition = "TEXT")
    private String encryptedPassphrase;

    // Optional encrypted SSH password
    @Column(name = "encrypted_password", columnDefinition = "TEXT")
    private String encryptedPassword;

    @Column(name = "machine_id")
    private String machineId;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}