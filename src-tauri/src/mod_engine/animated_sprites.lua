local animations = {
__JF_ANIMATION_DATA__
}
local sprites = setmetatable({}, {__mode = "k"})

local function update_frame(sprite)
    local atlas, pos = sprite.atlas, sprite.sprite_pos
    if not atlas or not pos or not sprite.sprite then return end
    local atlas_animations = animations[atlas.name or atlas.key]
    if not atlas_animations then return end

    local copy = sprite.sprite_pos_copy
    if copy and (copy.x ~= pos.x or copy.y ~= pos.y) then sprite:set_sprite_pos(pos) end

    local cached = sprites[sprite]
    if not cached or cached.atlas ~= atlas or cached.x ~= pos.x or cached.y ~= pos.y then
        local animation = atlas_animations[tostring(pos.x) .. ":" .. tostring(pos.y)]
        cached = {atlas = atlas, x = pos.x, y = pos.y, animation = animation,
            started = (G.TIMERS and G.TIMERS.REAL) or 0}
        sprites[sprite] = cached
    end
    if not cached.animation then return end

    local animation = cached.animation
    local elapsed = math.max(0, (((G.TIMERS and G.TIMERS.REAL) or 0) - cached.started) * 1000)
    local frames = animation.frames
    local index
    if animation.plays and elapsed >= animation.duration * animation.plays then
        index = #frames
    else
        local phase = elapsed % animation.duration
        local low, high = 1, #frames
        while low < high do
            local middle = math.floor((low + high) / 2)
            if phase < frames[middle].ends_at then high = middle else low = middle + 1 end
        end
        index = low
    end
    local frame = frames[index]
    if cached.index ~= index or cached.quad ~= sprite.sprite then
        local image_width, image_height = atlas.image:getDimensions()
        local x, y = frame.x * atlas.px, frame.y * atlas.py
        local width, height = sprite.scale.x, sprite.scale.y
        if x < 0 or y < 0 or x + width > image_width or y + height > image_height then return end
        sprite.sprite:setViewport(x, y, width, height)
        cached.index, cached.quad = index, sprite.sprite
    end
    return frame
end

local set_sprite_pos = Sprite.set_sprite_pos
function Sprite:set_sprite_pos(...)
    local cached = sprites[self]
    if cached then cached.index = nil end
    return set_sprite_pos(self, ...)
end

local draw_shader = Sprite.draw_shader
function Sprite:draw_shader(...)
    update_frame(self)
    return draw_shader(self, ...)
end

local draw_self = Sprite.draw_self
function Sprite:draw_self(...)
    update_frame(self)
    return draw_self(self, ...)
end

local draw_from = Sprite.draw_from
function Sprite:draw_from(...)
    update_frame(self)
    return draw_from(self, ...)
end

local get_pos_pixel = Sprite.get_pos_pixel
function Sprite:get_pos_pixel(...)
    local frame = update_frame(self)
    local position = get_pos_pixel(self, ...)
    if frame then position[1], position[2] = frame.x, frame.y end
    return position
end
