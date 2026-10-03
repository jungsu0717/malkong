import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** 키보드가 떠 있는지 — iOS 는 뜨기 직전(Will) 이벤트가 있어 미리 숨길 수 있고, Android 는 뜬 뒤(Did) 이벤트만 있다 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
