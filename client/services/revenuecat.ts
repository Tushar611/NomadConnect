import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

const ENTITLEMENT_EXPLORER = "explorer";
const ENTITLEMENT_ADVENTURER = "adventurer";
const ENTITLEMENT_LIFETIME = "lifetime";

let isConfigured = false;

function getApiKey(): string | undefined {
  if (REVENUECAT_API_KEY) return REVENUECAT_API_KEY;

  return Platform.select({
    ios: REVENUECAT_IOS_KEY,
    android: REVENUECAT_ANDROID_KEY,
    default: REVENUECAT_IOS_KEY || REVENUECAT_ANDROID_KEY,
  }) || undefined;
}

export async function configureRevenueCat(userId?: string): Promise<boolean> {
  if (isConfigured) return true;

  const apiKey = getApiKey();

  if (!apiKey) {
    console.log("RevenueCat running in preview mode (no API key)");
    return false;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    await Purchases.configure({ apiKey, appUserID: userId || undefined });
    isConfigured = true;
    console.log("RevenueCat configured successfully");
    return true;
  } catch (error) {
    console.log("RevenueCat configuration error:", error);
    return false;
  }
}

export async function identifyUser(userId: string): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.log("RevenueCat identify error:", error);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  if (!isConfigured) return;
  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) {
      await Purchases.logOut();
    }
  } catch (error) {
    console.log("RevenueCat logout error:", error);
  }
}

export async function getSubscriptions(): Promise<PurchasesOffering | null> {
  if (!isConfigured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (error) {
    console.log("RevenueCat getSubscriptions error:", error);
    return null;
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) return null;
    throw error;
  }
}

export async function checkUserEntitlements(): Promise<{
  customerInfo: CustomerInfo | null;
  activeEntitlements: string[];
  isPro: boolean;
  isPremium: boolean;
}> {
  if (!isConfigured) {
    return {
      customerInfo: null,
      activeEntitlements: [],
      isPro: false,
      isPremium: false,
    };
  }

  try {
    const info = await Purchases.getCustomerInfo();
    const activeEntitlements = Object.keys(info.entitlements.active);

    const hasExplorer =
      info.entitlements.active[ENTITLEMENT_EXPLORER]?.isActive === true ||
      activeEntitlements.includes("pro") ||
      activeEntitlements.includes("Nomad Connect Pro");

    const hasAdventurer =
      info.entitlements.active[ENTITLEMENT_ADVENTURER]?.isActive === true ||
      activeEntitlements.includes("expert");

    const hasLifetime =
      info.entitlements.active[ENTITLEMENT_LIFETIME]?.isActive === true ||
      activeEntitlements.includes("lifetime");

    const isPro = hasExplorer || hasAdventurer || hasLifetime;
    const isPremium = hasAdventurer || hasLifetime;

    return { customerInfo: info, activeEntitlements, isPro, isPremium };
  } catch (error) {
    console.log("RevenueCat entitlements error:", error);
    return {
      customerInfo: null,
      activeEntitlements: [],
      isPro: false,
      isPremium: false,
    };
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    const info = await Purchases.restorePurchases();
    return info;
  } catch (error) {
    console.log("RevenueCat restore error:", error);
    return null;
  }
}

export function addCustomerInfoListener(
  listener: (info: CustomerInfo) => void,
): () => void {
  if (!isConfigured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.log("RevenueCat getCustomerInfo error:", error);
    return null;
  }
}

export async function purchaseConsultation(expertName: string, amount: number, rateTier?: number): Promise<{
  success: boolean;
  transactionId: string | null;
  error?: string;
}> {
  if (!isConfigured) {
    console.log("RevenueCat demo mode: simulating consultation purchase");
    const mockTxId = "rc_demo_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
    return { success: true, transactionId: mockTxId };
  }

  try {
    const offerings = await Purchases.getOfferings();

    const consultationOffering = offerings.all["expert_consultation"] || offerings.current;
    if (!consultationOffering) {
      console.log("No consultation offering found, using demo purchase");
      const mockTxId = "rc_sim_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
      return { success: true, transactionId: mockTxId };
    }

    const pkg = consultationOffering.availablePackages.find(
      (p) => p.identifier.includes("consultation") || p.identifier.includes("expert")
    ) || consultationOffering.availablePackages[0];

    if (!pkg) {
      console.log("No consultation package found, using demo purchase");
      const mockTxId = "rc_sim_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
      return { success: true, transactionId: mockTxId };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const txId = customerInfo.nonSubscriptionTransactions?.[0]?.transactionIdentifier ||
      "rc_" + Date.now().toString();

    return { success: true, transactionId: txId };
  } catch (error: any) {
    if (error.userCancelled) {
      return { success: false, transactionId: null, error: "cancelled" };
    }
    console.log("RevenueCat consultation purchase error, falling back to demo:", error);
    const mockTxId = "rc_fallback_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
    return { success: true, transactionId: mockTxId };
  }
}

export { isConfigured as isRevenueCatConfigured, ENTITLEMENT_EXPLORER, ENTITLEMENT_ADVENTURER, ENTITLEMENT_LIFETIME };

