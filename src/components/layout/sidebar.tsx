import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  House,
  FileText,
  Smiley,
  Cards,
  Flask,
  Ticket,
  Package,
  Stamp,
  SpeakerHigh,
  PushPin,
  ClipboardText,
  Storefront,
  Stack,
  ListNumbers,
  Palette,
  Star,
  Sparkle,
  CaretDown,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence, Variants } from "framer-motion";

interface SidebarProps {
  isVisible: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const PROJECT_MAIN = [
  { label: "Overview", icon: House, href: "/", color: "text-foreground" },
  {
    label: "Mod Metadata",
    icon: FileText,
    href: "/metadata",
    color: "text-foreground",
  },
];

const COLLAPSIBLE_GROUPS = [
  {
    id: "jokers",
    title: "Jokers",
    icon: Smiley,
    items: [
      {
        label: "Jokers",
        icon: Smiley,
        href: "/jokers",
        color: "text-joker-primary",
      },
      {
        label: "Rarities",
        icon: Sparkle,
        href: "/rarities",
        color: "text-joker-primary",
      },
    ],
  },
  {
    id: "consumables",
    title: "Consumables",
    icon: Flask,
    items: [
      {
        label: "Consumables",
        icon: Flask,
        href: "/consumables",
        color: "text-consumable-primary",
      },
      {
        label: "Consumable Sets",
        icon: Palette,
        href: "/consumable-sets",
        color: "text-consumable-primary",
      },
    ],
  },
  {
    id: "card_mod",
    title: "Card Modification",
    icon: ClipboardText,
    items: [
      {
        label: "Enhancements",
        icon: Star,
        href: "/enhancements",
        color: "text-enhancement-primary",
      },
      {
        label: "Seals",
        icon: Stamp,
        href: "/seals",
        color: "text-seal-primary",
      },
      {
        label: "Editions",
        icon: Palette,
        href: "/editions",
        color: "text-edition-primary",
      },
    ],
  },
  {
    id: "shop",
    title: "Shop",
    icon: Storefront,
    items: [
      {
        label: "Booster Packs",
        icon: Package,
        href: "/boosters",
        color: "text-booster-primary",
      },
      {
        label: "Vouchers",
        icon: Ticket,
        href: "/vouchers",
        color: "text-voucher-primary",
      },
    ],
  },
  {
    id: "decks",
    title: "Decks & Challenges",
    icon: Stack,
    items: [
      {
        label: "Decks",
        icon: Cards,
        href: "/decks",
        color: "text-deck-primary",
      },
    ],
  },
  {
    id: "misc",
    title: "Misc",
    icon: ListNumbers,
    items: [
      {
        label: "Sounds",
        icon: SpeakerHigh,
        href: "/sounds",
        color: "text-sound-primary",
      },
    ],
  },
];

const sidebarVariants: Variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30, delay: 0 },
  },
  closed: {
    x: -300,
    opacity: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
};

const menuListVariants: Variants = {
  open: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
  closed: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};

const itemVariants: Variants = {
  open: { x: 0, opacity: 1 },
  closed: { x: -20, opacity: 0 },
};

export function Sidebar({
  isVisible,
  isPinned,
  onTogglePin,
  onMouseEnter,
  onMouseLeave,
}: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    jokers: true,
    consumables: true,
    card_mod: true,
    shop: true,
    decks: true,
    misc: true,
  });
  const location = useLocation();

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <motion.aside
      initial="closed"
      animate={isVisible ? "open" : "closed"}
      variants={sidebarVariants}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "fixed left-4 top-28 bottom-4 z-50 w-64 rounded-xl",
        "bg-sidebar backdrop-blur-xl shadow-2xl",
        "flex flex-col overflow-hidden border border-sidebar-border transition-colors duration-300",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border cursor-default">
        <h2 className="text-sm font-bold text-sidebar-foreground uppercase tracking-wider pl-1">
          Navigation
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePin}
          className={cn(
            "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors h-8 w-8 cursor-pointer",
            isPinned &&
              "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary",
          )}
        >
          <PushPin weight={isPinned ? "fill" : "regular"} className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-4 sidebar-scroll">
        <motion.div variants={menuListVariants} className="space-y-6">
          <div>
            <div className="space-y-1">
              {PROJECT_MAIN.map((item) => (
                <motion.div key={item.label} variants={itemVariants}>
                  <Button
                    variant="ghost"
                    asChild
                    className={cn(
                      "w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 h-10 px-3 cursor-pointer",
                      location.pathname === item.href &&
                        "bg-sidebar-accent text-sidebar-foreground",
                    )}
                  >
                    <Link to={item.href}>
                      <item.icon
                        className={cn("mr-3 h-5 w-5 opacity-90", item.color)}
                        weight="duotone"
                      />
                      {item.label}
                    </Link>
                  </Button>
                </motion.div>
              ))}

              {COLLAPSIBLE_GROUPS.map((group) => {
                const isOpen = openGroups[group.id];
                return (
                  <motion.div
                    key={group.id}
                    variants={itemVariants}
                    className="pt-1"
                  >
                    <Button
                      variant="ghost"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full justify-between text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 h-10 px-3 cursor-pointer"
                    >
                      <div className="flex items-center">
                        <group.icon
                          className="mr-3 h-5 w-5 opacity-70"
                          weight="regular"
                        />
                        <span className="text-sm font-medium">
                          {group.title}
                        </span>
                      </div>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CaretDown className="h-4 w-4 opacity-50" />
                      </motion.div>
                    </Button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-4 pr-1 py-1 space-y-1 border-l border-sidebar-border ml-5 my-1">
                            {group.items.map((subItem) => (
                              <Button
                                key={subItem.label}
                                variant="ghost"
                                asChild
                                className={cn(
                                  "w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-primary/10 h-9 text-sm cursor-pointer",
                                  location.pathname === subItem.href &&
                                    "bg-sidebar-primary/10 text-sidebar-primary",
                                )}
                              >
                                <Link to={subItem.href}>
                                  <subItem.icon
                                    className={cn(
                                      "mr-3 h-4 w-4",
                                      subItem.color,
                                    )}
                                    weight="duotone"
                                  />
                                  {subItem.label}
                                </Link>
                              </Button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </ScrollArea>
    </motion.aside>
  );
}
