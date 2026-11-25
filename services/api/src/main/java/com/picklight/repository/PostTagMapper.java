package com.picklight.repository;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.picklight.domain.post.PostTag;

@Mapper
public interface PostTagMapper {

    @Select("SELECT post_id, tag_id FROM post_tags WHERE post_id = #{postId} ORDER BY tag_id")
    List<PostTag> findByPostId(@Param("postId") long postId);

    @Insert("INSERT INTO post_tags (post_id, tag_id) VALUES (#{postId}, #{tagId})")
    int insert(PostTag postTag);

    @Delete("DELETE FROM post_tags WHERE post_id = #{postId} AND tag_id = #{tagId}")
    int delete(@Param("postId") long postId, @Param("tagId") long tagId);
}
