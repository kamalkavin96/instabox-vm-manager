package com.kamalkavin96.backend.repository.instabox;

import com.kamalkavin96.backend.entity.instabox.MachineSshConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MachineSshConfigRepository extends JpaRepository<MachineSshConfig, Long> {
    Optional<MachineSshConfig> findByMachineId(String machineId);
    boolean existsByMachineId(String machineId);
}