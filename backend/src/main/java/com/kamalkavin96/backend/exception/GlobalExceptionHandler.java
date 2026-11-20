package com.kamalkavin96.backend.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientResponseException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private final ObjectMapper objectMapper;

    public GlobalExceptionHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<JsonNode> handleRestClientException(
            RestClientResponseException ex) {

        try {
            JsonNode errorResponse = objectMapper.readTree(
                    ex.getResponseBodyAsString()
            );

            return ResponseEntity
                    .status(ex.getStatusCode())
                    .body(errorResponse);

        } catch (Exception ignored) {

            JsonNode fallback = objectMapper.createObjectNode()
                    .put("success", false)
                    .put("message", ex.getMessage());

            return ResponseEntity
                    .status(ex.getStatusCode())
                    .body(fallback);
        }
    }
}