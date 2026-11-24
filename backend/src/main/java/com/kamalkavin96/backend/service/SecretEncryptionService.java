package com.kamalkavin96.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class SecretEncryptionService {

    private static final String ALGORITHM = "AES/GCM/NoPadding";

    private static final int IV_LENGTH = 12;

    private static final int TAG_LENGTH = 128;

    private final SecretKeySpec secretKey;

    private final SecureRandom secureRandom = new SecureRandom();

    public SecretEncryptionService(
            @Value("${app.security.encryption-key}") String encryptionKey) {

        byte[] key = Base64.getDecoder().decode(encryptionKey);

        if (key.length != 32) {
            throw new IllegalArgumentException(
                    "Encryption key must be exactly 32 bytes (Base64 encoded)"
            );
        }

        this.secretKey = new SecretKeySpec(key, "AES");
    }

    public String encrypt(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);

            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    secretKey,
                    new GCMParameterSpec(TAG_LENGTH, iv)
            );

            byte[] encrypted = cipher.doFinal(
                    value.getBytes(java.nio.charset.StandardCharsets.UTF_8)
            );

            ByteBuffer buffer = ByteBuffer.allocate(
                    iv.length + encrypted.length
            );

            buffer.put(iv);
            buffer.put(encrypted);

            return Base64.getEncoder().encodeToString(buffer.array());

        } catch (Exception e) {
            throw new IllegalStateException("Credential encryption failed", e);
        }
    }

    public String decrypt(String encryptedValue) {

        if (encryptedValue == null || encryptedValue.isBlank()) {
            return null;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedValue);

            ByteBuffer buffer = ByteBuffer.wrap(decoded);

            byte[] iv = new byte[IV_LENGTH];
            buffer.get(iv);

            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);

            Cipher cipher = Cipher.getInstance(ALGORITHM);

            cipher.init(
                    Cipher.DECRYPT_MODE,
                    secretKey,
                    new GCMParameterSpec(TAG_LENGTH, iv)
            );

            byte[] decrypted = cipher.doFinal(encrypted);

            return new String(
                    decrypted,
                    java.nio.charset.StandardCharsets.UTF_8
            );

        } catch (Exception e) {
            throw new IllegalStateException("Credential decryption failed", e);
        }
    }
}