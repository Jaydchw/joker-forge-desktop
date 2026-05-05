-- Example: global_variable_chips
-- Object: joker
-- Purpose: verify a joker can read a global user variable in generated calculate/loc_vars.

SMODS.Joker {
    key = 'j_global_variable_chips',
    -- [JF:config] begin
    -- [JF:config] end
    -- [JF:loc_txt] begin
    loc_txt = {
        ['name'] = 'Global Variable Chips',
        ['text'] = {
            [1] = 'Adds chips from a global variable.'
        }
    },
    -- [JF:loc_txt] end
    pos = {
        x = 0,
        y = 0
    },
    -- [JF:props] begin
    cost = 4,
    rarity = 1,
    blueprint_compat = true,
    eternal_compat = true,
    perishable_compat = true,
    unlocked = true,
    discovered = true,
    atlas = 'Joker',
    -- [JF:props] end
    -- [JF:loc_vars] begin
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                ((G.GAME and G.GAME.jf_global_vars and G.GAME.jf_global_vars.globalvariabletest) or 1)
            }
        }
    end,
    -- [JF:loc_vars] end
    calculate = function(self, card, context)
        if context.joker_main then
            -- [JF:rule:rule_global_chips] begin
            return {
                chips = (G.GAME and G.GAME.jf_global_vars and G.GAME.jf_global_vars.globalvariabletest)
            }
            -- [JF:rule:rule_global_chips] end
        end
    end
}
