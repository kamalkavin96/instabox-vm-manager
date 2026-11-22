package com.kamalkavin96.backend.dto.instabox.request;

import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.AuthType;
import com.kamalkavin96.backend.entity.instabox.BaseConnectionConfig.HostKeyPolicy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record SshConfigRequest(
        String hostAlias,
        String hostname,
        Integer port,
        String username,
        AuthType authType,
        String identityFile,
        String privateKey,
        String password,
        String passphrase,
        String proxyJump,
        Boolean forwardAgent,
        List<String> localForwards,
        List<String> remoteForwards,
        HostKeyPolicy hostKeyPolicy,
        String knownHostFingerprint,
        Integer connectTimeoutSec,
        Integer keepAliveIntervalSec,
        Map<String, String> customDirectives
) {
    public SshConfigRequest {
        localForwards = localForwards != null ? localForwards : new ArrayList<>();
        remoteForwards = remoteForwards != null ? remoteForwards : new ArrayList<>();
        customDirectives = customDirectives != null ? customDirectives : new LinkedHashMap<>();
    }
}