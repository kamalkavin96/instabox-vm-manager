package com.kamalkavin96.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class WebClientConfig {

    private final String baseUrl;

    public WebClientConfig(@Value("${instabox.api.base-url}") String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Bean("instaboxRestClient")
    public RestClient instaboxRestClient() {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Accept", "application/json")
                .build();
    }
}
