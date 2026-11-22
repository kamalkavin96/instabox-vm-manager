package com.kamalkavin96.backend.repository.instabox;

import com.kamalkavin96.backend.entity.instabox.InstaBoxSshConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InstaBoxSshConfigRepository extends JpaRepository<InstaBoxSshConfig, Long> {
    Optional<InstaBoxSshConfig> findByMachineId(String machineId);
    void deleteByMachineId(String machineId);
}