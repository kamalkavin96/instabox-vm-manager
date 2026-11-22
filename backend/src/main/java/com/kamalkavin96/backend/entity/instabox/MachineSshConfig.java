package com.kamalkavin96.backend.entity.instabox;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(
        name = "machine_ssh_configs",
        indexes = {
                @Index(name = "idx_ssh_cfg_machine_id", columnList = "machine_id", unique = true)
        }
)
public class MachineSshConfig extends BaseConnectionConfig {

    @Column(name = "host_alias", length = 120)
    private String hostAlias;

    @Column(name = "proxy_jump", length = 255)
    private String proxyJump;

    @Column(name = "forward_agent", nullable = false)
    private Boolean forwardAgent = false;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "machine_ssh_local_forwards",
            joinColumns = @JoinColumn(name = "ssh_config_id")
    )
    @Column(name = "forward_spec", length = 255)
    private List<String> localForwards = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "machine_ssh_remote_forwards",
            joinColumns = @JoinColumn(name = "ssh_config_id")
    )
    @Column(name = "forward_spec", length = 255)
    private List<String> remoteForwards = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "machine_ssh_directives",
            joinColumns = @JoinColumn(name = "ssh_config_id")
    )
    @MapKeyColumn(name = "directive_key", length = 128)
    @Column(name = "directive_value", length = 512)
    private Map<String, String> customDirectives = new LinkedHashMap<>();

    public String getHostAlias() { return hostAlias; }
    public void setHostAlias(String hostAlias) { this.hostAlias = hostAlias; }

    public String getProxyJump() { return proxyJump; }
    public void setProxyJump(String proxyJump) { this.proxyJump = proxyJump; }

    public Boolean getForwardAgent() { return forwardAgent; }
    public void setForwardAgent(Boolean forwardAgent) { this.forwardAgent = forwardAgent; }

    public List<String> getLocalForwards() { return localForwards; }
    public void setLocalForwards(List<String> localForwards) { this.localForwards = localForwards; }

    public List<String> getRemoteForwards() { return remoteForwards; }
    public void setRemoteForwards(List<String> remoteForwards) { this.remoteForwards = remoteForwards; }

    public Map<String, String> getCustomDirectives() { return customDirectives; }
    public void setCustomDirectives(Map<String, String> customDirectives) { this.customDirectives = customDirectives; }
}