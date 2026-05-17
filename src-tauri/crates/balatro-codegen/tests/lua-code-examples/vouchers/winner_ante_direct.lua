-- Purpose: Snapshot for `winner_ante_direct` (voucher) codegen output.

SMODS.Voucher {
    key = 'v_winner_ante_direct',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { winner_ante_value0 = 1 }
    },
    loc_txt = {
        ['name'] = 'Winner Ante Direct',
        ['text'] = {
            [1] = 'Voucher fixture for direct winner ante updates.'
        }
    },
    cost = 10,
    unlocked = true,
    discovered = true,
    no_collection = false,
    can_repeat_soul = false,
    atlas = 'Voucher',
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.winner_ante_value0
            }
        }
    end,
    calculate = function(self, card, context)
        if context.main_eval then
            local ante = G.GAME.win_ante + card.ability.extra.winner_ante_value0
            local int_part, frac_part = math.modf(ante)
            local rounded = int_part + (frac_part >= 0.5 and 1 or 0)
            G.GAME.win_ante = rounded
            return {
                message = "Winner Ante +"..tostring(card.ability.extra.winner_ante_value0),
                colour = G.C.FILTER
            }
        end
    end
}
