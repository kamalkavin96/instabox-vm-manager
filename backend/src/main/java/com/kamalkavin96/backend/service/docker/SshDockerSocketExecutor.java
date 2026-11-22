package com.kamalkavin96.backend.service.docker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kamalkavin96.backend.entity.instabox.InstaBoxSshConfig;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class SshDockerSocketExecutor {

    private static final String DOCKER_SOCK = "/var/run/docker.sock";
    private static final int COMMAND_TIMEOUT_SEC = 45;

    private final ObjectMapper objectMapper;

    public SshDockerSocketExecutor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String callDockerApi(
            InstaBoxSshConfig sshConfig,
            String method,
            String pathWithQuery,
            Object jsonBody
    ) {
        if (sshConfig == null || !StringUtils.hasText(sshConfig.getHost()) || !StringUtils.hasText(sshConfig.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "InstaBox SSH config is incomplete for machine");
        }

        String bodyJson = null;
        if (jsonBody != null) {
            try {
                bodyJson = jsonBody instanceof String s ? s : objectMapper.writeValueAsString(jsonBody);
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Docker request body", e);
            }
        }

        Path tempKeyFile = null;
        try {
            List<String> sshCmd = new ArrayList<>();
            sshCmd.add("ssh");
            sshCmd.add("-p");
            sshCmd.add(String.valueOf(sshConfig.getPort() != null ? sshConfig.getPort() : 2222));
            sshCmd.add("-o");
            sshCmd.add("BatchMode=yes");
            sshCmd.add("-o");
            sshCmd.add("StrictHostKeyChecking=accept-new");
            sshCmd.add("-o");
            sshCmd.add("ConnectTimeout=15");

            if (StringUtils.hasText(sshConfig.getSecretKeyCiphertext())) {
                tempKeyFile = Files.createTempFile("ib_ssh_key_", ".pem");
                Files.writeString(tempKeyFile, sshConfig.getSecretKeyCiphertext(), StandardCharsets.UTF_8, StandardOpenOption.TRUNCATE_EXISTING);
                tempKeyFile.toFile().setReadable(false, false);
                tempKeyFile.toFile().setReadable(true, true);
                sshCmd.add("-i");
                sshCmd.add(tempKeyFile.toAbsolutePath().toString());
            }

            sshCmd.add(sshConfig.getUsername().trim() + "@" + sshConfig.getHost().trim());
            sshCmd.add(buildRemoteUnixSocketCommand(method, pathWithQuery, bodyJson));



            System.out.println("**************************************************************************************");

            System.out.println(sshCmd);

            System.out.println("**************************************************************************************");



            ProcessBuilder pb = new ProcessBuilder(sshCmd);
            pb.redirectErrorStream(false);
            Process process = pb.start();

            StringBuilder stdout = new StringBuilder();
            StringBuilder stderr = new StringBuilder();

            Thread outReader = new Thread(() -> readStream(process, stdout, true));
            Thread errReader = new Thread(() -> readStream(process, stderr, false));
            outReader.start();
            errReader.start();

            boolean finished = process.waitFor(COMMAND_TIMEOUT_SEC, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "SSH Docker socket command timed out");
            }

            outReader.join(3000);
            errReader.join(3000);

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                String errMsg = stderr.toString().trim();
                if (!StringUtils.hasText(errMsg)) {
                    errMsg = stdout.toString().trim();
                }
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "SSH Docker socket error (exit " + exitCode + "): " + errMsg
                );
            }

            return stdout.toString();
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed executing SSH Docker command", e);
        } finally {
            if (tempKeyFile != null) {
                try {
                    Files.deleteIfExists(tempKeyFile);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private void readStream(Process process, StringBuilder target, boolean isOut) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(isOut ? process.getInputStream() : process.getErrorStream(), StandardCharsets.UTF_8)
        )) {
            String line;
            while ((line = reader.readLine()) != null) {
                target.append(line).append('\n');
            }
        } catch (IOException ignored) {
        }
    }

    /**
     * Executes a Docker Engine REST call against /var/run/docker.sock on the remote VM.
     * Uses curl --unix-socket when available, with a Python AF_UNIX fallback.
     */
    private String buildRemoteUnixSocketCommand(String method, String pathWithQuery, String bodyJson) {
        String safeMethod = method.toUpperCase();
        String safePath = pathWithQuery.startsWith("/") ? pathWithQuery : "/" + pathWithQuery;
        String url = "http://localhost" + safePath;

        String bodyB64 = bodyJson != null
                ? Base64.getEncoder().encodeToString(bodyJson.getBytes(StandardCharsets.UTF_8))
                : "";

        return "sh -lc '"
                + "SOCK=" + DOCKER_SOCK + "; "
                + "if [ ! -S \"$SOCK\" ]; then echo \"Docker socket not found at $SOCK\" >&2; exit 127; fi; "
                + "BODY_FILE=$(mktemp); "
                + (StringUtils.hasText(bodyB64)
                        ? "printf %s \"" + bodyB64 + "\" | base64 -d > \"$BODY_FILE\"; "
                        : ": > \"$BODY_FILE\"; ")
                + "trap \"rm -f \\\"$BODY_FILE\\\"\" EXIT; "
                + "if command -v curl >/dev/null 2>&1; then "
                + "  if [ -s \"$BODY_FILE\" ]; then "
                + "    curl -fsS --unix-socket \"$SOCK\" -X " + safeMethod + " -H \"Content-Type: application/json\" --data-binary @\"$BODY_FILE\" \"" + url + "\"; "
                + "  else "
                + "    curl -fsS --unix-socket \"$SOCK\" -X " + safeMethod + " \"" + url + "\"; "
                + "  fi; "
                + "elif command -v python3 >/dev/null 2>&1; then "
                + "  python3 -c \"import http.client, os, socket, sys; "
                + "body=open(sys.argv[3],\\\"rb\\\").read(); "
                + "conn=http.client.HTTPConnection(\\\"localhost\\\"); "
                + "conn.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM); "
                + "conn.sock.connect(sys.argv[1]); "
                + "hdrs={\\\"Content-Type\\\":\\\"application/json\\\",\\\"Content-Length\\\":str(len(body))} if body else {}; "
                + "conn.request(sys.argv[2],sys.argv[4],body=body if body else None,headers=hdrs); "
                + "resp=conn.getresponse(); data=resp.read().decode(\\\"utf-8\\\",errors=\\\"replace\\\"); "
                + "sys.exit(1 if resp.status>=400 else 0) if False else None; "
                + "(sys.stderr.write(data) or sys.exit(1)) if resp.status>=400 else sys.stdout.write(data)\" "
                + "\"$SOCK\" \"" + safeMethod + "\" \"$BODY_FILE\" \"" + safePath + "\"; "
                + "else "
                + "  echo \"Neither curl nor python3 found on remote host\" >&2; exit 127; "
                + "fi'";
    }
}