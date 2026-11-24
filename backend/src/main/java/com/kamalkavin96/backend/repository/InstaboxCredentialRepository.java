package com.kamalkavin96.backend.repository;

import com.kamalkavin96.backend.entity.InstaboxCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InstaboxCredentialRepository
        extends JpaRepository<InstaboxCredential, Long> {

    Optional<InstaboxCredential> findFirstByActiveTrue();
}