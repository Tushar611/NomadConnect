import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { Spacing, BorderRadius, Shadows } from '@/constants/theme';

interface MapScreenProps {
  visible?: boolean;
  onClose?: () => void;
  initialFilter?: 'all' | 'activities' | 'users' | 'spots';
}

export default function MapScreen({ visible, onClose, initialFilter = 'all' }: MapScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { activities, profiles } = useData();

  const content = (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.webFallback}>
        {onClose ? (
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12, backgroundColor: theme.cardBackground }, Shadows.medium]}
            onPress={onClose}
          >
            <Icon name="x" size={24} color={theme.text} />
          </Pressable>
        ) : null}
        <Icon name="map" size={64} color={theme.textSecondary} />
        <ThemedText type="h3" style={styles.webFallbackTitle}>Map Feature</ThemedText>
        <ThemedText type="body" style={[styles.webFallbackText, { color: theme.textSecondary }]}>
          The interactive map is available on mobile devices. Open this app in Expo Go on your phone to explore activities, nomads, and camping spots near you.
        </ThemedText>
        <View style={styles.webFallbackStats}>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <ThemedText type="h3" style={{ color: theme.primary }}>{activities.length}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Activities</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <ThemedText type="h3" style={{ color: "#9C27B0" }}>{profiles.length}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Nomads</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <ThemedText type="h3" style={{ color: "#4CAF50" }}>8</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Spots</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );

  if (visible !== undefined) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        {content}
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  webFallbackTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  webFallbackText: {
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  webFallbackStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 80,
  },
  closeButton: {
    position: 'absolute',
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
