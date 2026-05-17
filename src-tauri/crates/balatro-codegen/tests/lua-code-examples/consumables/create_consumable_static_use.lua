-- Purpose: Snapshot for `create_consumable_static_use` (consumable) codegen output.

SMODS.Consumable {
    key = 'c_create_consumable_static_use',
    set = 'Tarot',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { create_consumable_count0 = 1 }
    },
    loc_txt = {
        ['name'] = 'Create Consumable Static Use',
        ['text'] = {
            [1] = 'Creates a fixed consumable when used.'
        }
    },
    cost = 3,
    unlocked = true,
    discovered = true,
    hidden = false,
    can_repeat_soul = false,
    atlas = 'Consumables',
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.create_consumable_count0
            }
        }
    end,
    use = function(self, card, area, copier)
        if #G.consumeables.cards + (G.GAME.consumeable_buffer or 0) < G.consumeables.config.card_limit then SMODS.add_card({ area = G.consumeables, key = 'c_fool', set = 'Tarot' }) end
        return {
            message = localize('k_plus_consumable'),
            colour = G.C.GREEN
        }
    end,
    can_use = function(self, card)
        return true
    end
}
