package com.picklight.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.picklight.domain.post.Tag;

@Mapper
public interface TagMapper extends BaseMapper<Tag> {
}
