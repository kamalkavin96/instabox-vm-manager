package com.kamalkavin96.backend.repository.instabox;

import com.kamalkavin96.backend.entity.instabox.InstaboxMachine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstaboxMachineRepository
        extends JpaRepository<InstaboxMachine, Long> {

    Optional<InstaboxMachine> findByMachineId(String machineId);

    boolean existsByMachineId(String machineId);

    List<InstaboxMachine> findByOrganizationId(String organizationId);

    long countByOrganizationId(String organizationId);

    void deleteByOrganizationId(String organizationId);
}