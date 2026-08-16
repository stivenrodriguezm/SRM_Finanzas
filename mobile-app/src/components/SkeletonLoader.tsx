import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { usePreferences } from '../context/PreferencesContext';

type Colors = ReturnType<typeof usePreferences>['colors'];

interface SkeletonLoaderProps {
  type?: 'card' | 'list';
}

export default function SkeletonLoader({ type = 'card' }: SkeletonLoaderProps) {
  const { colors } = usePreferences();
  const styles = getStyles(colors);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  if (type === 'list') {
    return (
      <View style={styles.listContainer}>
        {[1, 2, 3, 4, 5].map((item) => (
          <View key={item} style={styles.listItem}>
            <Animated.View style={[styles.avatarSkeleton, { opacity }]} />
            <View style={styles.listTextContainer}>
              <Animated.View style={[styles.titleSkeleton, { opacity }]} />
              <Animated.View style={[styles.subtitleSkeleton, { opacity }]} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // Default type: 'card'
  return (
    <View style={styles.cardContainer}>
      {[1, 2, 3].map((item) => (
        <Animated.View key={item} style={[styles.cardSkeleton, { opacity }]} />
      ))}
    </View>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  cardContainer: {
    padding: 20,
    gap: 16,
  },
  cardSkeleton: {
    height: 120,
    backgroundColor: colors.iconBg,
    borderRadius: 20,
    width: '100%',
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatarSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.iconBg,
    marginRight: 16,
  },
  listTextContainer: {
    flex: 1,
    gap: 8,
  },
  titleSkeleton: {
    height: 16,
    backgroundColor: colors.iconBg,
    borderRadius: 8,
    width: '60%',
  },
  subtitleSkeleton: {
    height: 12,
    backgroundColor: colors.iconBg,
    borderRadius: 6,
    width: '40%',
  },
});
