/**
 * 시안 B 공용 부품 (task common/009) — 카드 · 단추 · 칩 · 표시 · 아이콘 단추 · 보기 전환 · 목록 줄 · 섹션 머리 · 빈 화면.
 * 모양의 정본은 docs/app-design 「디자인 원칙」. 화면은 이 부품을 쓰고 모양을 새로 만들지 않는다.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { MalkongAvatar } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** 주요 행동의 가벼운 손맛 — 웹에서는 아무것도 하지 않는다 */
export function tap(kind: 'light' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** 가는 선을 두른 흰 카드 — 그림자는 쓰지 않는다 */
export function Card({
  children,
  style,
  tone = 'outline',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** outline: 흰 바탕 + 선 · filled: 옅은 회색 면 */
  tone?: 'outline' | 'filled';
}) {
  const c = useTheme();
  return (
    <View
      style={[
        styles.card,
        tone === 'outline'
          ? { backgroundColor: c.background, borderColor: c.border, borderWidth: 1 }
          : { backgroundColor: c.surface },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  busy = false,
  style,
}: {
  label: string;
  onPress: () => void;
  /** primary: 먹색 · accent: 붉은 말 · secondary: 회색 면 · ghost: 글자만 */
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const off = disabled || busy;
  const bg = {
    primary: c.ink,
    accent: c.accent,
    secondary: c.surface,
    ghost: 'transparent',
    danger: c.danger,
  }[variant];
  const fg = {
    primary: c.onInk,
    accent: '#FFFFFF',
    secondary: c.text,
    ghost: c.text,
    danger: c.onDanger,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${size}`],
        { backgroundColor: off && variant !== 'ghost' ? c.surfaceStrong : bg, opacity: pressed ? 0.8 : 1 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? c.text : c.textSecondary} />
      ) : (
        icon && <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={off ? c.textSecondary : fg} />
      )}
      <ThemedText
        type={size === 'sm' ? 'label' : 'heading'}
        style={{ color: off ? c.textSecondary : fg, fontWeight: 600, fontSize: size === 'lg' ? 17 : size === 'sm' ? 13 : 15 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 눌러서 고르는 작은 칩 — 빠른 질문 · 되묻기 선택지 */
export function Chip({
  label,
  onPress,
  selected = false,
  icon,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: IconName;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.ink : pressed ? c.surfaceStrong : c.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}>
      {icon && <Ionicons name={icon} size={14} color={selected ? c.onInk : c.textSecondary} />}
      <ThemedText type="label" style={{ color: selected ? c.onInk : c.text, fontWeight: 400, fontSize: 14 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 수위 · 기록 참고 같은 짧은 표시 */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'danger' }) {
  const c = useTheme();
  const style =
    tone === 'accent'
      ? { backgroundColor: c.accentSoft, color: c.accentText }
      : tone === 'danger'
        ? { backgroundColor: c.dangerSoft, color: c.danger }
        : { backgroundColor: 'transparent', color: c.textSecondary, borderColor: c.border, borderWidth: 1 };
  return (
    <View style={[styles.tag, { backgroundColor: style.backgroundColor, borderColor: style.borderColor, borderWidth: style.borderWidth }]}>
      <ThemedText type="caption" style={{ color: style.color, fontWeight: 500 }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  badge = false,
}: {
  icon: IconName;
  /** 화면 읽기용 이름 — 아이콘만 있는 단추라 꼭 단다 */
  label: string;
  onPress: () => void;
  /** 새 것이 있다는 작은 점 */
  badge?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.background }]}>
      <Ionicons name={icon} size={20} color={c.text} />
      {badge && <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.background }]} />}
    </Pressable>
  );
}

/** 밑줄 보기 전환 — 우리 아기의 일정 · 성장 · 기록 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const c = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { borderBottomColor: c.divider }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) tap();
              onChange(o.value);
            }}
            style={[styles.segment, { borderBottomColor: on ? c.text : 'transparent' }]}>
            <ThemedText
              type="heading"
              style={{ color: on ? c.text : c.textSecondary, fontWeight: on ? 600 : 400, fontSize: 15 }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 목록 한 줄 — 왼쪽 아이콘 칸 · 제목과 설명 · 오른쪽 끝(값·단추·셰브론) */
export function ListRow({
  icon,
  iconTone = 'neutral',
  title,
  detail,
  right,
  onPress,
  divider = false,
  muted = false,
}: {
  icon?: IconName;
  iconTone?: 'neutral' | 'accent';
  title: string;
  detail?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  /** 위 줄과 가르는 선 */
  divider?: boolean;
  /** 끝난 항목 — 흐리게 */
  muted?: boolean;
}) {
  const c = useTheme();
  const body = (
    <>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: iconTone === 'accent' ? c.accentSoft : c.surface }]}>
          <Ionicons name={icon} size={18} color={iconTone === 'accent' ? c.accent : c.text} />
        </View>
      )}
      <View style={styles.rowText}>
        <ThemedText
          type="body"
          style={{
            fontWeight: 600,
            color: muted ? c.textSecondary : c.text,
            textDecorationLine: muted ? 'line-through' : 'none',
          }}>
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />)}
    </>
  );
  const rowStyle = [styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { opacity: 0.6 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={rowStyle}>{body}</View>
  );
}

/** 섹션 머리 — 작은 회색 글자 한 줄과 오른쪽 덧말 */
export function SectionHeader({ title, aside }: { title: string; aside?: string }) {
  const c = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
        {title}
      </ThemedText>
      {aside ? (
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {aside}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** 빈 화면 — 말콩이 얼굴 · 한 줄 안내 · 할 수 있는 행동 하나 */
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: { label: string; onPress: () => void };
}) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <MalkongAvatar size={56} />
      <ThemedText type="heading" style={{ textAlign: 'center' }}>
        {title}
      </ThemedText>
      {detail && (
        <ThemedText type="small" style={{ color: c.textSecondary, textAlign: 'center' }}>
          {detail}
        </ThemedText>
      )}
      {action && <Button label={action.label} onPress={action.onPress} size="sm" variant="secondary" />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.three },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
  },
  button_sm: { minHeight: 36, paddingHorizontal: 14 },
  button_md: { minHeight: 48, paddingHorizontal: 18 },
  button_lg: { minHeight: 56, paddingHorizontal: 20, borderRadius: Radius.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  segmented: { flexDirection: 'row', gap: 20, borderBottomWidth: 1 },
  segment: { paddingTop: 8, paddingBottom: 10, borderBottomWidth: 2, marginBottom: -1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
});
