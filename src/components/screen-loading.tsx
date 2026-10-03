import { StyleSheet } from 'react-native';

import { BabyRunLoading } from '@/components/baby-loading';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** 저장된 아기 정보를 기기에서 읽는 동안 잠깐 보이는 화면 */
export function ScreenLoading() {
  return (
    <ThemedView style={styles.container}>
      <BabyRunLoading label="말콩이가 달려오고 있어요…" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
});
