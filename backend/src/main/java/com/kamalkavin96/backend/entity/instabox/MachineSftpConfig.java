package com.kamalkavin96.backend.entity.instabox;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;

import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(
        name = "machine_sftp_configs",
        indexes = {
                @Index(name = "idx_sftp_cfg_machine_id", columnList = "machine_id", unique = true)
        }
)
public class MachineSftpConfig extends BaseConnectionConfig {

    public enum TransferMode {
        SFTP,
        SCP
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "transfer_mode", nullable = false, length = 16)
    private TransferMode transferMode = TransferMode.SFTP;

    @Column(name = "remote_path", length = 512)
    private String remotePath = "/";

    @Column(name = "local_path", length = 512)
    private String localPath;

    @Column(name = "preserve_permissions", nullable = false)
    private Boolean preservePermissions = true;

    @Column(name = "max_concurrent_transfers", nullable = false)
    private Integer maxConcurrentTransfers = 4;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "machine_sftp_options",
            joinColumns = @JoinColumn(name = "sftp_config_id")
    )
    @MapKeyColumn(name = "option_key", length = 128)
    @Column(name = "option_value", length = 512)
    private Map<String, String> customOptions = new LinkedHashMap<>();

    public TransferMode getTransferMode() { return transferMode; }
    public void setTransferMode(TransferMode transferMode) { this.transferMode = transferMode; }

    public String getRemotePath() { return remotePath; }
    public void setRemotePath(String remotePath) { this.remotePath = remotePath; }

    public String getLocalPath() { return localPath; }
    public void setLocalPath(String localPath) { this.localPath = localPath; }

    public Boolean getPreservePermissions() { return preservePermissions; }
    public void setPreservePermissions(Boolean preservePermissions) { this.preservePermissions = preservePermissions; }

    public Integer getMaxConcurrentTransfers() { return maxConcurrentTransfers; }
    public void setMaxConcurrentTransfers(Integer maxConcurrentTransfers) { this.maxConcurrentTransfers = maxConcurrentTransfers; }

    public Map<String, String> getCustomOptions() { return customOptions; }
    public void setCustomOptions(Map<String, String> customOptions) { this.customOptions = customOptions; }
}