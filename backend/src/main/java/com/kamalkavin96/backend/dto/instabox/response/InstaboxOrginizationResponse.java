package com.kamalkavin96.backend.dto.instabox.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstaboxOrginizationResponse {

    private Long id;
    private String organizationId;
    private String organizationName;
    private Long machineCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}