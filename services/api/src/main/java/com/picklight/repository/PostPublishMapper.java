package com.picklight.repository;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import com.picklight.domain.post.Tag;

@Mapper
public interface PostPublishMapper {
    @Select("SELECT status FROM users WHERE id = #{userId} FOR SHARE")
    String accountStatus(long userId);

    @Update("""
            UPDATE media SET post_id = #{postId}, sort_order = #{position}
            WHERE id = #{id} AND uploader_id = #{authorId} AND post_id IS NULL
            """)
    int attach(@Param("id") long id, @Param("authorId") long authorId,
            @Param("postId") long postId, @Param("position") int position);

    @Insert("INSERT INTO tags (name) VALUES (#{name}) ON DUPLICATE KEY UPDATE id = id")
    void ensureTag(String name);

    @Select("SELECT id, name FROM tags WHERE name = #{name} FOR UPDATE")
    Tag findTag(String name);
}
