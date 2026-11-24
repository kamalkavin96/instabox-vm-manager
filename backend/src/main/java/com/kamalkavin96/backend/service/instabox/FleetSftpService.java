package com.kamalkavin96.backend.service.instabox;

import com.kamalkavin96.backend.dto.instabox.SftpDtos.SftpEntry;
import com.kamalkavin96.backend.dto.instabox.SftpDtos.SftpListResponse;
import com.kamalkavin96.backend.dto.instabox.SftpDtos.TargetTransferResult;
import com.kamalkavin96.backend.dto.instabox.SftpDtos.TransferRequest;
import com.kamalkavin96.backend.dto.instabox.SftpDtos.TransferResponse;
import com.kamalkavin96.backend.entity.instabox.InstaBoxSftpConfig;
import com.kamalkavin96.backend.repository.instabox.InstaBoxSftpConfigRepository;
import jakarta.annotation.PostConstruct;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.keyverifier.AcceptAllServerKeyVerifier;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.common.keyprovider.FileKeyPairProvider;
import org.apache.sshd.common.util.security.SecurityUtils;
import org.apache.sshd.sftp.client.SftpClient;
import org.apache.sshd.sftp.client.SftpClientFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;

@Service
public class FleetSftpService {

    private static final Logger log = LoggerFactory.getLogger(FleetSftpService.class);

    private final InstaBoxSftpConfigRepository sftpConfigRepository;

    public FleetSftpService(InstaBoxSftpConfigRepository sftpConfigRepository) {
        this.sftpConfigRepository = sftpConfigRepository;
    }

    @PostConstruct
    void logCryptoSupport() {
        log.info("SSHD crypto: EdDSA supported = {}, BouncyCastle registered = {}",
                SecurityUtils.isEDDSACurveSupported(),
                SecurityUtils.isBouncyCastleRegistered());
    }

    private InstaBoxSftpConfig requireConfig(String machineId) {
        if (machineId == null || machineId.isBlank()) {
            throw new IllegalArgumentException("Machine ID is required");
        }
        return sftpConfigRepository.findByMachineId(machineId)
                .orElseThrow(
                        () -> new IllegalArgumentException("No SFTP connection configured for machine: " + machineId));
    }

    private void recordConnectionOutcome(InstaBoxSftpConfig config, String status) {
        try {
            config.setLastConnectedAt(Instant.now());
            config.setLastConnectionStatus(status);
            sftpConfigRepository.save(config);
        } catch (Exception ignored) {
        }
    }

