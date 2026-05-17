-- Purpose: verify a joker can read a global user variable in generated calculate/loc_vars.

SMODS.Joker {
    key = 'j_global_variable_chips',
    loc_txt = {
        ['name'] = 'Global Variable Chips',
        ['text'] = {
            [1] = 'Adds chips from a global variable.'
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
                ((G.GAME and G.GAME.jf_global_vars and G.GAME.jf_global_vars.globalvariabletest) or 1)
            }
        }
    end,
    calculate = function(self, card, context)
        if context.joker_main then
            return {
                chips = (G.GAME and G.GAME.jf_global_vars and G.GAME.jf_global_vars.globalvariabletest)
            }
        end
    end
}
