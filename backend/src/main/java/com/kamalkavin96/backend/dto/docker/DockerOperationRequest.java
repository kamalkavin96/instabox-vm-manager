package com.kamalkavin96.backend.dto.docker;


import java.util.List;
import java.util.Map;

public record DockerOperationRequest(
        String action,          // CREATE_CONTAINER, START, STOP, RESTART, PAUSE, UNPAUSE, KILL, REMOVE,
                                // LOGS, INSPECT, STATS, TOP, PULL_IMAGE, REMOVE_IMAGE,
                                // CREATE_VOLUME, REMOVE_VOLUME, CREATE_NETWORK, REMOVE_NETWORK,
                                // PRUNE_CONTAINERS, PRUNE_IMAGES, PRUNE_VOLUMES, PRUNE_NETWORKS, PRUNE_SYSTEM
        String targetId,        // container id/name, image name/id, volume name, or network id
        String name,            // optional container/volume/network name
        String image,           // image for container create or pull
        String tag,             // optional image tag (default: latest)
        List<String> cmd,       // optional command args
        List<String> env,       // optional ["KEY=VAL"]
        Map<String, String> portBindings, // e.g. {"8080/tcp": "8080"}
        List<String> binds,     // e.g. ["/data:/app/data"]
        String network,         // optional network name
        Boolean force,          // force remove / pull
        Boolean all,            // all containers / prune all
        Integer tail            // log lines count
) {}