package com.kamalkavin96.backend.job;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PreDestroy;

import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.common.IOUtils;
import net.schmizz.sshj.connection.channel.direct.Session;
import net.schmizz.sshj.userauth.UserAuthException;
import net.schmizz.sshj.userauth.keyprovider.KeyProvider;
import net.schmizz.sshj.userauth.method.AuthKeyboardInteractive;
import net.schmizz.sshj.userauth.method.AuthMethod;
import net.schmizz.sshj.userauth.method.AuthNone;
import net.schmizz.sshj.userauth.method.AuthPassword;
import net.schmizz.sshj.userauth.method.AuthPublickey;
import net.schmizz.sshj.userauth.method.PasswordResponseProvider;
import net.schmizz.sshj.userauth.password.PasswordUtils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "sshj-monitoring")
public class SshjVmMetricCollector {

    private static final Logger log = LoggerFactory.getLogger(SshjVmMetricCollector.class);
    private static final String METRIC_CMD = "head -n 1 /proc/stat; cat /proc/loadavg; grep -E '^(MemTotal|MemAvailable):' /proc/meminfo";
    private static final List<String> DEFAULT_KEY_NAMES = List.of("id_ed25519", "id_ecdsa", "id_rsa");

    private record CpuSample(long total, long idle) {}

    private String privateKeyPath;
    private String knownHostsPath;
    private String password;
    private int commandTimeoutMs = 3000;
    private long retryCooldownMs = 30_000;

    private List<VmTarget> vms = List.of();

    private final Map<String, SSHClient> clients = new ConcurrentHashMap<>();
    private final Map<String, Object> locks = new ConcurrentHashMap<>();
    private final Map<String, Long> retryAfter = new ConcurrentHashMap<>();
    private final Map<String, CpuSample> previousCpu = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    @Scheduled(fixedDelay = 1000)
    public void collectFromAllVms() {
        if (vms == null || vms.isEmpty()) {
            return;
        }
        List<CompletableFuture<Void>> futures = vms.stream()
                .map(vm -> CompletableFuture.runAsync(() -> collectFromVm(vm), executor))
                .toList();
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    }

    private void collectFromVm(VmTarget vm) {
        if (System.currentTimeMillis() < retryAfter.getOrDefault(vm.name(), 0L)) {
            return;
        }
        try {
            SSHClient client = getOrConnectClient(vm);
            String output = runRemoteCommand(client, METRIC_CMD, commandTimeoutMs);
            parseMetrics(vm.name(), output);
            retryAfter.remove(vm.name());
        } catch (UserAuthException ex) {
            log.warn("SSH authentication failed for {}: {}", vm.name(), ex.toString());
            onFailure(vm);
        } catch (Exception ex) {
            log.warn("SSHJ collection failed for {}: {}", vm.name(), ex.toString(), ex);
            onFailure(vm);
        }
    }

    private void onFailure(VmTarget vm) {
        retryAfter.put(vm.name(), System.currentTimeMillis() + retryCooldownMs);
        previousCpu.remove(vm.name());
        closeQuietly(clients.remove(vm.name()));
    }

    private SSHClient getOrConnectClient(VmTarget vm) throws IOException {
        synchronized (locks.computeIfAbsent(vm.name(), k -> new Object())) {
            SSHClient existing = clients.get(vm.name());
            if (existing != null && existing.isConnected() && existing.isAuthenticated()) {
                return existing;
            }
            closeQuietly(existing);
            clients.remove(vm.name());
            SSHClient client = new SSHClient();
            try {
                if (knownHostsPath == null || knownHostsPath.isBlank()) {
                    throw new IllegalStateException("SSH known_hosts file is required");
                }
                client.loadKnownHosts(new File(knownHostsPath));
                client.setConnectTimeout(commandTimeoutMs);
                client.setTimeout(commandTimeoutMs);
                client.getConnection().getKeepAlive().setKeepAliveInterval(15);
                client.connect(vm.host(), vm.port());
                client.auth(vm.user(), buildAuthMethods(client, vm));
                clients.put(vm.name(), client);
                log.info("SSH connected successfully to VM: {}", vm.name());
                return client;
            } catch (Exception ex) {
                closeQuietly(client);
                if (ex instanceof IOException ioException) {
                    throw ioException;
                }
                throw new IOException("Unable to connect to VM: " + vm.name(), ex);
            }
        }
    }

    private List<AuthMethod> buildAuthMethods(SSHClient client, VmTarget vm) throws IOException {
        List<AuthMethod> methods = new ArrayList<>();
        methods.add(new AuthNone());

        List<File> keyFiles = new ArrayList<>();
        if (privateKeyPath != null && !privateKeyPath.isBlank()) {
            File configured = new File(privateKeyPath);
            if (!configured.isFile()) {
                throw new IOException("Private key not found: " + privateKeyPath);
            }
            keyFiles.add(configured);
        } else {
            File sshDir = new File(System.getProperty("user.home"), ".ssh");
            for (String name : DEFAULT_KEY_NAMES) {
                File f = new File(sshDir, name);
                if (f.isFile()) {
                    keyFiles.add(f);
                }
            }
        }

        List<KeyProvider> keyProviders = new ArrayList<>();
        for (File keyFile : keyFiles) {
            try {
                keyProviders.add(client.loadKeys(keyFile.getAbsolutePath()));
            } catch (IOException ex) {
                log.warn("Could not load key {} for {}: {}", keyFile, vm.name(), ex.toString());
            }
        }
        for (KeyProvider keyProvider : keyProviders) {
            methods.add(new AuthPublickey(keyProvider));
        }
        if (password != null && !password.isEmpty()) {
            methods.add(new AuthPassword(PasswordUtils.createOneOff(password.toCharArray())));
            methods.add(new AuthKeyboardInteractive(new PasswordResponseProvider(PasswordUtils.createOneOff(password.toCharArray()))));
        }
        return methods;
    }

