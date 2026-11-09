/**
 * 아기 프로필의 사진과 「태어날 때 (선택)」 (SPEC-MY-02, task my/012) — 프로필 수정 화면이 쓴다.
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { TeddyIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { INLINE_WHEEL, pickTime, TimeWheel } from '@/components/time-picker';
import { Chip, tap } from '@/components/ui';
import { FontFamily, Radius } from '@/constants/theme';
import { cleanNumber } from '@/data/events';
import { timeLabel } from '@/data/briefing';
import { savePhoto, useBabyPhoto, type Blood, type BirthInfo, type Sex } from '@/data/baby-extra';
import { useTheme } from '@/hooks/use-theme';

/** 동그란 아기 사진 — 없으면 곰돌이. 마이 버튼과 프로필이 같이 쓴다 */
export function BabyAvatar({ size }: { size: number }) {
  const c = useTheme();
  const uri = useBabyPhoto();
  if (uri) return <Image source={{ uri }} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return <TeddyIcon size={Math.round(size * 0.58)} color={c.text} />;
}

/** 맨 위 사진 — 누르면 앨범에서 고른다(정사각형으로 자른다) */
export function BabyPhotoPicker() {
  const c = useTheme();
  const uri = useBabyPhoto();
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    tap();
    if (busy) return;
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!res.canceled && res.assets[0]) await savePhoto(res.assets[0].uri);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={uri ? '아기 사진 바꾸기' : '아기 사진 넣기'} onPress={() => void pick()} style={styles.photoWrap}>
      <View style={[styles.photo, { backgroundColor: c.accentSoft }]}>
        {uri ? <Image source={{ uri }} accessibilityIgnoresInvertColors style={styles.photoImg} /> : <TeddyIcon size={52} color={c.accentText} />}
      </View>
      <View style={[styles.camera, { backgroundColor: c.ink, borderColor: c.background }]}>
        <Ionicons name="camera-outline" size={16} color={c.onInk} />
      </View>
    </Pressable>
  );
}

const SEX: { v: Sex; label: string }[] = [
  { v: 'girl', label: '여아' },
  { v: 'boy', label: '남아' },
];
const BLOOD: { v: Blood; label: string }[] = [
  { v: 'A', label: 'A' },
  { v: 'B', label: 'B' },
  { v: 'O', label: 'O' },
  { v: 'AB', label: 'AB' },
  { v: 'unknown', label: '모름' },
];

/** 태어날 때 (선택) — 시각, 성별, 몸무게, 키, 혈액형. 같은 것을 다시 누르면 지운다 */
export function BirthFields({ value, onChange }: { value: BirthInfo; onChange: (v: BirthInfo) => void }) {
  const c = useTheme();
  const [wheel, setWheel] = useState(false);
  const set = (patch: Partial<BirthInfo>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.group}>
      <ThemedText type="heading">
        태어날 때{' '}
        <ThemedText type="heading" style={{ color: c.textSecondary, fontWeight: 500 }}>
          (선택)
        </ThemedText>
      </ThemedText>

      <View style={styles.field}>
        <ThemedText type="label" style={{ color: c.textSecondary }}>
          태어난 시각
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value.time ? `태어난 시각 ${timeLabel(value.time)}, 눌러서 바꾸기` : '태어난 시각 정하기'}
          onPress={() => {
            tap();
            const t = value.time ?? '12:00';
            if (!value.time) set({ time: t });
            if (INLINE_WHEEL) setWheel((w) => !w);
            else pickTime(t, (x) => set({ time: x }));
          }}
          style={[styles.box, styles.row, { backgroundColor: c.surface }]}>
          <ThemedText type="body" style={[styles.flex, { fontFamily: FontFamily.semibold, color: value.time ? c.text : c.textTertiary }]}>
            {value.time ? timeLabel(value.time) : '정하지 않음'}
          </ThemedText>
          <Ionicons name={wheel ? 'chevron-up' : 'chevron-down'} size={16} color={c.textSecondary} />
        </Pressable>
        {wheel && value.time && <TimeWheel value={value.time} onChange={(x) => set({ time: x })} />}
      </View>

      <View style={styles.field}>
        <ThemedText type="label" style={{ color: c.textSecondary }}>
          성별
        </ThemedText>
        <View style={styles.chips}>
          {SEX.map((s) => (
            <Chip key={s.v} label={s.label} selected={value.sex === s.v} onPress={() => set({ sex: value.sex === s.v ? null : s.v })} />
          ))}
        </View>
      </View>

      <View style={styles.pair}>
        <NumberBox label="몸무게" unit="kg" value={value.weight} placeholder="3.2" onChange={(x) => set({ weight: x })} />
        <NumberBox label="키" unit="cm" value={value.height} placeholder="50" onChange={(x) => set({ height: x })} />
      </View>

      <View style={styles.field}>
        <ThemedText type="label" style={{ color: c.textSecondary }}>
          혈액형
        </ThemedText>
        <View style={styles.chips}>
          {BLOOD.map((b) => (
            <Chip key={b.v} label={b.label} selected={value.blood === b.v} onPress={() => set({ blood: value.blood === b.v ? null : b.v })} />
          ))}
        </View>
      </View>
    </View>
  );
}

function NumberBox({ label, unit, value, placeholder, onChange }: { label: string; unit: string; value: string | null; placeholder: string; onChange: (v: string | null) => void }) {
  const c = useTheme();
  return (
    <View style={[styles.field, styles.flex]}>
      <ThemedText type="label" style={{ color: c.textSecondary }}>
        {label}
      </ThemedText>
      <View style={[styles.box, styles.row, { backgroundColor: c.surface }]}>
        <TextInput
          value={value ?? ''}
          onChangeText={(t) => onChange(cleanNumber(t) || null)}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          keyboardType="decimal-pad"
          maxLength={5}
          accessibilityLabel={`태어날 때 ${label} ${unit}`}
          style={[styles.flex, styles.input, { color: c.text }]}
        />
        <ThemedText type="body" style={{ color: c.textSecondary }}>
          {unit}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  photoWrap: { alignSelf: 'center', width: 104, height: 104 },
  photo: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: 104, height: 104 },
  camera: { position: 'absolute', right: 0, bottom: 2, width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 16 },
  field: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 48 },
  input: { fontFamily: FontFamily.semibold, fontSize: 16, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pair: { flexDirection: 'row', gap: 12 },
});
