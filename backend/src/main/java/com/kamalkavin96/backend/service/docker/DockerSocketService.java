package com.kamalkavin96.backend.service.docker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.kamalkavin96.backend.dto.docker.DockerExecRequest;
import com.kamalkavin96.backend.dto.docker.DockerOperationRequest;
import com.kamalkavin96.backend.entity.instabox.InstaBoxSshConfig;
import com.kamalkavin96.backend.repository.instabox.InstaBoxSshConfigRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DockerSocketService {

    private final InstaBoxSshConfigRepository sshConfigRepository;
    private final SshDockerSocketExecutor socketExecutor;
    private final ObjectMapper objectMapper;

    public DockerSocketService(
            InstaBoxSshConfigRepository sshConfigRepository,
            SshDockerSocketExecutor socketExecutor,
            ObjectMapper objectMapper
    ) {
        this.sshConfigRepository = sshConfigRepository;
        this.socketExecutor = socketExecutor;
        this.objectMapper = objectMapper;
    }

    private InstaBoxSshConfig requireSsh(String machineId) {
        return sshConfigRepository.findByMachineId(machineId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "InstaBox SSH config not found for machine: " + machineId));
    }

    private String enc(String val) {
        return URLEncoder.encode(val, StandardCharsets.UTF_8);
    }

    // --- System ---

    public String getSystemInfo(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/info", null);
    }

    public String getVersion(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/version", null);
    }

    public String getDiskUsage(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/system/df", null);
    }

    public String pruneSystem(String machineId, boolean volumes) {
        String query = volumes ? "?volumes=true" : "";
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/system/prune" + query, null);
    }

    // --- Containers ---

    public String listContainers(String machineId, boolean all) {
        String query = all ? "?all=true" : "?all=false";
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/containers/json" + query, null);
    }

    public String inspectContainer(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/containers/" + enc(containerId) + "/json", null);
    }

    public String containerStats(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/containers/" + enc(containerId) + "/stats?stream=false", null);
    }

    public String containerTop(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/containers/" + enc(containerId) + "/top", null);
    }

    public String containerLogs(String machineId, String containerId, int tail) {
        int safeTail = tail > 0 ? tail : 200;
        String raw = socketExecutor.callDockerApi(
                requireSsh(machineId),
                "GET",
                "/containers/" + enc(containerId) + "/logs?stdout=true&stderr=true&tail=" + safeTail,
                null
        );
        // Strip 8-byte Docker multiplexed stream frame headers when present
        return stripDockerLogHeaders(raw);
    }

    public String createContainer(String machineId, DockerOperationRequest req) {
        if (!StringUtils.hasText(req.image())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image is required to create container");
        }
        String tag = StringUtils.hasText(req.tag()) ? req.tag().trim() : "latest";
        String fullImage = req.image().contains(":") ? req.image().trim() : req.image().trim() + ":" + tag;

        ObjectNode body = objectMapper.createObjectNode();
        body.put("Image", fullImage);

        if (req.cmd() != null && !req.cmd().isEmpty()) {
            ArrayNode cmdArr = body.putArray("Cmd");
            req.cmd().forEach(cmdArr::add);
        }
        if (req.env() != null && !req.env().isEmpty()) {
            ArrayNode envArr = body.putArray("Env");
            req.env().forEach(envArr::add);
        }

        ObjectNode hostConfig = body.putObject("HostConfig");
        if (req.binds() != null && !req.binds().isEmpty()) {
            ArrayNode bindArr = hostConfig.putArray("Binds");
            req.binds().forEach(bindArr::add);
        }
        if (req.portBindings() != null && !req.portBindings().isEmpty()) {
            ObjectNode exposed = body.putObject("ExposedPorts");
            ObjectNode portBindingsNode = hostConfig.putObject("PortBindings");
            req.portBindings().forEach((containerPort, hostPort) -> {
                String normalizedPort = containerPort.contains("/") ? containerPort : containerPort + "/tcp";
                exposed.putObject(normalizedPort);
                ArrayNode bindings = portBindingsNode.putArray(normalizedPort);
                ObjectNode bindingObj = bindings.addObject();
                bindingObj.put("HostPort", String.valueOf(hostPort));
            });
        }

        String query = StringUtils.hasText(req.name()) ? "?name=" + enc(req.name().trim()) : "";
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/create" + query, body);
    }

    public String startContainer(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/" + enc(containerId) + "/start", null);
    }

    public String stopContainer(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/" + enc(containerId) + "/stop?t=10", null);
    }

    public String restartContainer(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/" + enc(containerId) + "/restart?t=10", null);
    }

    public String pauseContainer(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/" + enc(containerId) + "/pause", null);
    }

    public String unpauseContainer(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/" + enc(containerId) + "/unpause", null);
    }

    public String killContainer(String machineId, String containerId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/" + enc(containerId) + "/kill?signal=SIGKILL", null);
    }

    public String removeContainer(String machineId, String containerId, boolean force) {
        String query = force ? "?force=true&v=true" : "?v=true";
        return socketExecutor.callDockerApi(requireSsh(machineId), "DELETE", "/containers/" + enc(containerId) + query, null);
    }

    public String pruneContainers(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/containers/prune", null);
    }

    // --- Exec ---

    public Map<String, Object> execInContainer(String machineId, String containerId, DockerExecRequest req) {
        if (req == null || req.cmd() == null || req.cmd().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cmd is required for exec");
        }
        InstaBoxSshConfig ssh = requireSsh(machineId);

        ObjectNode execSpec = objectMapper.createObjectNode();
        execSpec.put("AttachStdout", req.attachStdout() == null || req.attachStdout());
        execSpec.put("AttachStderr", req.attachStderr() == null || req.attachStderr());
        execSpec.put("Tty", Boolean.TRUE.equals(req.tty()));
        if (StringUtils.hasText(req.workingDir())) {
            execSpec.put("WorkingDir", req.workingDir().trim());
        }
        if (StringUtils.hasText(req.user())) {
            execSpec.put("User", req.user().trim());
        }
        ArrayNode cmdNode = execSpec.putArray("Cmd");
        req.cmd().forEach(cmdNode::add);

        String createResp = socketExecutor.callDockerApi(
                ssh, "POST", "/containers/" + enc(containerId) + "/exec", execSpec
        );

        String execId;
        try {
            JsonNode root = objectMapper.readTree(createResp);
            execId = root.path("Id").asText("");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed parsing exec Id", e);
        }
        if (!StringUtils.hasText(execId)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Docker did not return exec Id");
        }

        ObjectNode startSpec = objectMapper.createObjectNode();
        startSpec.put("Detach", false);
        startSpec.put("Tty", Boolean.TRUE.equals(req.tty()));

        String rawOutput = socketExecutor.callDockerApi(
                ssh, "POST", "/exec/" + enc(execId) + "/start", startSpec
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("execId", execId);
        result.put("output", stripDockerLogHeaders(rawOutput));
        return result;
    }

    // --- Images ---

    public String listImages(String machineId, boolean all) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/images/json?all=" + all, null);
    }

    public String inspectImage(String machineId, String nameOrId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/images/" + enc(nameOrId) + "/json", null);
    }

    public String pullImage(String machineId, String fromImage, String tag) {
        String effectiveTag = StringUtils.hasText(tag) ? tag.trim() : "latest";
        String query = "?fromImage=" + enc(fromImage.trim()) + "&tag=" + enc(effectiveTag);
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/images/create" + query, null);
    }

    public String removeImage(String machineId, String nameOrId, boolean force) {
        String query = force ? "?force=true" : "";
        return socketExecutor.callDockerApi(requireSsh(machineId), "DELETE", "/images/" + enc(nameOrId) + query, null);
    }

    public String pruneImages(String machineId, boolean danglingOnly) {
        String filters = danglingOnly ? "{\"dangling\":[\"true\"]}" : "{\"dangling\":[\"false\"]}";
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/images/prune?filters=" + enc(filters), null);
    }

    // --- Volumes ---

    public String listVolumes(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/volumes", null);
    }

    public String inspectVolume(String machineId, String volumeName) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/volumes/" + enc(volumeName), null);
    }

    public String createVolume(String machineId, String name, String driver) {
        ObjectNode body = objectMapper.createObjectNode();
        if (StringUtils.hasText(name)) body.put("Name", name.trim());
        body.put("Driver", StringUtils.hasText(driver) ? driver.trim() : "local");
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/volumes/create", body);
    }

    public String removeVolume(String machineId, String volumeName, boolean force) {
        String query = force ? "?force=true" : "";
        return socketExecutor.callDockerApi(requireSsh(machineId), "DELETE", "/volumes/" + enc(volumeName) + query, null);
    }

    public String pruneVolumes(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/volumes/prune", null);
    }

    // --- Networks ---

    public String listNetworks(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/networks", null);
    }

    public String inspectNetwork(String machineId, String networkId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "GET", "/networks/" + enc(networkId), null);
    }

    public String createNetwork(String machineId, String name, String driver) {
        if (!StringUtils.hasText(name)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "network name is required");
        }
        ObjectNode body = objectMapper.createObjectNode();
        body.put("Name", name.trim());
        body.put("Driver", StringUtils.hasText(driver) ? driver.trim() : "bridge");
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/networks/create", body);
    }

    public String connectNetwork(String machineId, String networkId, String containerId) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("Container", containerId);
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/networks/" + enc(networkId) + "/connect", body);
    }

    public String disconnectNetwork(String machineId, String networkId, String containerId, boolean force) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("Container", containerId);
        body.put("Force", force);
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/networks/" + enc(networkId) + "/disconnect", body);
    }

    public String removeNetwork(String machineId, String networkId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "DELETE", "/networks/" + enc(networkId), null);
    }

    public String pruneNetworks(String machineId) {
        return socketExecutor.callDockerApi(requireSsh(machineId), "POST", "/networks/prune", null);
    }

    // --- Unified Action Dispatcher ---

    public Object executeAction(String machineId, DockerOperationRequest req) {
        String action = req.action() == null ? "" : req.action().trim().toUpperCase();
        boolean force = Boolean.TRUE.equals(req.force());
        boolean all = Boolean.TRUE.equals(req.all());

        return switch (action) {
            case "SYSTEM_INFO" -> getSystemInfo(machineId);
            case "SYSTEM_DF" -> getDiskUsage(machineId);
            case "PRUNE_SYSTEM" -> pruneSystem(machineId, all);
            case "CREATE_CONTAINER" -> createContainer(machineId, req);
            case "START" -> startContainer(machineId, req.targetId());
            case "STOP" -> stopContainer(machineId, req.targetId());
            case "RESTART" -> restartContainer(machineId, req.targetId());
            case "PAUSE" -> pauseContainer(machineId, req.targetId());
            case "UNPAUSE" -> unpauseContainer(machineId, req.targetId());
            case "KILL" -> killContainer(machineId, req.targetId());
            case "REMOVE_CONTAINER" -> removeContainer(machineId, req.targetId(), force);
            case "INSPECT_CONTAINER" -> inspectContainer(machineId, req.targetId());
            case "LOGS" -> containerLogs(machineId, req.targetId(), req.tail() != null ? req.tail() : 200);
            case "STATS" -> containerStats(machineId, req.targetId());
            case "TOP" -> containerTop(machineId, req.targetId());
            case "PRUNE_CONTAINERS" -> pruneContainers(machineId);
            case "PULL_IMAGE" -> pullImage(machineId, req.image(), req.tag());
            case "INSPECT_IMAGE" -> inspectImage(machineId, req.targetId());
            case "REMOVE_IMAGE" -> removeImage(machineId, req.targetId(), force);
            case "PRUNE_IMAGES" -> pruneImages(machineId, !all);
            case "CREATE_VOLUME" -> createVolume(machineId, req.name(), "local");
            case "INSPECT_VOLUME" -> inspectVolume(machineId, req.targetId());
            case "REMOVE_VOLUME" -> removeVolume(machineId, req.targetId(), force);
            case "PRUNE_VOLUMES" -> pruneVolumes(machineId);
            case "CREATE_NETWORK" -> createNetwork(machineId, req.name(), "bridge");
            case "INSPECT_NETWORK" -> inspectNetwork(machineId, req.targetId());
            case "REMOVE_NETWORK" -> removeNetwork(machineId, req.targetId());
            case "PRUNE_NETWORKS" -> pruneNetworks(machineId);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported Docker action: " + action);
        };
    }

    private String stripDockerLogHeaders(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);
        StringBuilder out = new StringBuilder();
        int i = 0;
        while (i < bytes.length) {
            // Standard Docker log stream frame: [streamType(1), 0, 0, 0, size(4)]
            if (i + 8 <= bytes.length && (bytes[i] == 1 || bytes[i] == 2) && bytes[i + 1] == 0 && bytes[i + 2] == 0 && bytes[i + 3] == 0) {
                int frameLen = ((bytes[i + 4] & 0xFF) << 24)
                        | ((bytes[i + 5] & 0xFF) << 16)
                        | ((bytes[i + 6] & 0xFF) << 8)
                        | (bytes[i + 7] & 0xFF);
                if (frameLen >= 0 && i + 8 + frameLen <= bytes.length) {
                    out.append(new String(bytes, i + 8, frameLen, StandardCharsets.UTF_8));
                    i += 8 + frameLen;
                    continue;
                }
            }
            out.append((char) (bytes[i] & 0xFF));
            i++;
        }
        return out.toString();
    }
}