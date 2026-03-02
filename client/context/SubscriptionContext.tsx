import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { PurchasesOffering, CustomerInfo } from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import {
  configureRevenueCat,
  getSubscriptions,
  purchasePackage as rcPurchasePackage,
  checkUserEntitlements,
  restorePurchases as rcRestorePurchases,
  addCustomerInfoListener,
  identifyUser,
  ENTITLEMENT_EXPLORER,
  ENTITLEMENT_ADVENTURER,
  ENTITLEMENT_LIFETIME,
} from "@/services/revenuecat";
import { getRegionalTierPrice } from "@/lib/pricing";

export type SubscriptionTier = "starter" | "explorer" | "adventurer" | "lifetime";

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isLoading: boolean;
  offerings: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  userEntitlements: string[];
  isPro: boolean;
  isPremium: boolean;
  isConfigured: boolean;
  purchasePackage: (packageId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
  getTierFeatures: (tier: SubscriptionTier) => string[];
  getTierPrice: (tier: SubscriptionTier) => string;
  presentPaywall: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

const TIER_STORAGE_KEY = "subscription_tier";
const ENTITLEMENTS_STORAGE_KEY = "subscription_entitlements";

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  starter: [
    "2 profile boosts per day",
    "2 Compatibility checks per day",
    "4 Activities per month",
  ],
  explorer: [
    "15 profile boosts per day",
    "15 Compatibility checks per day",
    "15 Activities per month",
  ],
  adventurer: [
    "Unlimited profile boosts",
    "Unlimited Compatibility checks",
    "Unlimited Activities",
  ],
  lifetime: [
    "Unlimited profile boosts",
    "Unlimited Compatibility checks",
    "Unlimited Activities",
  ],
};

export const TIER_LIMITS: Record<
  SubscriptionTier,
  { activities: number; radarScans: number; compatChecks: number }
> = {
  starter: { activities: 4, radarScans: 2, compatChecks: 2 },
  explorer: { activities: 15, radarScans: 15, compatChecks: 15 },
  adventurer: { activities: -1, radarScans: -1, compatChecks: -1 },
  lifetime: { activities: -1, radarScans: -1, compatChecks: -1 },
};


const includesAny = (values: string[], keywords: string[]) => {
  const normalizedValues = values.map((value) => value.toLowerCase());
  return keywords.some((keyword) =>
    normalizedValues.some((value) => value.includes(keyword.toLowerCase())),
  );
};

function getTierFromEntitlements(activeEntitlements: string[]): SubscriptionTier {
  if (
    activeEntitlements.includes(ENTITLEMENT_LIFETIME) ||
    includesAny(activeEntitlements, ["lifetime", "forever"])
  ) {
    return "lifetime";
  }
  if (
    activeEntitlements.includes(ENTITLEMENT_ADVENTURER) ||
    includesAny(activeEntitlements, ["adventurer", "expert", "premium"])
  ) {
    return "adventurer";
  }
  if (
    activeEntitlements.includes(ENTITLEMENT_EXPLORER) ||
    includesAny(activeEntitlements, ["explorer", "pro", "nomad connect pro"])
  ) {
    return "explorer";
  }
  return "starter";
}

