package com.kamalkavin96.backend.dto.instabox;

import java.util.List;

public class SftpDtos {

    public record SftpEntry(
            String name,
            String path,
            String type,          // "dir" or "file"
            long size,
            long modifiedAt,
            String permissions
    ) {}

    public record SftpListResponse(
            String path,
            List<SftpEntry> entries
    ) {}

    public record MkdirRequest(
            String path
    ) {}

    public record TransferRequest(
            String sourceMachineId,
            String sourcePath,
            List<String> targetMachineIds,
            String targetPath,
            boolean overwrite,
            String mode
    ) {}

    public record TargetTransferResult(
            String targetMachineId,
            String targetPath,
            boolean success,
            String message
    ) {}

    public record TransferResponse(
            String sourceMachineId,
            String sourcePath,
            List<TargetTransferResult> results
    ) {}
}