package com.picklight.common;

/**
 * 业务异常。Service 层遇到可预期的业务错误时抛出，由 {@link GlobalExceptionHandler}
 * 统一转成 {@link Result} 返回，Controller 无需到处 try-catch。
 */
public class BizException extends RuntimeException {

    private final ErrorCode code;
    private final Object details;

    public BizException(ErrorCode code) {
        super(code.getMessage());
        this.code = code;
        this.details = null;
    }

    public BizException(ErrorCode code, String message) {
        super(message);
        this.code = code;
        this.details = null;
    }

    public BizException(ErrorCode code, String message, Object details) {
        super(message);
        this.code = code;
        this.details = details;
    }

    public ErrorCode getCode() {
        return code;
    }

    public Object getDetails() {
        return details;
    }
}
