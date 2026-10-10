import { motion, onDark, onDarkAlpha, spacing, typography, veil } from '@/constants/design';
import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { LyricsResult, LyricWord } from '@/providers/contracts/ServerAdapter';
import { KaraokeLine } from '@/features/lyrics/KaraokeLine';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  lyrics: LyricsResult;
  position: number;
  contentWidth: number;
  /** Whether the player is actually on screen — gates the fast word clock. */
  active: boolean;
  onPress: () => void;
};

const CARD_HEIGHT = 220;
const CARD_PADDING_V = 28;

function getCurrentLineIndex(
  lines: { startMs: number }[],
  positionSeconds: number
): number {
  const timeMs = positionSeconds * 1000;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (timeMs >= lines[i].startMs) return i;
  }
  return 0;
}

function LyricLine({
  text,
  words,
  variant,
  karaokeActive,
}: {
  text: string;
  words?: LyricWord[];
  variant: 'active' | 'adjacent' | 'inactive';
  karaokeActive: boolean;
}) {
  const isActive = variant === 'active';
  const opacityTarget =
    variant === 'active' ? 1 : variant === 'adjacent' ? 0.85 : 0.5;
  const opacity = useSharedValue(opacityTarget);
  const tint = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    const config = { duration: motion.lyricFade, easing: Easing.inOut(Easing.cubic) };
    opacity.value = withTiming(opacityTarget, config);
    tint.value = withTiming(isActive ? 1 : 0, config);
  }, [opacity, tint, opacityTarget, isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    color: interpolateColor(tint.value, [0, 1], [onDarkAlpha.body, onDark.text]),
  }));

  const fontWeight = isActive ? '600' : '500';

  return (
    <Animated.Text
      numberOfLines={2}
      style={[styles.line, { fontWeight }, animatedStyle]}
    >
      {karaokeActive && words && words.length > 0 ? (
        <KaraokeLine words={words} active color={onDark.text} fallback={text} />
      ) : (
        text
      )}
    </Animated.Text>
  );
}

export default function LyricsPreviewCard({
  lyrics,
  position,
  contentWidth,
  active,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const rad = useRadius();
  const scrollRef = useRef<ScrollView>(null);
  const lineLayouts = useRef<Record<number, { y: number; height: number }>>({});
  const [contentHeight, setContentHeight] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const lines = useMemo(() => lyrics.lines, [lyrics.lines]);
  const currentIndex = useMemo(
    () => getCurrentLineIndex(lines, position),
    [lines, position]
  );

  useEffect(() => {
    lineLayouts.current = {};
  }, [lyrics.lines]);

  const onLineLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    lineLayouts.current[index] = { y, height };
    if (index === currentIndex) {
      setLayoutVersion((v) => v + 1);
    }
  };

  useEffect(() => {
    if (!lines.length || !scrollRef.current) return;

    const layout = lineLayouts.current[currentIndex];
    if (!layout || contentHeight === 0) return;

    const visibleHeight = CARD_HEIGHT - CARD_PADDING_V * 2;
    const lineCenterY = layout.y + layout.height / 2;
    const targetScrollY = lineCenterY - visibleHeight / 2;
    const maxScroll = Math.max(0, contentHeight - visibleHeight);
    const clampedY = Math.max(0, Math.min(targetScrollY, maxScroll));

    scrollRef.current.scrollTo({
      y: clampedY,
      animated: true,
    });
  }, [currentIndex, lines.length, contentHeight, layoutVersion]);

  if (!lines.length) return null;

  const getVariant = (index: number): 'active' | 'adjacent' | 'inactive' => {
    if (index === currentIndex) return 'active';
    if (index === currentIndex - 1 || index === currentIndex + 1)
      return 'adjacent';
    return 'inactive';
  };

  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={t('a11y.player.lyrics')}
      style={[styles.card, { width: contentWidth, height: CARD_HEIGHT, borderRadius: rad.panel }]}
      onPress={onPress}
    >
      <ScrollView
        ref={scrollRef}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(w, h) => setContentHeight(h)}
      >
        {lines.map((line, index) => (
          <View key={index} onLayout={onLineLayout(index)}>
            <LyricLine
              text={line.text}
              words={line.words}
              variant={getVariant(index)}
              karaokeActive={active && index === currentIndex}
            />
          </View>
        ))}
      </ScrollView>

    </Touchable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    paddingVertical: CARD_PADDING_V,
    paddingHorizontal: spacing.xl,
    backgroundColor: veil.card,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: spacing.xs,
  },
  line: {
    ...typography.sectionTitle,
    textAlign: 'center',
    marginVertical: spacing.tight,
  },
});
