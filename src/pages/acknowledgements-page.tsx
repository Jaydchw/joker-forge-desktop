import { motion, type Variants } from "framer-motion";
import {
  Heart,
  Sparkle,
  Cube,
  UsersThree,
  DiscordLogo,
  BookOpenText,
  Medal,
  Scroll,
} from "@phosphor-icons/react";

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const technologyLinks = [
  { label: "React", href: "https://reactjs.org/" },
  { label: "Tailwind CSS", href: "https://tailwindcss.com/" },
  { label: "Heroicons", href: "https://heroicons.com/" },
  { label: "Framer Motion", href: "https://motion.dev/" },
];

const jokerForgeDevelopers = [
  { label: "Taylor", href: "https://github.com/fr0derick" },
  { label: "Eastern Farmer", href: "https://github.com/EasternFarmer" },
  { label: "ButterStutter", href: "https://github.com/Butterstutter" },
  { label: "CavoShoku", href: "https://github.com/cavoshoki" },
  { label: "PATO FOFO" },
];

const smodsResources = [
  {
    label: "SMODS Documentation",
    href: "https://github.com/Steamodded/smods/wiki",
  },
  { label: "Vanilla Remade", href: "https://github.com/nh6574/VanillaRemade" },
  {
    label: "Extra Credit",
    href: "https://github.com/GuilloryCraft/ExtraCredit",
  },
  { label: "Grab Bag", href: "https://github.com/thefaketh30ne/grab-bag" },
  { label: "Debug Plus", href: "https://github.com/WilsontheWolf/DebugPlus" },
  { label: "Handy", href: "https://github.com/SleepyG11/HandyBalatro" },
];

const nodeLibraries = [
  { label: "React Router", href: "https://reactrouter.com/" },
  { label: "Tauri", href: "https://tauri.app/" },
  { label: "Radix UI", href: "https://www.radix-ui.com/" },
  { label: "CodeMirror", href: "https://codemirror.net/" },
  { label: "Zod", href: "https://zod.dev/" },
  { label: "Sonner", href: "https://sonner.emilkowal.ski/" },
];

const communitySupporters = [
  "Infinidex",
  "Amo",
  "Zan",
  "Saucequest31",
  "kierkat10",
  "cokeblock4043",
  "h0tp1nkl3monade",
  "iobozzad",
];

const floatingHearts = [
  { left: "2%", size: 20, delay: 0, duration: 18, drift: 24 },
  { left: "6%", size: 14, delay: 2, duration: 21, drift: -16 },
  { left: "10%", size: 18, delay: 1, duration: 19, drift: 28 },
  { left: "14%", size: 12, delay: 3, duration: 22, drift: -20 },
  { left: "18%", size: 22, delay: 0, duration: 17, drift: 26 },
  { left: "24%", size: 16, delay: 4, duration: 23, drift: -18 },
  { left: "30%", size: 24, delay: 2, duration: 20, drift: 22 },
  { left: "36%", size: 14, delay: 1, duration: 18, drift: -24 },
  { left: "42%", size: 20, delay: 3, duration: 21, drift: 18 },
  { left: "48%", size: 12, delay: 0, duration: 24, drift: -22 },
  { left: "54%", size: 18, delay: 2, duration: 19, drift: 20 },
  { left: "60%", size: 16, delay: 1, duration: 22, drift: -26 },
  { left: "66%", size: 22, delay: 4, duration: 18, drift: 24 },
  { left: "72%", size: 14, delay: 0, duration: 23, drift: -18 },
  { left: "78%", size: 20, delay: 2, duration: 20, drift: 26 },
  { left: "84%", size: 12, delay: 3, duration: 24, drift: -20 },
  { left: "90%", size: 18, delay: 1, duration: 19, drift: 22 },
  { left: "96%", size: 14, delay: 0, duration: 21, drift: -16 },
];

