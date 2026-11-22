package com.kamalkavin96.backend.repository.instabox;

import com.kamalkavin96.backend.entity.instabox.MachineSftpConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MachineSftpConfigRepository extends JpaRepository<MachineSftpConfig, Long> {
    Optional<MachineSftpConfig> findByMachineId(String machineId);
    boolean existsByMachineId(String machineId);
}