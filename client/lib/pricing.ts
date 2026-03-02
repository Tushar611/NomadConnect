import type { SubscriptionTier } from "@/context/SubscriptionContext";

const INDIA_TIMEZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

export function isIndiaUser(): boolean {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    if (/[-_]IN$/i.test(locale) || /in/i.test(locale.replace(/[-_]/g, " "))) {
      return true;
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (INDIA_TIMEZONES.has(tz)) {
      return true;
    }
  } catch {}

  return false;
}

export function getRegionalTierPrice(tier: SubscriptionTier): string {
  const inIndia = isIndiaUser();

  if (inIndia) {
    switch (tier) {
      case "starter":
        return "Free";
      case "explorer":
        return "INR 149/month";
      case "adventurer":
        return "INR 299/month";
      case "lifetime":
        return "INR 2,499";
      default:
        return "Free";
    }
  }

  switch (tier) {
    case "starter":
      return "Free";
    case "explorer":
      return "$4.99/month";
    case "adventurer":
      return "$9.99/month";
    case "lifetime":
      return "$99.99";
    default:
      return "Free";
  }
}
