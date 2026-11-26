package com.picklight.common;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

/**
 * 全局异常处理。把各类异常统一转成 {@link Result}，HTTP 状态码按错误类型区分：
 * 未登录 401、无权限 403、参数错误 400、资源不存在 404、其余 500。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 业务异常：code 与 message 已在 BizException 里定好。 */
    @ExceptionHandler(BizException.class)
    public ResponseEntity<Result> handleBiz(BizException e) {
        HttpStatus status = toHttpStatus(e.getCode());
        Result body = e.getDetails() != null
                ? Result.error(e.getCode(), e.getMessage(), e.getDetails())
                : Result.error(e.getCode(), e.getMessage());
        return ResponseEntity.status(status).body(body);
    }

    /** @Valid 参数校验失败：汇总每个字段的第一条错误。 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> details = new LinkedHashMap<>();
        for (FieldError fe : e.getBindingResult().getFieldErrors()) {
            details.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        return ResponseEntity.badRequest()
                .body(Result.error(ErrorCode.VALIDATION_FAILED, "参数校验失败", details));
    }

    /** 请求体缺失或 JSON 格式错误。 */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Result> handleNotReadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest()
                .body(Result.error(ErrorCode.BAD_REQUEST, "请求体缺失或格式错误"));
    }

    /** 路径参数类型错误，如 /posts/abc。 */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Result> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.badRequest()
                .body(Result.error(ErrorCode.BAD_REQUEST, "参数类型不正确：", e.getName()));
    }

    /** 不存在的静态资源 / 路径。 */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Result> handleNoResource(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Result.error(ErrorCode.NOT_FOUND, "请求的资源不存在"));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Result> handleUploadLimit(MaxUploadSizeExceededException e) {
        return ResponseEntity.badRequest().body(Result.error(ErrorCode.MEDIA_TOO_LARGE));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<Result> handleInvalidMultipart(MultipartException e) {
        return ResponseEntity.badRequest().body(Result.error(ErrorCode.BAD_REQUEST, "无法解析上传请求"));
    }

    /** 兜底：未预期的异常，记录日志，对外只给通用提示。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result> handleOther(Exception e) {
        log.error("未处理异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.error(ErrorCode.INTERNAL_ERROR));
    }

    private HttpStatus toHttpStatus(ErrorCode code) {
        return switch (code) {
            case UNAUTHORIZED, WRONG_CREDENTIALS -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN, ACCOUNT_DISABLED, RATING_NOT_ALLOWED -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT, USERNAME_TAKEN -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_REQUEST;
        };
    }
}
