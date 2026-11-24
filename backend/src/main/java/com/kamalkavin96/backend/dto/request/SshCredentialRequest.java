package com.kamalkavin96.backend.dto.request;

import com.kamalkavin96.backend.entity.SshAuthType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SshCredentialRequest {

    @NotBlank(message = "Credential name is required")
    private String name;

    @NotBlank(message = "Host is required")
    private String host;

    @NotNull(message = "Port is required")
    @Min(value = 1, message = "Port must be between 1 and 65535")
    private Integer port = 22;

    @NotBlank(message = "Username is required")
    private String username;

    @NotNull(message = "Authentication type is required")
    private SshAuthType authType;

    // PRIVATE_KEY authentication
    private String privateKey;

    private String passphrase;

    // PASSWORD authentication
    private String password;

    private String machineId;

    private Boolean active = true;
}