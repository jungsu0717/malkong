import { StyleSheet, Text, type TextProps } from 'react-native';

import { fontFor, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 글자 크기 단계 (task common/009) — display 28 · title 22 · heading 17 · default 16 · body 15 ·
 * small 14 · label 13 · caption 12. 굵기는 style 의 fontWeight 로 바꿀 수 있고, 그 굵기에 맞는
 * IBM Plex Sans KR 파일을 여기서 고른다.
 */
export type TextType =
  | 'display'
  | 'title'
  | 'heading'
  | 'default'
  | 'body'
  | 'small'
  | 'label'
  | 'caption';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const flat = StyleSheet.flatten([{ color: theme[themeColor ?? 'text'] }, styles[type], style]);
  const { fontWeight, ...without } = flat;
  return <Text style={[without, { fontFamily: fontFor(fontWeight) }]} {...rest} />;
}

const styles = StyleSheet.create({
  display: { fontSize: 28, lineHeight: 36, fontWeight: 700, letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: 700, letterSpacing: -0.5 },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: 600, letterSpacing: -0.2 },
  default: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  body: { fontSize: 15, lineHeight: 24, fontWeight: 400 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: 500 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 400 },
});