    private String runRemoteCommand(SSHClient client, String command, int timeoutMs) throws Exception {
        try (Session session = client.startSession()) {
            Session.Command cmd = session.exec(command);
            try (cmd) {
                String output = IOUtils.readFully(cmd.getInputStream()).toString(StandardCharsets.UTF_8);
                String error = IOUtils.readFully(cmd.getErrorStream()).toString(StandardCharsets.UTF_8);
                cmd.join(timeoutMs, TimeUnit.MILLISECONDS);
                if (cmd.getExitStatus() != null && cmd.getExitStatus() != 0) {
                    throw new IOException("Remote command failed: " + error);
                }
                return output;
            }
        }
    }

    private void parseMetrics(String vmName, String rawOutput) {
        if (rawOutput == null || rawOutput.isBlank()) {
            return;
        }

        long[] cpuFields = null;
        String load1 = "?", load5 = "?", load15 = "?";
        long memTotalKb = 0;
        long memAvailableKb = 0;

        for (String rawLine : rawOutput.split("\\R")) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                continue;
            }
            if (line.startsWith("cpu ")) {
                String[] parts = line.split("\\s+");
                cpuFields = new long[parts.length - 1];
                for (int i = 1; i < parts.length; i++) {
                    cpuFields[i - 1] = Long.parseLong(parts[i]);
                }
            } else if (line.startsWith("MemTotal:")) {
                memTotalKb = parseMemKb(line);
            } else if (line.startsWith("MemAvailable:")) {
                memAvailableKb = parseMemKb(line);
            } else if (line.matches("^\\d+\\.\\d+\\s+\\d+\\.\\d+\\s+\\d+\\.\\d+.*")) {
                String[] parts = line.split("\\s+");
                load1 = parts[0];
                load5 = parts[1];
                load15 = parts[2];
            }
        }

        String cpuText = "N/A";
        if (cpuFields != null && cpuFields.length >= 4) {
            long total = 0;
            for (long v : cpuFields) {
                total += v;
            }
            long idle = cpuFields[3] + (cpuFields.length > 4 ? cpuFields[4] : 0L);
            CpuSample prev = previousCpu.put(vmName, new CpuSample(total, idle));
            if (prev != null && total > prev.total()) {
                long dTotal = total - prev.total();
                long dIdle = idle - prev.idle();
                double cpuPct = Math.max(0.0, Math.min(100.0, ((dTotal - dIdle) * 100.0) / dTotal));
                cpuText = String.format("%.1f%%", cpuPct);
            }
        }

        long memUsedKb = Math.max(0L, memTotalKb - memAvailableKb);
        double memPct = memTotalKb > 0 ? (memUsedKb * 100.0) / memTotalKb : 0.0;
        String memText = String.format(
                "%.1f%% (%s / %s)",
                memPct,
                formatKb(memUsedKb),
                formatKb(memTotalKb));

        log.info("[{}] CPU: {} | Mem: {} | Load: {}, {}, {}",
                vmName, cpuText, memText, load1, load5, load15);
    }

    private long parseMemKb(String line) {
        String[] parts = line.split("\\s+");
        return parts.length >= 2 ? Long.parseLong(parts[1]) : 0L;
    }

    private String formatKb(long kb) {
        double mb = kb / 1024.0;
        if (mb >= 1024.0) {
            return String.format("%.2f GB", mb / 1024.0);
        }
        return String.format("%.0f MB", mb);
    }

    private void closeQuietly(SSHClient client) {
        if (client != null) {
            try {
                client.close();
            } catch (IOException ex) {
                log.debug("Error closing SSH connection: {}", ex.getMessage());
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down SSHJ VM metric collector");
        clients.values().forEach(this::closeQuietly);
        clients.clear();
        previousCpu.clear();
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException ex) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    public record VmTarget(String name, String host, int port, String user) {}
    public void setPrivateKeyPath(String privateKeyPath) { this.privateKeyPath = privateKeyPath; }
    public void setKnownHostsPath(String knownHostsPath) { this.knownHostsPath = knownHostsPath; }
    public void setPassword(String password) { this.password = password; }
    public void setCommandTimeoutMs(int commandTimeoutMs) { this.commandTimeoutMs = commandTimeoutMs; }
    public void setRetryCooldownMs(long retryCooldownMs) { this.retryCooldownMs = retryCooldownMs; }
    public void setVms(List<VmTarget> vms) { this.vms = vms; }
}