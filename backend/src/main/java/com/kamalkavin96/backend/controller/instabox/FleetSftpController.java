package com.kamalkavin96.backend.controller.instabox;

import com.kamalkavin96.backend.dto.instabox.SftpDtos.MkdirRequest;
import com.kamalkavin96.backend.dto.instabox.SftpDtos.SftpListResponse;
import com.kamalkavin96.backend.dto.instabox.SftpDtos.TransferRequest;
import com.kamalkavin96.backend.dto.instabox.SftpDtos.TransferResponse;
import com.kamalkavin96.backend.service.instabox.FleetSftpService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/instabox")
public class FleetSftpController {

    private final FleetSftpService sftpService;

    public FleetSftpController(FleetSftpService sftpService) {
        this.sftpService = sftpService;
    }

    @GetMapping("/machines/{machineId}/sftp/list")
    public ResponseEntity<SftpListResponse> list(
            @PathVariable String machineId,
            @RequestParam(defaultValue = "/") String path
    ) throws Exception {
        return ResponseEntity.ok(sftpService.listDirectory(machineId, path));
    }

    @PostMapping("/machines/{machineId}/sftp/mkdir")
    public ResponseEntity<Map<String,String>> mkdir(
            @PathVariable String machineId,
            @RequestBody MkdirRequest request
    ) throws Exception {
        sftpService.createDirectory(machineId, request.path());
        return ResponseEntity.ok(Map.of("status", "created", "path", request.path()));
    }

    @DeleteMapping("/machines/{machineId}/sftp/entry")
    public ResponseEntity<Map<String,String>> delete(
            @PathVariable String machineId,
            @RequestParam String path
    ) throws Exception {
        sftpService.deleteEntry(machineId, path);
        return ResponseEntity.ok(Map.of("status", "deleted", "path", path));
    }

    @GetMapping("/machines/{machineId}/sftp/download")
    public ResponseEntity<byte[]> download(
            @PathVariable String machineId,
            @RequestParam String path
    ) throws Exception {
        byte[] bytes = sftpService.downloadFile(machineId, path);
        String filename = Path.of(path).getFileName() != null
                ? Path.of(path).getFileName().toString()
                : "download.bin";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    @PostMapping(value = "/machines/{machineId}/sftp/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String,String>> upload(
            @PathVariable String machineId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("targetPath") String targetPath,
            @RequestParam(defaultValue = "true") boolean overwrite,
            @RequestParam(defaultValue = "0644") String mode
    ) throws Exception {
        sftpService.uploadFile(machineId, file, targetPath, overwrite, mode);
        return ResponseEntity.ok(Map.of("status", "uploaded", "targetPath", targetPath));
    }

    @PostMapping("/sftp/transfer")
    public ResponseEntity<TransferResponse> transfer(@RequestBody TransferRequest request) {
        return ResponseEntity.ok(sftpService.transferBetweenVms(request));
    }
}