package com.picklight.controller;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.picklight.common.Result;

/**
 * 健康检查：T-005 的验收项，用于确认服务能起来、路由前缀正确。
 * 同时作为 {@link Result} 统一响应的最小示例。
 */
@RestController
@RequestMapping("/api/v1")
public class HealthController {

    @GetMapping("/health")
    public Result health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("version", "0.1.0");
        body.put("time", OffsetDateTime.now().toString());
        return Result.ok(body);
    }
}
