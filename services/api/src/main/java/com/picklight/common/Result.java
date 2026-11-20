package com.picklight.common;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 统一响应体。成功时 code=0，业务数据放 data；失败时 code 非 0，message 为可读提示。
 *
 * <p>分页列表统一用 {@link #page(Object, long, int, int)} 构造，字段固定为
 * items / page / pageSize / total（见 docs/02-architecture.md 第 4 节）。
 */
public final class Result {

    private final int code;
    private final String message;
    private final Object data;

    private Result(int code, String message, Object data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public Object getData() {
        return data;
    }

    /** 成功，无数据。 */
    public static Result ok() {
        return new Result(ErrorCode.OK.getCode(), ErrorCode.OK.getMessage(), null);
    }

    /** 成功，携带业务数据。 */
    public static Result ok(Object data) {
        return new Result(ErrorCode.OK.getCode(), ErrorCode.OK.getMessage(), data);
    }

    /** 分页列表。 */
    public static Result page(Object items, long total, int page, int pageSize) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items);
        body.put("total", total);
        body.put("page", page);
        body.put("pageSize", pageSize);
        return ok(body);
    }

    /** 失败，使用错误码内置消息。 */
    public static Result error(ErrorCode code) {
        return new Result(code.getCode(), code.getMessage(), null);
    }

    /** 失败，覆盖默认消息（用于带上下文的提示）。 */
    public static Result error(ErrorCode code, String message) {
        return new Result(code.getCode(), message, null);
    }

    /** 失败，附带 details（如参数校验的具体字段错误）。 */
    public static Result error(ErrorCode code, String message, Object details) {
        return new Result(code.getCode(), message, details);
    }
}
