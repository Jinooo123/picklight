package com.picklight.common;

/**
 * 统一错误码。全服务端所有业务错误都从这里取值，前端据此做分支处理。
 *
 * <p>约定：0 表示成功；4xxxx 客户端问题；5xxxx 服务端问题。
 */
public enum ErrorCode {

    OK(0, "成功"),

    BAD_REQUEST(40000, "请求参数错误"),
    VALIDATION_FAILED(40001, "参数校验失败"),
    UNAUTHORIZED(40100, "未登录或登录已过期"),
    FORBIDDEN(40300, "无权限执行此操作"),
    NOT_FOUND(40400, "资源不存在"),
    CONFLICT(40900, "资源状态冲突"),

    USERNAME_TAKEN(40901, "用户名已被占用"),
    ACCOUNT_DISABLED(40301, "账号已被禁用"),
    WRONG_CREDENTIALS(40101, "用户名或密码错误"),
    WRONG_OLD_PASSWORD(40002, "旧密码不正确"),

    RATING_NOT_ALLOWED(40302, "不能给自己的动态评分"),
    RATING_OUT_OF_RANGE(40003, "评分须在 1-5 之间"),

    MEDIA_TOO_LARGE(40010, "文件超出大小限制"),
    MEDIA_TYPE_UNSUPPORTED(40011, "不支持的文件类型"),

    INTERNAL_ERROR(50000, "服务内部错误");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
