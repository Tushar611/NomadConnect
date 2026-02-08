import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription, SubscriptionTier } from '@/context/SubscriptionContext';
import { AppColors, Spacing, BorderRadius } from '@/constants/theme';
import { useAlert } from "@/context/AlertContext";
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TierConfig {
  id: SubscriptionTier;
  name: string;
  iconName: keyof typeof Ionicons.glyphMap;
  gradient: [string, string, string];
  glowColor: string;
  popular?: boolean;
  tagline: string;
  packageId?: string;
}

const TIERS: TierConfig[] = [
  {
    id: 'free',
    name: 'Starter',
    iconName: 'compass-outline',
    gradient: ['#9CA3AF', '#78909C', '#607D8B'],
    glowColor: '#607D8B',
    tagline: 'Start your journey',
  },
  {
    id: 'pro',
    name: 'Explorer',
    iconName: 'flame-outline',
    gradient: ['#FF8C42', '#F97316', '#EA580C'],
    glowColor: '#FF8C42',
    popular: true,
    tagline: 'For serious nomads',
    packageId: '$rc_monthly',
  },
  {
    id: 'expert',
    name: 'Adventurer',
    iconName: 'diamond-outline',
    gradient: ['#A78BFA', '#8B5CF6', '#7C3AED'],
    glowColor: '#8B5CF6',
    tagline: 'The ultimate experience',
    packageId: '$rc_annual',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    iconName: 'infinite-outline',
    gradient: ['#F59E0B', '#D97706', '#B45309'],
    glowColor: '#F59E0B',
    tagline: 'Unlimited forever',
    packageId: '$rc_lifetime',
  },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const {
    tier: currentTier,
    purchasePackage,
    restorePurchases,
    getTierFeatures,
    getTierPrice,
    isLoading,
    offerings,
    isConfigured,
    customerInfo,
    presentPaywall,
  } = useSubscription();
  
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(currentTier === 'free' ? 'pro' : currentTier);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const getPackagePrice = (tierConfig: TierConfig): string => {
    if (offerings && tierConfig.packageId) {
      const pkg = offerings.availablePackages.find(
        (p) => p.identifier === tierConfig.packageId,
      );
      if (pkg) {
        if (tierConfig.id === 'expert') {
          return pkg.product.priceString + "/yr";
        }
        if (tierConfig.id === 'lifetime') {
          return pkg.product.priceString;
        }
        return pkg.product.priceString + "/mo";
      }
    }
    return getTierPrice(tierConfig.id);
  };

  const handlePurchase = async () => {
    if (selectedTier === 'free' || selectedTier === currentTier) return;
    
    const tierConfig = TIERS.find(t => t.id === selectedTier);
    const packageId = tierConfig?.packageId || selectedTier;

    setIsPurchasing(true);
    try {
      await purchasePackage(packageId);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      navigation.goBack();
    } catch (error: any) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      showAlert({ type: "error", title: "Purchase Failed", message: error?.message || "Something went wrong. Please try again." });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      showAlert({ type: "success", title: "Restored", message: "Your purchases have been restored successfully." });
    } catch (error) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      showAlert({ type: "error", title: "Restore Failed", message: "Could not restore purchases. Please try again." });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleNativePaywall = async () => {
    try {
      await presentPaywall();
    } catch (error) {
      console.log("Native paywall not available");
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const selectedTierConfig = TIERS.find(t => t.id === selectedTier);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F0D0B' : '#FFF9F5' }]}>
      <LinearGradient
        colors={isDark
          ? ['#1A1510', '#0F0D0B', '#0F0D0B']
          : ['#FFF3E8', '#FFF9F5', '#FFF9F5']
        }
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.headerRow}>
          <Pressable 
            onPress={() => navigation.goBack()} 
            style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
            hitSlop={20}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
          <View style={styles.crownContainer}>
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FF8C00']}
              style={styles.crownBg}
            >
              <Ionicons name="trophy" size={32} color="#FFF" />
            </LinearGradient>
          </View>
          <ThemedText style={[styles.title, { color: theme.text }]}>Choose Your Plan</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Unlock the full nomad experience
          </ThemedText>
          {!isConfigured && (
            <View style={[styles.previewBadge, { backgroundColor: isDark ? 'rgba(255,140,66,0.15)' : 'rgba(255,140,66,0.1)' }]}>
              <Ionicons name="information-circle" size={14} color={AppColors.accent} />
              <ThemedText style={{ color: AppColors.accent, fontSize: 12, marginLeft: 4 }}>
                Preview Mode
              </ThemedText>
            </View>
          )}
        </Animated.View>

        {customerInfo?.managementURL && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <View style={[styles.customerInfoCard, { backgroundColor: isDark ? '#1C1814' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <ThemedText style={[styles.managementHint, { color: theme.textSecondary }]}>
                Manage subscription in your app store settings
              </ThemedText>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.tiersContainer}>
          {TIERS.map((tierOption, index) => {
            const isSelected = selectedTier === tierOption.id;
            const isCurrent = currentTier === tierOption.id;
            const features = getTierFeatures(tierOption.id) || [];
            const price = getPackagePrice(tierOption);

            return (
              <Animated.View
                key={tierOption.id}
                entering={FadeInDown.delay(250 + index * 120).springify()}
              >
                <Pressable
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: isDark ? '#1C1814' : '#FFFFFF',
                    },
                    isSelected && {
                      borderColor: tierOption.gradient[1],
                      borderWidth: 2.5,
                      shadowColor: tierOption.glowColor,
                      shadowOpacity: 0.35,
                      shadowRadius: 20,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 12,
                    },
                    !isSelected && {
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => {
                    setSelectedTier(tierOption.id);
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  {tierOption.popular && (
                    <LinearGradient
                      colors={[tierOption.gradient[0], tierOption.gradient[2]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.popularBadge}
                    >
                      <Ionicons name="star" size={10} color="#FFF" style={{ marginRight: 3 }} />
                      <ThemedText style={styles.popularText}>Most Popular</ThemedText>
                    </LinearGradient>
                  )}

                  {isSelected && (
                    <LinearGradient
                      colors={[tierOption.gradient[0] + '08', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}

                  <View style={styles.tierHeader}>
                    <LinearGradient
                      colors={tierOption.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tierIconBg}
                    >
                      <Ionicons name={tierOption.iconName} size={22} color="#FFF" />
                    </LinearGradient>
                    <View style={styles.tierInfo}>
                      <View style={styles.tierNameRow}>
                        <ThemedText style={[styles.tierName, { color: theme.text }]}>{tierOption.name}</ThemedText>
                        {isCurrent && (
                          <View style={[styles.currentBadge, { borderColor: tierOption.gradient[1] + '40' }]}>
                            <View style={[styles.currentDot, { backgroundColor: tierOption.gradient[1] }]} />
                            <ThemedText style={[styles.currentText, { color: tierOption.gradient[1] }]}>Active</ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={[styles.tierTagline, { color: theme.textSecondary }]}>
                        {tierOption.tagline}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.tierPrice, { color: tierOption.gradient[1] }]}>
                      {price}
                    </ThemedText>
                  </View>

                  <View style={[styles.featuresDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

                  <View style={styles.featuresList}>
                    {features.map((feature, idx) => (
                      <View key={idx} style={styles.featureRow}>
                        <LinearGradient
                          colors={tierOption.gradient}
                          style={styles.checkCircle}
                        >
                          <Ionicons name="checkmark" size={11} color="#FFF" />
                        </LinearGradient>
                        <ThemedText style={[styles.featureText, { color: isDark ? 'rgba(255,255,255,0.75)' : '#4A4A4A' }]}>
                          {feature}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(500)} style={styles.actionsContainer}>
          {selectedTier !== 'free' && selectedTier !== currentTier ? (
            <Pressable onPress={handlePurchase} disabled={isPurchasing} style={styles.purchaseButtonWrapper}>
              <LinearGradient
                colors={selectedTierConfig ? selectedTierConfig.gradient : ['#E8744F', '#F4A261', '#F97316']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.purchaseButton}
              >
                {isPurchasing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons
                      name={selectedTier === 'lifetime' ? 'infinite' : 'rocket'}
                      size={18}
                      color="#FFF"
                      style={{ marginRight: 8 }}
                    />
                    <ThemedText style={styles.purchaseText}>
                      {selectedTier === 'lifetime'
                        ? `Get Lifetime Access - ${getPackagePrice(TIERS[3])}`
                        : `Upgrade to ${selectedTierConfig?.name || 'Pro'} - ${getPackagePrice(selectedTierConfig || TIERS[1])}`}
                    </ThemedText>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            <ThemedText style={[styles.restoreText, { color: theme.textSecondary }]}>
              {isRestoring ? 'Restoring...' : 'Restore Purchases'}
            </ThemedText>
          </Pressable>

          <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
            Subscriptions auto-renew. Cancel anytime in your app store settings.
            Payment will be charged to your App Store or Google Play account.
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  crownContainer: {
    marginBottom: 16,
  },
  crownBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  customerInfoCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  customerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerInfoText: {
    fontSize: 13,
  },
  managementHint: {
    fontSize: 11,
    marginTop: 6,
    opacity: 0.7,
  },
  tiersContainer: {
    gap: 16,
  },
  tierCard: {
    borderRadius: 22,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomLeftRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  popularText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 11,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierIconBg: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tierInfo: {
    flex: 1,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierName: {
    fontSize: 19,
    fontWeight: '700' as const,
  },
  tierTagline: {
    fontSize: 13,
    marginTop: 2,
  },
  tierPrice: {
    fontSize: 22,
    fontWeight: '800' as const,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  currentText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  featuresDivider: {
    height: 1,
    marginBottom: 14,
  },
  featuresList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 28,
    gap: 14,
    alignItems: 'center',
  },
  purchaseButtonWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E8744F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  purchaseButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  restoreButton: {
    padding: 12,
  },
  restoreText: {
    fontSize: 14,
    textDecorationLine: 'underline' as const,
  },
  disclaimer: {
    textAlign: 'center' as const,
    paddingHorizontal: 24,
    fontSize: 11,
    opacity: 0.6,
    lineHeight: 16,
  },
});