function getTierFromCustomerInfo(info: CustomerInfo): SubscriptionTier {
  const activeEntitlements = Object.keys(info.entitlements.active);
  const activeProducts = info.activeSubscriptions || [];

  const hasLifetime =
    info.entitlements.active[ENTITLEMENT_LIFETIME]?.isActive === true ||
    includesAny(activeEntitlements, ["lifetime", "forever"]) ||
    includesAny(activeProducts, ["lifetime", "forever"]);

  if (hasLifetime) return "lifetime";

  const hasAdventurer =
    info.entitlements.active[ENTITLEMENT_ADVENTURER]?.isActive === true ||
    includesAny(activeEntitlements, ["adventurer", "expert", "premium"]) ||
    includesAny(activeProducts, ["adventurer", "expert", "premium"]);

  if (hasAdventurer) return "adventurer";

  const hasExplorer =
    info.entitlements.active[ENTITLEMENT_EXPLORER]?.isActive === true ||
    includesAny(activeEntitlements, ["explorer", "pro", "nomad connect pro"]) ||
    includesAny(activeProducts, ["explorer", "pro"]);

  if (hasExplorer) return "explorer";

  return getTierFromEntitlements(activeEntitlements);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("starter");
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [userEntitlements, setUserEntitlements] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);
  const listenerCleanup = useRef<(() => void) | null>(null);
  const userIdRef = useRef<string | null>(null);

  const handleCustomerInfoUpdate = useCallback((info: CustomerInfo) => {
    setCustomerInfo(info);
    const entitlements = Object.keys(info.entitlements.active);
    const nextTier = getTierFromCustomerInfo(info);
    setUserEntitlements(entitlements);
    setTier(nextTier);
    AsyncStorage.setItem(TIER_STORAGE_KEY, nextTier).catch(() => {});
    AsyncStorage.setItem(ENTITLEMENTS_STORAGE_KEY, JSON.stringify(entitlements)).catch(() => {});
  }, []);

  const refreshSubscriptionStatus = useCallback(async () => {
    if (!configured) return;
    try {
      const result = await checkUserEntitlements();
      if (result.customerInfo) {
        handleCustomerInfoUpdate(result.customerInfo);
      }
      const currentOffering = await getSubscriptions();
      if (currentOffering) {
        setOfferings(currentOffering);
      }
    } catch (error) {
      console.log("Refresh subscription error:", error);
    }
  }, [configured, handleCustomerInfoUpdate]);

  const initializePurchases = useCallback(async () => {
    try {
      const storedTier = await AsyncStorage.getItem(TIER_STORAGE_KEY);
      if (
        storedTier === "starter" ||
        storedTier === "explorer" ||
        storedTier === "adventurer" ||
        storedTier === "lifetime"
      ) {
        setTier(storedTier);
      }

      const storedEntitlements = await AsyncStorage.getItem(ENTITLEMENTS_STORAGE_KEY);
      if (storedEntitlements) {
        try {
          const parsed = JSON.parse(storedEntitlements);
          if (Array.isArray(parsed)) setUserEntitlements(parsed);
        } catch {}
      }

      const success = await configureRevenueCat(user?.id);
      setConfigured(success);

      if (success) {
        if (user?.id) {
          const info = await identifyUser(user.id);
          if (info) {
            handleCustomerInfoUpdate(info);
          }
          userIdRef.current = user.id;
        }

        const result = await checkUserEntitlements();
        if (result.customerInfo) {
          handleCustomerInfoUpdate(result.customerInfo);
        }

        const currentOffering = await getSubscriptions();
        if (currentOffering) {
          setOfferings(currentOffering);
        }

        listenerCleanup.current = addCustomerInfoListener(handleCustomerInfoUpdate);
      } else {
        console.log("RevenueCat running in preview mode (no API key)");
      }
    } catch (error) {
      console.log("RevenueCat initialization (preview mode):", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, handleCustomerInfoUpdate]);

  useEffect(() => {
    initializePurchases();
    return () => {
      if (listenerCleanup.current) {
        listenerCleanup.current();
      }
    };
  }, [initializePurchases]);

  useEffect(() => {
    if (!configured) return;

    const nextId = user?.id || null;
    if (nextId && userIdRef.current !== nextId) {
      identifyUser(nextId)
        .then((info) => {
          if (info) {
            handleCustomerInfoUpdate(info);
          }
          refreshSubscriptionStatus();
        })
        .catch(() => {});
      userIdRef.current = nextId;
    }

    if (!nextId) {
      userIdRef.current = null;
    }
  }, [user?.id, configured, refreshSubscriptionStatus, handleCustomerInfoUpdate]);

  const purchasePackage = useCallback(async (packageId: string) => {
    const normalizedPackageId = packageId.toLowerCase();

    if (!offerings) {
      console.log("Demo mode: simulating purchase");
      if (normalizedPackageId.includes("lifetime")) {
        setTier("lifetime");
        setUserEntitlements(["lifetime"]);
        AsyncStorage.setItem(TIER_STORAGE_KEY, "lifetime").catch(() => {});
        AsyncStorage.setItem(ENTITLEMENTS_STORAGE_KEY, JSON.stringify(["lifetime"])).catch(() => {});
      } else if (normalizedPackageId.includes("adventurer")) {
        setTier("adventurer");
        setUserEntitlements(["adventurer"]);
        AsyncStorage.setItem(TIER_STORAGE_KEY, "adventurer").catch(() => {});
        AsyncStorage.setItem(ENTITLEMENTS_STORAGE_KEY, JSON.stringify(["adventurer"])).catch(() => {});
      } else if (
        normalizedPackageId.includes("explorer") ||
        normalizedPackageId.includes("monthly") ||
        normalizedPackageId.includes("yearly") ||
        normalizedPackageId.includes("pro")
      ) {
        setTier("explorer");
        setUserEntitlements(["explorer"]);
        AsyncStorage.setItem(TIER_STORAGE_KEY, "explorer").catch(() => {});
        AsyncStorage.setItem(ENTITLEMENTS_STORAGE_KEY, JSON.stringify(["explorer"])).catch(() => {});
      }
      return;
    }

    let pkg = offerings.availablePackages.find(
      (p) =>
        p.identifier.toLowerCase() === normalizedPackageId ||
        p.product.identifier.toLowerCase() === normalizedPackageId,
    );

    if (!pkg && normalizedPackageId.includes("lifetime")) {
      pkg = offerings.availablePackages.find(
        (p) =>
          p.packageType === "LIFETIME" ||
          p.identifier.toLowerCase().includes("lifetime") ||
          p.product.identifier.toLowerCase().includes("lifetime"),
      );
    }

    if (!pkg && normalizedPackageId.includes("adventurer")) {
      pkg = offerings.availablePackages.find(
        (p) =>
          p.identifier.toLowerCase().includes("adventurer") ||
          p.product.identifier.toLowerCase().includes("adventurer") ||
          p.product.identifier.toLowerCase().includes("premium"),
      );
    }

    if (!pkg && normalizedPackageId.includes("explorer")) {
      pkg = offerings.availablePackages.find(
        (p) =>
          p.identifier.toLowerCase().includes("explorer") ||
          p.product.identifier.toLowerCase().includes("explorer") ||
          p.identifier.toLowerCase().includes("pro") ||
          p.product.identifier.toLowerCase().includes("pro"),
      );
    }

    if (
      !pkg &&
      (normalizedPackageId.includes("explorer") || normalizedPackageId.includes("adventurer"))
    ) {
      pkg = offerings.availablePackages.find(
        (p) =>
          p.packageType === "MONTHLY" ||
          p.identifier === "$rc_monthly" ||
          p.product.identifier.toLowerCase().includes("monthly"),
      );
    }

    if (!pkg) {
      throw new Error(`Could not find package for '${packageId}' in current offering`);
    }

    const info = await rcPurchasePackage(pkg);
    if (info) {
      handleCustomerInfoUpdate(info);
    }
  }, [offerings, handleCustomerInfoUpdate]);

  const restorePurchases = useCallback(async () => {
    if (!configured) {
      console.log("Demo mode: nothing to restore");
      return;
    }
    const info = await rcRestorePurchases();
    if (info) {
      handleCustomerInfoUpdate(info);
    }
  }, [configured, handleCustomerInfoUpdate]);

  const presentPaywall = useCallback(async () => {
    try {
      const RevenueCatUI = await import("react-native-purchases-ui");
      if (RevenueCatUI?.default?.presentPaywall) {
        await RevenueCatUI.default.presentPaywall();
      } else if (RevenueCatUI?.default?.presentPaywallIfNeeded) {
        await RevenueCatUI.default.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: "explorer",
        });
      }
    } catch {
      console.log("RevenueCat UI paywall not available, using custom paywall");
    }
  }, []);

  const getTierFeatures = useCallback((t: SubscriptionTier) => TIER_FEATURES[t], []);

  const getTierPrice = useCallback((t: SubscriptionTier) => {
    if (offerings && offerings.availablePackages.length > 0) {
      const findTierPackage = (keywords: string[], fallbackType?: "MONTHLY" | "LIFETIME") =>
        offerings.availablePackages.find((p) => {
          const identifier = p.identifier.toLowerCase();
          const productIdentifier = p.product.identifier.toLowerCase();
          const matchesKeyword = keywords.some(
            (keyword) => identifier.includes(keyword) || productIdentifier.includes(keyword),
          );
          if (matchesKeyword) return true;
          return Boolean(fallbackType && p.packageType === fallbackType);
        });

      const explorer = findTierPackage(["explorer"]);
      const adventurer = findTierPackage(["adventurer", "premium"]);
      const lifetime = findTierPackage(["lifetime", "forever"], "LIFETIME");

      if (t === "explorer" && explorer) {
        return explorer.product.priceString + "/month";
      }
      if (t === "adventurer" && adventurer) {
        return adventurer.product.priceString + "/month";
      }
      if (t === "lifetime" && lifetime) {
        return lifetime.product.priceString;
      }

      const monthlyFallback = offerings.availablePackages.find(
        (p) => p.packageType === "MONTHLY" || p.product.identifier.toLowerCase().includes("monthly"),
      );
      if ((t === "explorer" || t === "adventurer") && monthlyFallback) {
        return monthlyFallback.product.priceString + "/month";
      }
    }

    return getRegionalTierPrice(t);
  }, [offerings]);

  const isPro = tier === "explorer" || tier === "adventurer" || tier === "lifetime";
  const isPremium = tier === "adventurer" || tier === "lifetime";

  const value = useMemo(
    () => ({
      tier,
      isLoading,
      offerings,
      customerInfo,
      userEntitlements,
      isPro,
      isPremium,
      isConfigured: configured,
      purchasePackage,
      restorePurchases,
      refreshSubscriptionStatus,
      getTierFeatures,
      getTierPrice,
      presentPaywall,
    }),
    [
      tier,
      isLoading,
      offerings,
      customerInfo,
      userEntitlements,
      isPro,
      isPremium,
      configured,
      purchasePackage,
      restorePurchases,
      refreshSubscriptionStatus,
      getTierFeatures,
      getTierPrice,
      presentPaywall,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}

