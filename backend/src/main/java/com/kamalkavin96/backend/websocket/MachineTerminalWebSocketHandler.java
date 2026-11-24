package com.kamalkavin96.backend.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kamalkavin96.backend.entity.instabox.InstaBoxSshConfig;
import com.kamalkavin96.backend.repository.instabox.InstaBoxSshConfigRepository;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class MachineTerminalWebSocketHandler extends TextWebSocketHandler {

    private record SessionProcess(Process process, Path tempKey) {}

    private final InstaBoxSshConfigRepository sshConfigRepository;
    private final ObjectMapper objectMapper;
    private final Map<String, SessionProcess> sessions = new ConcurrentHashMap<>();
    private final ExecutorService ioPool = Executors.newCachedThreadPool();

    public MachineTerminalWebSocketHandler(
            InstaBoxSshConfigRepository sshConfigRepository,
            ObjectMapper objectMapper
    ) {
        this.sshConfigRepository = sshConfigRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String machineId = extractMachineId(session.getUri());
        InstaBoxSshConfig cfg = sshConfigRepository.findByMachineId(machineId).orElse(null);

        if (cfg == null || !StringUtils.hasText(cfg.getHost()) || !StringUtils.hasText(cfg.getUsername())) {
            session.sendMessage(new TextMessage("{\"type\":\"ERROR\",\"data\":\"InstaBox SSH config not found for machine.\"}"));
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        Path tempKey = null;
        List<String> cmd = new ArrayList<>();
        cmd.add("ssh");
        cmd.add("-tt");
        cmd.add("-p");
        cmd.add(String.valueOf(cfg.getPort() != null ? cfg.getPort() : 2222));
        cmd.add("-o");
        cmd.add("StrictHostKeyChecking=accept-new");
        cmd.add("-o");
        cmd.add("ConnectTimeout=15");

        if (StringUtils.hasText(cfg.getSecretKeyCiphertext())) {
            tempKey = Files.createTempFile("ib_term_key_", ".pem");
            Files.writeString(tempKey, cfg.getSecretKeyCiphertext(), StandardCharsets.UTF_8, StandardOpenOption.TRUNCATE_EXISTING);
            tempKey.toFile().setReadable(false, false);
            tempKey.toFile().setReadable(true, true);
            cmd.add("-i");
            cmd.add(tempKey.toAbsolutePath().toString());
        }

        cmd.add(cfg.getUsername().trim() + "@" + cfg.getHost().trim());

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        sessions.put(session.getId(), new SessionProcess(process, tempKey));

        ioPool.submit(() -> streamOutput(session, process.getInputStream()));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        SessionProcess sp = sessions.get(session.getId());
        if (sp == null || !sp.process().isAlive()) return;

        JsonNode node = objectMapper.readTree(message.getPayload());
        String type = node.path("type").asText("");
        if ("INPUT".equals(type)) {
            String data = node.path("data").asText("");
            OutputStream os = sp.process().getOutputStream();
            os.write(data.getBytes(StandardCharsets.UTF_8));
            os.flush();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        cleanupSession(session.getId());
    }

    private void streamOutput(WebSocketSession session, InputStream in) {
        byte[] buf = new byte[4096];
        try {
            int read;
            while ((read = in.read(buf)) != -1) {
                if (!session.isOpen()) break;
                String chunk = new String(buf, 0, read, StandardCharsets.UTF_8);
                String payload = objectMapper.writeValueAsString(Map.of("type", "OUTPUT", "data", chunk));
                synchronized (session) {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(payload));
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            cleanupSession(session.getId());
            try {
                if (session.isOpen()) session.close();
            } catch (Exception ignored) {
            }
        }
    }

    private void cleanupSession(String sessionId) {
        SessionProcess sp = sessions.remove(sessionId);
        if (sp != null) {
            sp.process().destroyForcibly();
            if (sp.tempKey() != null) {
                try {
                    Files.deleteIfExists(sp.tempKey());
                } catch (Exception ignored) {
                }
            }
        }
    }

    private String extractMachineId(URI uri) {
        if (uri == null || uri.getPath() == null) return "";
        String[] parts = uri.getPath().split("/");
        for (int i = 0; i < parts.length - 1; i++) {
            if ("machines".equals(parts[i])) {
                return parts[i + 1];
            }
        }
        return "";
    }
}