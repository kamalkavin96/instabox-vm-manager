package com.kamalkavin96.backend.dto.response;

import com.kamalkavin96.backend.entity.SshAuthType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SshCredentialResponse {

    private Long id;

    private String name;

    private String host;

    private Integer port;

    private String username;

    private SshAuthType authType;

    private String machineId;

    private boolean active;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private boolean hasPrivateKey;

    private boolean hasPassword;

    private boolean hasPassphrase;
}