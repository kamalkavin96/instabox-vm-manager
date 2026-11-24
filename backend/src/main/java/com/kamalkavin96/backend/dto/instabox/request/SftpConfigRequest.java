package com.kamalkavin96.backend.dto.instabox.request;

import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.AuthType;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.HostKeyPolicy;
import com.kamalkavin96.backend.entity.instabox.MachineSftpConfig.TransferMode;

import java.util.LinkedHashMap;
import java.util.Map;

public record SftpConfigRequest(
        String hostname,
        Integer port,
        String username,
        AuthType authType,
        String identityFile,
        String privateKey,
        String password,
        String passphrase,
        TransferMode transferMode,
        String remotePath,
        String localPath,
        Boolean preservePermissions,
        Integer maxConcurrentTransfers,
        HostKeyPolicy hostKeyPolicy,
        String knownHostFingerprint,
        Integer connectTimeoutSec,
        Integer keepAliveIntervalSec,
        Map<String, String> customOptions
) {
    public SftpConfigRequest {
        customOptions = customOptions != null ? customOptions : new LinkedHashMap<>();
    }
}