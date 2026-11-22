package com.kamalkavin96.backend.dto.docker;

import java.util.List;

public record DockerExecRequest(
        List<String> cmd,
        Boolean attachStdout,
        Boolean attachStderr,
        Boolean tty,
        String workingDir,
        String user
) {}