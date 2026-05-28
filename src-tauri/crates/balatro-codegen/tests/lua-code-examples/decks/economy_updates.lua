-- Purpose: Snapshot for `economy_updates` (deck) codegen output.

SMODS.Back {
    key = 'b_economy_updates',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = {
            interest_cap0 = 1,
            reroll_cost0 = 1
        }
    },
    loc_txt = {
        ['name'] = 'Economy Updates',
        ['text'] = {
            [1] = 'Applies direct economy modifications.'
        }
    },
    unlocked = true,
    discovered = true,
    no_collection = false,
    atlas = 'Enhancers',
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.interest_cap0,
                self.config.extra.reroll_cost0
            }
        }
    end,
    calculate = function(self, card, context)
        if context.main_eval then
            do
                G.GAME.interest_cap = G.GAME.interest_cap + self.config.extra.interest_cap0
                G.GAME.round_resets.reroll_cost = G.GAME.round_resets.reroll_cost + self.config.extra.reroll_cost0
                G.GAME.current_round.reroll_cost = math.max(0, G.GAME.current_round.reroll_cost + self.config.extra.reroll_cost0)
                return {
                    message = 'Interest Cap Changed',
                    colour = G.C.MONEY,
                    extra = {
                        message = 'Reroll Cost Changed',
                        colour = G.C.MONEY
                    }
                }
            end
        end
    end
}
