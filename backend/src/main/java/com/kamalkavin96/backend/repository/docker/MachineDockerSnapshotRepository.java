package com.kamalkavin96.backend.repository.docker;

import com.kamalkavin96.backend.entity.docker.MachineDockerSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MachineDockerSnapshotRepository extends JpaRepository<MachineDockerSnapshot, Long> {
    Optional<MachineDockerSnapshot> findByMachineId(String machineId);
}
