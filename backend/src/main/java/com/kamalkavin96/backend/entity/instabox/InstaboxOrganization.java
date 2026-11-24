package com.kamalkavin96.backend.entity.instabox;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "instabox_organization")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class InstaboxOrganization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false, unique = true)
    private String organizationId;

    @Column(name = "org_name", nullable = false)
    private String organizationName;

    @Column(name = "api_key", nullable = false, length = 1000)
    private String apiKey;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

}