    private String normalizePath(String raw) {
        if (raw == null || raw.isBlank()) {
            return "/";
        }
        String p = raw.replace('\\', '/').replaceAll("/+", "/");
        if (!p.startsWith("/")) {
            p = "/" + p;
        }
        if (p.length() > 1 && p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }

    private String joinPath(String base, String name) {
        String b = normalizePath(base);
        return "/".equals(b) ? "/" + name : b + "/" + name;
    }

    private String formatPermissions(SftpClient.Attributes attrs) {
        if (attrs == null) {
            return "-";
        }
        int perms = attrs.getPermissions();
        if (perms <= 0) {
            return "-";
        }
        return String.format(Locale.ROOT, "%04o", perms & 07777);
    }

    private int parseOctalMode(String modeStr, int fallback) {
        if (modeStr == null || modeStr.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(modeStr.trim(), 8) & 07777;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    /** Normalizes line endings and guarantees a trailing newline so the PEM/OpenSSH parser accepts it. */
    private String normalizeKey(String secret) {
        String s = secret.trim().replace("\r\n", "\n").replace("\r", "\n");
        return s + "\n";
    }

    private void addPrivateKeyIdentity(ClientSession session, String secret) throws Exception {
        Path tempKey = Files.createTempFile("instabox-sftp-", ".pem");
        try {
            try {
                Files.setPosixFilePermissions(tempKey, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException ignored) {
                // non-POSIX file system (e.g. Windows)
            }
            Files.writeString(tempKey, normalizeKey(secret), StandardCharsets.UTF_8);
            FileKeyPairProvider keyProvider = new FileKeyPairProvider(tempKey);
            for (KeyPair kp : keyProvider.loadKeys(session)) {
                session.addPublicKeyIdentity(kp);
            }
        } finally {
            Files.deleteIfExists(tempKey);
        }
    }

    private <T> T withSftp(String machineId, SftpOperation<T> op) throws Exception {
        InstaBoxSftpConfig config = requireConfig(machineId);
        int port = (config.getPort() != null && config.getPort() > 0) ? config.getPort() : 2222;

        // Default client only advertises signature algorithms supported at runtime.
        // Do NOT call setSignatureFactories(BuiltinSignatures.VALUES): it forces unsupported ones (e.g. ed25519).
        SshClient client = SshClient.setUpDefaultClient();
        client.setServerKeyVerifier(AcceptAllServerKeyVerifier.INSTANCE);
        client.start();

        try (ClientSession session = client.connect(config.getUsername(), config.getHost(), port)
                .verify(Duration.ofSeconds(15))
                .getSession()) {

            String secret = config.getSecretKeyCiphertext();
            if (secret != null && !secret.isBlank() && secret.contains("PRIVATE KEY")) {
                addPrivateKeyIdentity(session, secret);
            } else if (secret != null && !secret.isBlank()) {
                session.addPasswordIdentity(secret);
            }

            session.auth().verify(Duration.ofSeconds(15));

            SftpClientFactory factory = SftpClientFactory.instance();
            try (SftpClient sftp = factory.createSftpClient(session)) {
                T result = op.run(sftp);
                recordConnectionOutcome(config, "CONNECTED");
                return result;
            }
        } catch (Exception ex) {
            recordConnectionOutcome(config, "FAILED");
            throw ex;
        } finally {
            client.stop();
        }
    }

    public SftpListResponse listDirectory(String machineId, String rawPath) throws Exception {
        String normPath = normalizePath(rawPath);
        return withSftp(machineId, sftp -> {
            List<SftpEntry> list = new ArrayList<>();
            for (SftpClient.DirEntry dirEntry : sftp.readDir(normPath)) {
                String name = dirEntry.getFilename();
                if (".".equals(name) || "..".equals(name)) {
                    continue;
                }
                SftpClient.Attributes attrs = dirEntry.getAttributes();
                boolean isDir = attrs != null && attrs.isDirectory();
                String entryPath = joinPath(normPath, name);
                long size = attrs != null ? attrs.getSize() : 0L;
                long modifiedAt = attrs != null && attrs.getModifyTime() != null
                        ? attrs.getModifyTime().toMillis()
                        : 0L;
                list.add(new SftpEntry(
                        name,
                        entryPath,
                        isDir ? "dir" : "file",
                        size,
                        modifiedAt,
                        formatPermissions(attrs)));
            }
            list.sort(Comparator
                    .comparing((SftpEntry e) -> "dir".equals(e.type()) ? 0 : 1)
                    .thenComparing(e -> e.name().toLowerCase(Locale.ROOT)));
            return new SftpListResponse(normPath, list);
        });
    }

    public void createDirectory(String machineId, String rawPath) throws Exception {
        String normPath = normalizePath(rawPath);
        withSftp(machineId, sftp -> {
            ensureRemoteDirs(sftp, normPath);
            return null;
        });
    }

    private void ensureRemoteDirs(SftpClient sftp, String dirPath) throws IOException {
        String norm = normalizePath(dirPath);
        if ("/".equals(norm)) {
            return;
        }
        String[] parts = norm.substring(1).split("/");
        StringBuilder current = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) {
                continue;
            }
            current.append('/').append(part);
            String step = current.toString();
            try {
                sftp.stat(step);
            } catch (IOException ignored) {
                sftp.mkdir(step);
            }
        }
    }

    public void deleteEntry(String machineId, String rawPath) throws Exception {
        String normPath = normalizePath(rawPath);
        if ("/".equals(normPath)) {
            throw new IllegalArgumentException("Refusing to delete root directory '/'");
        }
        withSftp(machineId, sftp -> {
            deleteRecursive(sftp, normPath);
            return null;
        });
    }

    private void deleteRecursive(SftpClient sftp, String path) throws IOException {
        SftpClient.Attributes attrs = sftp.stat(path);
        if (attrs.isDirectory()) {
            for (SftpClient.DirEntry entry : sftp.readDir(path)) {
                String name = entry.getFilename();
                if (".".equals(name) || "..".equals(name)) {
                    continue;
                }
                deleteRecursive(sftp, joinPath(path, name));
            }
            sftp.rmdir(path);
        } else {
            sftp.remove(path);
        }
    }

    public byte[] downloadFile(String machineId, String rawPath) throws Exception {
        String normPath = normalizePath(rawPath);
        return withSftp(machineId, sftp -> {
            try (InputStream in = sftp.read(normPath)) {
                return in.readAllBytes();
            }
        });
    }

    public void uploadFile(
            String machineId,
            MultipartFile file,
            String rawTargetPath,
            boolean overwrite,
            String mode) throws Exception {
        String target = normalizePath(rawTargetPath);
        String parent = target.contains("/")
                ? target.substring(0, Math.max(1, target.lastIndexOf('/')))
                : "/";
        int octalMode = parseOctalMode(mode, 0644);

        withSftp(machineId, sftp -> {
            ensureRemoteDirs(sftp, parent);
            if (!overwrite && exists(sftp, target)) {
                throw new IOException("Target file already exists: " + target);
            }
            EnumSet<SftpClient.OpenMode> modes = EnumSet.of(
                    SftpClient.OpenMode.Create,
                    SftpClient.OpenMode.Write,
                    SftpClient.OpenMode.Truncate);
            try (OutputStream out = sftp.write(target, modes);
                    InputStream in = file.getInputStream()) {
                in.transferTo(out);
            }
            applyMode(sftp, target, octalMode);
            return null;
        });
    }

    public TransferResponse transferBetweenVms(TransferRequest req) {
        String srcVm = req.sourceMachineId();
        String srcPath = normalizePath(req.sourcePath());
        String dstBase = normalizePath(req.targetPath());
        int octalMode = parseOctalMode(req.mode(), 0644);

        List<TargetTransferResult> results = new ArrayList<>();
        byte[] payload;
        try {
            payload = downloadFile(srcVm, srcPath);
        } catch (Exception ex) {
            for (String targetVm : req.targetMachineIds()) {
                results.add(new TargetTransferResult(
                        targetVm,
                        dstBase,
                        false,
                        "Source read failed: " + ex.getMessage()));
            }
            return new TransferResponse(srcVm, srcPath, results);
        }

        String fileName = srcPath.substring(srcPath.lastIndexOf('/') + 1);
        for (String targetVm : req.targetMachineIds()) {
            String resolvedTarget = dstBase.endsWith("/") || fileName.isBlank()
                    ? joinPath(dstBase, fileName)
                    : dstBase;
            String parent = resolvedTarget.contains("/")
                    ? resolvedTarget.substring(0, Math.max(1, resolvedTarget.lastIndexOf('/')))
                    : "/";
            try {
                withSftp(targetVm, sftp -> {
                    ensureRemoteDirs(sftp, parent);
                    if (!req.overwrite() && exists(sftp, resolvedTarget)) {
                        throw new IOException("File exists and overwrite=false");
                    }
                    EnumSet<SftpClient.OpenMode> openModes = EnumSet.of(
                            SftpClient.OpenMode.Create,
                            SftpClient.OpenMode.Write,
                            SftpClient.OpenMode.Truncate);
                    try (OutputStream out = sftp.write(resolvedTarget, openModes);
                            InputStream in = new ByteArrayInputStream(payload)) {
                        in.transferTo(out);
                    }
                    applyMode(sftp, resolvedTarget, octalMode);
                    return null;
                });
                results.add(new TargetTransferResult(targetVm, resolvedTarget, true, "Transferred"));
            } catch (Exception ex) {
                results.add(new TargetTransferResult(targetVm, resolvedTarget, false, ex.getMessage()));
            }
        }
        return new TransferResponse(srcVm, srcPath, results);
    }

    private boolean exists(SftpClient sftp, String path) {
        try {
            sftp.stat(path);
            return true;
        } catch (IOException ex) {
            return false;
        }
    }

    private void applyMode(SftpClient sftp, String path, int octalMode) {
        try {
            SftpClient.Attributes attrs = new SftpClient.Attributes();
            attrs.setPermissions(octalMode);
            sftp.setStat(path, attrs);
        } catch (IOException ignored) {
        }
    }

    @FunctionalInterface
    private interface SftpOperation<T> {
        T run(SftpClient sftp) throws Exception;
    }
}