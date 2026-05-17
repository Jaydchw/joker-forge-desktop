-- Purpose: Snapshot for `create_consumable_static` (joker) codegen output.

SMODS.Joker {
    key = 'j_create_consumable_static',
    
    config = {
        extra = { create_consumable_count0 = 1 }
    },
    
    
    loc_txt = {
        ['name'] = 'Create Consumable Static',
        ['text'] = {
            [1] = 'Creates a fixed consumable card.'
        }
    },
    
    pos = {
        x = 0,
        y = 0
    },
    
    cost = 4,
    rarity = 1,
    blueprint_compat = true,
    eternal_compat = true,
    perishable_compat = true,
    unlocked = true,
    discovered = true,
    atlas = 'Joker',
    
    
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.create_consumable_count0
            }
        }
    end,
    
    calculate = function(self, card, context)
        if context.joker_main then
            if #G.consumeables.cards + (G.GAME.consumeable_buffer or 0) < G.consumeables.config.card_limit then SMODS.add_card({ area = G.consumeables, key = 'c_fool', set = 'Tarot' }) end
            return {
                message = localize('k_plus_consumable'),
                colour = G.C.GREEN
            }
        end
    end
}
