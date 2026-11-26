package com.picklight;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.picklight.common.BizException;
import com.picklight.service.post.PublishPostRequest;

class PublishPostRequestTest {
    private final ObjectMapper json = new ObjectMapper();

    private PublishPostRequest parse(String raw) throws Exception {
        return PublishPostRequest.from((ObjectNode) json.readTree(raw));
    }

    @Test
    void requiresContentAndStrictlyTypedMediaIds() {
        for (String body : List.of("{}", "{\"body\":\"　 \"}", "{\"tags\":[\"only\"]}",
                "{\"mediaIds\":[0]}", "{\"mediaIds\":[null]}", "{\"mediaIds\":[1.5]}",
                "{\"mediaIds\":[\"7\"]}", "{\"mediaIds\":[7,7]}", "{\"body\":42}",
                "{\"mediaIds\":[1,2,3,4,5,6,7,8,9,10]}")) {
            assertThrows(BizException.class, () -> parse(body), body);
        }
    }

    @Test
    void bodyLengthCountsUnicodeCodePoints() throws Exception {
        String boundary = "🌱".repeat(2000);
        assertEquals(boundary, parse(json.createObjectNode().put("body", boundary).toString()).body());
        assertThrows(BizException.class, () -> parse(json.createObjectNode().put("body", boundary + "字").toString()));
    }

    @Test
    void deduplicatesNormalizedTagsBeforeCounting() throws Exception {
        assertEquals(List.of("A B","2","3","4","5"), parse("""
                {"body":"正文","tags":[" A　B ", "a b", "2","3","4","5"]}
                """).tags());
        assertThrows(BizException.class, () -> parse("""
                {"body":"正文","tags":["1","2","3","4","5","6"]}
                """));
    }
}
