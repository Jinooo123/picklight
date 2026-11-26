package com.picklight.service.post;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.picklight.common.BizException;
import com.picklight.common.ErrorCode;

public record PublishPostRequest(String body, List<String> tags, List<Long> mediaIds) {
    private static final Pattern WHITESPACE = Pattern.compile("[\\s\\uFEFF]+", Pattern.UNICODE_CHARACTER_CLASS);

    public static PublishPostRequest from(ObjectNode json) {
        JsonNode text = json.get("body");
        if (text != null && !text.isNull() && !text.isTextual()) throw invalid("正文必须是字符串");
        String body = text == null || text.isNull() ? "" : text.textValue();
        if (body.codePointCount(0, body.length()) > 2000) throw invalid("正文最多 2000 字");

        var media = new LinkedHashSet<Long>();
        for (JsonNode id : array(json, "mediaIds")) {
            if (!id.isIntegralNumber() || !id.canConvertToLong() || id.longValue() <= 0) {
                throw invalid("媒体编号必须是正整数");
            }
            if (!media.add(id.longValue())) throw invalid("媒体编号不能重复");
            if (media.size() > 9) throw invalid("最多选择 9 张图片或 1 个视频");
        }
        if (WHITESPACE.matcher(body).replaceAll("").isEmpty() && media.isEmpty()) {
            throw invalid("正文和媒体不能同时为空");
        }

        var tags = new LinkedHashMap<String, String>();
        for (JsonNode token : array(json, "tags")) {
            if (!token.isTextual()) throw invalid("标签必须是字符串");
            String name = WHITESPACE.matcher(token.textValue()).replaceAll(" ").strip();
            if (name.isEmpty() || name.codePointCount(0, name.length()) > 10) {
                throw invalid("标签须为 1 至 10 个字");
            }
            tags.putIfAbsent(name.toLowerCase(Locale.ROOT), name);
            if (tags.size() > 5) throw invalid("最多添加 5 个标签");
        }
        return new PublishPostRequest(body, List.copyOf(tags.values()), List.copyOf(media));
    }

    private static Iterable<JsonNode> array(ObjectNode json, String field) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull()) return List.of();
        if (!node.isArray()) throw invalid(field + " 必须是数组");
        return node;
    }

    private static BizException invalid(String message) {
        return new BizException(ErrorCode.BAD_REQUEST, message);
    }
}
