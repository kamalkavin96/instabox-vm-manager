package com.kamalkavin96.backend.repository;

import com.kamalkavin96.backend.entity.SshCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SshCredentialRepository extends JpaRepository<SshCredential, Long> {

    List<SshCredential> findByActiveTrue();

    List<SshCredential> findByMachineId(String machineId);

    List<SshCredential> findByActiveTrueAndMachineId(String machineId);
}