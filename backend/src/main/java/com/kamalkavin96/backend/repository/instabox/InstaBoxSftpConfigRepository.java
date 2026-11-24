package com.kamalkavin96.backend.repository.instabox;

import com.kamalkavin96.backend.entity.instabox.InstaBoxSftpConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InstaBoxSftpConfigRepository extends JpaRepository<InstaBoxSftpConfig, Long> {
    Optional<InstaBoxSftpConfig> findByMachineId(String machineId);
    void deleteByMachineId(String machineId);
}