export default function AcknowledgementsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(rgba(62,139,112,0.12)_1px,transparent_1px)] [background-size:26px_26px]" />
      <div className="pointer-events-none absolute inset-0 opacity-55">
        {floatingHearts.map((heart, index) => (
          <motion.div
            key={`${heart.left}-${index}`}
            className="absolute text-balatro-red/80 mix-blend-multiply"
            style={{ left: heart.left, top: "-12%" }}
            animate={{
              y: ["-10vh", "110vh"],
              x: [0, heart.drift],
              rotate: [0, 180, 320],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: heart.duration,
              delay: heart.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Heart size={heart.size} weight="fill" />
          </motion.div>
        ))}
      </div>

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.section
          variants={itemVariants}
          className="pb-6 border-b border-border/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Acknowledgements
              </p>
              <h1 className="text-4xl font-game tracking-tight text-foreground sm:text-5xl">
                A Love Letter To Everyone Behind Joker Forge
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                Joker Forge Desktop is powered by a mix of open-source tools,
                community knowledge, and the creators who shaped the original
                Joker Forge experience.
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Heart className="h-10 w-10" weight="fill" />
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.section variants={itemVariants} className="relative pl-6">
            <div className="flex items-center gap-3 text-foreground/90">
              <Cube className="h-5 w-5 text-primary" weight="duotone" />
              <h2 className="text-lg font-semibold tracking-tight">
                Core Technologies
              </h2>
            </div>
            <span className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary/20" />
            <p className="mt-2 text-sm text-muted-foreground">
              The building blocks that keep the desktop experience crisp.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {technologyLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between rounded-xl px-2 py-2 text-sm font-medium text-foreground/80 transition hover:text-foreground hover:translate-x-0.5"
                  >
                    <span>{item.label}</span>
                    <Sparkle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section variants={itemVariants} className="relative pl-6">
            <div className="flex items-center gap-3 text-foreground/90">
              <Medal className="h-5 w-5 text-primary" weight="duotone" />
              <h2 className="text-lg font-semibold tracking-tight">
                Joker Forge Desktop
              </h2>
            </div>
            <span className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary/20" />
            <p className="mt-2 text-sm text-muted-foreground">
              Main developer for the desktop build.
            </p>
            <a
              href="https://github.com/jaydchw"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-foreground/90 transition hover:text-foreground hover:translate-x-0.5"
            >
              Jayden Holdsworth
              <Heart className="h-4 w-4 text-primary" weight="fill" />
            </a>
          </motion.section>
        </div>

        <motion.section variants={itemVariants} className="relative pl-6">
          <div className="flex items-center gap-3 text-foreground/90">
            <UsersThree className="h-5 w-5 text-primary" weight="duotone" />
            <h2 className="text-lg font-semibold tracking-tight">
              Joker Forge Developers
            </h2>
          </div>
          <span className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary/20" />
          <p className="mt-2 text-sm text-muted-foreground">
            Developers who worked on Joker Forge itself.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {jokerForgeDevelopers.map((dev) => (
              <li key={dev.label}>
                {dev.href ? (
                  <a
                    href={dev.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl px-2 py-2 text-sm font-medium text-foreground/80 transition hover:text-foreground hover:translate-x-0.5"
                  >
                    {dev.label}
                    <Sparkle className="h-4 w-4 text-muted-foreground" />
                  </a>
                ) : (
                  <div className="flex items-center justify-between rounded-xl px-2 py-2 text-sm font-medium text-foreground/80">
                    {dev.label}
                    <Sparkle className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.section variants={itemVariants} className="relative pl-6">
            <div className="flex items-center gap-3 text-foreground/90">
              <DiscordLogo className="h-5 w-5 text-primary" weight="duotone" />
              <h2 className="text-lg font-semibold tracking-tight">
                Community Thanks
              </h2>
            </div>
            <span className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary/20" />
            <p className="mt-3 text-sm text-muted-foreground">
              Huge thanks to the folks over at the{" "}
              <a
                href="https://discord.com/invite/balatro"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Balatro discord server
              </a>{" "}
              for their help and support during development.
            </p>
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-semibold text-foreground">
                Special mention:{" "}
                <span className="text-primary">Infinidex</span>
              </p>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {communitySupporters.map((supporter) => (
                <li
                  key={supporter}
                  className="rounded-xl px-2 py-2 text-sm font-medium text-foreground/80"
                >
                  {supporter}
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section variants={itemVariants} className="relative pl-6">
            <div className="flex items-center gap-3 text-foreground/90">
              <Cube className="h-5 w-5 text-primary" weight="duotone" />
              <h2 className="text-lg font-semibold tracking-tight">
                Node Libraries
              </h2>
            </div>
            <span className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary/20" />
            <p className="mt-2 text-sm text-muted-foreground">
              Additional libraries that keep the app moving fast.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {nodeLibraries.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between rounded-xl px-2 py-2 text-sm font-medium text-foreground/80 transition hover:text-foreground hover:translate-x-0.5"
                  >
                    <span>{item.label}</span>
                    <Sparkle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section variants={itemVariants} className="relative pl-6">
            <div className="flex items-center gap-3 text-foreground/90">
              <BookOpenText className="h-5 w-5 text-primary" weight="duotone" />
              <h2 className="text-lg font-semibold tracking-tight">
                SMODS Learning Resources
              </h2>
            </div>
            <span className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary/20" />
            <p className="mt-2 text-sm text-muted-foreground">
              Particularly great resources for learning SMODS (and some mods I
              like in general).
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {smodsResources.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between rounded-xl px-2 py-2 text-sm font-medium text-foreground/80 transition hover:text-foreground hover:translate-x-0.5"
                  >
                    <span>{item.label}</span>
                    <Sparkle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>

        <motion.section
          variants={itemVariants}
          className="pt-4 border-t border-border/40 text-center"
        >
          <div className="flex items-center justify-center gap-3 text-foreground/90">
            <Scroll className="h-5 w-5 text-primary" weight="duotone" />
            <h2 className="text-lg font-semibold tracking-tight">
              Extra Thanks
            </h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Joker Forge would not be possible without Balatro itself, so thanks
            to{" "}
            <a
              href="https://localthunk.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              LocalThunk
            </a>
            .
          </p>
          <div className="mt-6 text-xs text-muted-foreground">
            <p>Logo from Flaticon</p>
            <p>Icons from Phosphor Icons</p>
            <p>
              This project is licensed under the{" "}
              <a
                href="https://opensource.org/license/mit/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                MIT License
              </a>
              . Go wild with it!
            </p>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
