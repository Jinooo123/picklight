package com.picklight;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;
import com.picklight.common.Result;

class ResultTest {

    @Test
    void okCarriesData() {
        Result r = Result.ok("hello");
        assertThat(r.getCode()).isZero();
        assertThat(r.getData()).isEqualTo("hello");
    }

    @Test
    void pageBuildsFixedFields() {
        Result r = Result.page(java.util.List.of("a", "b"), 42L, 1, 20);
        @SuppressWarnings("unchecked")
        var body = (java.util.Map<String, Object>) r.getData();
        assertThat(body.get("items")).asList().hasSize(2);
        assertThat(body.get("total")).isEqualTo(42L);
        assertThat(body.get("page")).isEqualTo(1);
        assertThat(body.get("pageSize")).isEqualTo(20);
    }

    @Test
    void errorKeepsCodeAndMessage() {
        Result r = Result.error(ErrorCode.NOT_FOUND);
        assertThat(r.getCode()).isEqualTo(ErrorCode.NOT_FOUND.getCode());
        assertThat(r.getMessage()).isEqualTo("资源不存在");
    }

    @Test
    void bizExceptionCarriesCode() {
        BizException e = new BizException(ErrorCode.USERNAME_TAKEN);
        assertThat(e.getCode()).isEqualTo(ErrorCode.USERNAME_TAKEN);
    }
}
