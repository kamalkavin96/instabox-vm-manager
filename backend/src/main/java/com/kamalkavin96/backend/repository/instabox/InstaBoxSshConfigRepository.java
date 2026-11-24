package com.kamalkavin96.backend.repository.instabox;

import com.kamalkavin96.backend.entity.instabox.InstaBoxSshConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface InstaBoxSshConfigRepository extends JpaRepository<InstaBoxSshConfig, Long> {
    Optional<InstaBoxSshConfig> findByMachineId(String machineId);

    void deleteByMachineId(String machineId);

    @Query("SELECT DISTINCT c.machineId FROM InstaBoxSshConfig c WHERE c.machineId IS NOT NULL AND c.host IS NOT NULL AND c.username IS NOT NULL")
    List<String> findAllConfiguredMachineIds();
}