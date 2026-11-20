package com.kamalkavin96.backend.dto.instabox.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InstaboxOrganizationRequest {

    @NotBlank(message = "API key is required")
    private String apiKey;

    @NotBlank(message = "Organization name is required")
    private String organizationName;
}