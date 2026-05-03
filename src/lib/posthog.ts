import posthog from "posthog-js";

export function initPostHog() {
  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

  if (!key || !host) return;

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
  });
}

export { posthog };
