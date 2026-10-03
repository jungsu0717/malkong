import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { MalkongMark } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// SPEC-ASK-05 처리 현황 블록.
// 표시 계약은 selvas 통합 chat(neuro-frontend packages/chat)의 ThinkingIndicator·ChatTrace 를 따른다:
// 대기 문구 3.2초 순환, 기본 접힘 + 헤더 라이브 라벨, 완료되면 같은 모양으로 정지.
const ROTATION_MS = 3200;

const WAITING_PHRASES = [
  '우리 아기 기록을 살펴보고 있어요…',
  '표준 육아 지식을 찾아보고 있어요…',
  '출처를 확인하고 있어요…',
  '답변을 가지런히 정리하고 있어요…',
];

export type ThinkingStep = {
  id: string;
  /** 한글 라벨만 — 내부 이름(도구·API·모델명) 노출 금지 (SPEC-ASK-05) */
  title: string;
  /** 한 줄 결과 요약 (예: "표준 지식 3건") */
  brief?: string;
  done: boolean;
};

type ThinkingStatusProps = {
  steps: ThinkingStep[];
  done: boolean;
  /** 서버가 현재 단계 라벨을 보내면 순환 문구 대신 이것을 보여준다 */
  label?: string;
};

export function ThinkingStatus({ steps, done, label }: ThinkingStatusProps) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // 렌더 중에도 읽어야 하므로(interpolate) ref 가 아니라 상태로 한 번만 만든다
  const [pulse] = useState(() => new Animated.Value(0));

  // 말콩이 모션(Orb 자리) — 진행 중엔 맥동, 완료되면 같은 모양 그대로 정지해 연속성을 유지한다
  useEffect(() => {
    if (done) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [done, pulse]);

  // 대기 문구 순환 + 경과 초
  useEffect(() => {
    if (done) return;
    const rotate = setInterval(
      () => setPhraseIndex((i) => (i + 1) % WAITING_PHRASES.length),
      ROTATION_MS,
    );
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, [done]);

  const doneCount = steps.filter((s) => s.done).length;
  const headerText = done ? `${doneCount}단계 확인했어요` : (label ?? WAITING_PHRASES[phraseIndex]);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.headerRow}
        onPress={() => setOpen((o) => !o)}>
        <Animated.View
          style={[
            styles.orb,
            { backgroundColor: colors.accentSoft },
            done
              ? undefined
              : {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                  transform: [
                    { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) },
                  ],
                },
          ]}>
          <MalkongMark size={18} />
        </Animated.View>
        <ThemedText
          type={done ? 'caption' : 'small'}
          numberOfLines={1}
          style={[styles.headerLabel, { color: done ? colors.textSecondary : colors.text }]}>
          {headerText}
        </ThemedText>
        {!done && (
          <ThemedText type="caption" style={[styles.elapsed, { color: colors.textSecondary }]}>
            {elapsed}s
          </ThemedText>
        )}
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={styles.steps}>
          {steps.map((step) => (
            <View key={step.id} style={styles.stepRow}>
              {step.done ? (
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              ) : (
                <View style={styles.dotSlot}>
                  <Animated.View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: colors.accent,
                        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                      },
                    ]}
                  />
                </View>
              )}
              <ThemedText type="caption">{step.title}</ThemedText>
              {step.brief && (
                <ThemedText
                  type="caption"
                  numberOfLines={1}
                  style={[styles.stepBrief, { color: colors.textSecondary }]}>
                  {step.brief}
                </ThemedText>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 32,
  },
  orb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: { flex: 1 },
  elapsed: { fontVariant: ['tabular-nums'] },
  steps: {
    marginTop: Spacing.two,
    marginLeft: 34,
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dotSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stepBrief: { flexShrink: 1 },
});
