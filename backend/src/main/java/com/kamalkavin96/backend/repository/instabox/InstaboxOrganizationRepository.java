package com.kamalkavin96.backend.repository.instabox;

import com.kamalkavin96.backend.entity.instabox.InstaboxOrganization;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InstaboxOrganizationRepository
        extends JpaRepository<InstaboxOrganization, Long> {

    Optional<InstaboxOrganization> findByOrganizationId(String organizationId);

    boolean existsByOrganizationId(String organizationId);
}