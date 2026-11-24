package com.kamalkavin96.backend.dto.instabox.request;

public record InstaBoxConnectionRequest(
        String host,
        Integer port,
        String username,
        String secretKey
) {}