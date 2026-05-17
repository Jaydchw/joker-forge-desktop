-- Purpose: Snapshot for `direct_draw_helper` (seal) codegen output.

SMODS.Seal {
    key = 's_direct_draw_helper',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { card_draw0 = 1 }
    },
    badge_colour = HEX('FF0000'),
    loc_txt = {
        ['name'] = 'Direct Draw Helper',
        ['label'] = 'Direct Draw Helper',
        ['text'] = {
            [1] = 'Seal fixture using draw helper.'
        }
    },
    atlas = 'centers',
    unlocked = true,
    discovered = true,
    no_collection = false,
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.card_draw0
            }
        }
    end,
    calculate = function(self, card, context)
        if context.main_scoring and context.cardarea == G.play then
            SMODS.draw_cards(card.ability.seal.extra.card_draw0)
            return {
                message = "+"..tostring(card.ability.seal.extra.card_draw0)..' Cards Drawn',
                colour = G.C.BLUE
            }
        end
    end
}
