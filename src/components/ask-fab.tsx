import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { PacifierIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

/**
 * 어디서든 말콩이 부르기 (SPEC-ASK-07).
 *
 * 물어보기 탭 밖의 화면 우하단에 둔다. 누르면 그 자리에서 입력창이 열리고, 보내면
 * 물어보기 탭으로 넘어가 그 질문의 대화가 이어진다.
 *
 * `bottom` 은 화면마다 다르다 — 바닥에 고정된 배너 광고가 있는 화면(성장)은 그 위로 올려서
 * 광고를 가리지 않게 한다.
 */
export function AskFab({ bottom = Spacing.four }: { bottom?: number }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const send = () => {
    const question = text.trim();
    if (!question) return;
    setOpen(false);
    setText('');
    // t 는 같은 질문을 다시 보내도 대화가 새로 시작되게 하는 구분값이다
    router.push({ pathname: '/ask', params: { q: question, t: String(Date.now()) } });
  };

  return (
    <>
      <Pressable
        accessibilityLabel="말콩이에게 물어보기"
        style={[styles.fab, { backgroundColor: colors.accent, bottom }]}
        onPress={() => setOpen(true)}>
        <PacifierIcon size={26} color="#ffffff" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              말콩이에게 물어보기
            </ThemedText>
            <View style={[styles.inputBar, { backgroundColor: colors.backgroundElement }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={text}
                onChangeText={setText}
                placeholder="무엇이든 물어보세요"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={send}
              />
              <Pressable
                style={[
                  styles.sendButton,
                  { backgroundColor: text.trim() ? colors.accent : colors.backgroundSelected },
                ]}
                disabled={!text.trim()}
                onPress={send}>
                <Ionicons name="arrow-up" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
