-- Purpose: Snapshot for `draw_and_level_helpers` (joker) codegen output.

SMODS.Joker {
    key = 'j_draw_and_level_helpers',
    
    config = {
        extra = {
            card_draw0 = 2,
            level_amount0 = 1
        }
    },
    
    
    loc_txt = {
        ['name'] = 'Draw And Level Helpers',
        ['text'] = {
            [1] = 'Uses SMODS helper functions.'
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
                self.config.extra.card_draw0,
                self.config.extra.level_amount0
            }
        }
    end,
    
    calculate = function(self, card, context)
        if context.joker_main then
            SMODS.draw_cards(card.ability.extra.card_draw0)
            SMODS.smart_level_up_hand(card, context.scoring_name, false, card.ability.extra.level_amount0)
            return {
                message = "+"..tostring(card.ability.extra.card_draw0)..' Cards Drawn',
                colour = G.C.BLUE,
                extra = {
                    message = localize('k_level_up_ex'),
                    colour = G.C.GREEN
                }
            }
        end
    end
}
