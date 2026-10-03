/**
 * 시안 B 「단정한 비서」의 토큰 — 색 · 글꼴 · 간격 (app-design 「디자인 원칙」, decisions/012).
 *
 * 화면에 hex 를 직접 적지 않는다. 붉은 말 색(accent)은 포인트에만 쓰고, 주요 단추는 먹색(ink)이다.
 * light/dark 두 벌을 언제나 같이 채운다.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#16161A',
    textSecondary: '#5E5E69',
    /** 장식·아이콘·자리 표시 글 — 본문 글자에는 쓰지 않는다(대비가 모자람) */
    textTertiary: '#8A8A95',
    background: '#FFFFFF',
    /** 옅은 회색 면 — 입력창 · 칩 · 묶음 카드 */
    surface: '#F4F4F6',
    /** 눌렀을 때 · 골랐을 때 · 꺼진 단추 */
    surfaceStrong: '#E9E9EE',
    border: '#E8E8EC',
    divider: '#F0F0F3',
    /** 주요 단추 바탕 */
    ink: '#16161A',
    onInk: '#FFFFFF',
    accent: '#C64536', // 버디의 쪽쪽이 코랄을 흰 글씨가 읽히게 진하게 — 브랜드 노랑(#FDD686)은 아이콘 · 시작 화면에
    accentSoft: '#FCEBE8',
    /** accentSoft 위의 글자 */
    accentText: '#8F2E23',
    danger: '#D92D3F', // 위험 신호·오류 — 이 색은 경고에만 쓴다
    dangerSoft: '#FDECEE',
    /** 흰 글씨를 얹는 경고 바탕(119 단추·경고 머리) — 다크 모드에서도 흰 글씨가 읽히게 따로 둔다 */
    dangerFill: '#D92D3F',
    onDanger: '#FFFFFF',
    /** 시트 뒤를 덮는 막 */
    scrim: 'rgba(22, 22, 26, 0.4)',
    /** 지식 지도 카드 — 밝은 모드에서도 우주처럼 어둡다 */
    space: '#0B0B10',
    onSpace: '#FFFFFF',
    onSpaceDim: 'rgba(255, 255, 255, 0.68)',
  },
  dark: {
    text: '#F4F4F6',
    textSecondary: '#A0A0AB',
    textTertiary: '#6E6E79',
    background: '#0E0E11',
    surface: '#1A1A1F',
    surfaceStrong: '#26262D',
    border: '#2A2A31',
    divider: '#202026',
    ink: '#F4F4F6',
    onInk: '#16161A',
    accent: '#E5705E',
    accentSoft: '#3A1F1B',
    accentText: '#F3A496',
    danger: '#F2606E',
    dangerSoft: '#3B1D22',
    dangerFill: '#C8303F',
    onDanger: '#FFFFFF',
    scrim: 'rgba(0, 0, 0, 0.6)',
    space: '#0B0B10',
    onSpace: '#FFFFFF',
    onSpaceDim: 'rgba(255, 255, 255, 0.68)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Palette = { [K in ThemeColor]: string };

/**
 * IBM Plex Sans KR — 굵기마다 다른 파일이다. 안드로이드는 fontWeight 만으로 다른 파일을 찾지 못하므로
 * ThemedText 가 굵기를 보고 여기서 이름을 고른다. 이름은 루트 `useFonts` 에 넘긴 열쇠와 같아야 한다.
 */
export const FontFamily = {
  regular: 'IBMPlexSansKR_400Regular',
  medium: 'IBMPlexSansKR_500Medium',
  semibold: 'IBMPlexSansKR_600SemiBold',
  bold: 'IBMPlexSansKR_700Bold',
} as const;

export function fontFor(weight: string | number | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : weight);
  if (w >= 700) return FontFamily.bold;
  if (w >= 600) return FontFamily.semibold;
  if (w >= 500) return FontFamily.medium;
  return FontFamily.regular;
}

export const Fonts = Platform.select({
  default: { mono: 'monospace' },
  ios: { mono: 'ui-monospace' },
  web: { mono: 'ui-monospace, Menlo, monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** 화면 좌우 여백 */
export const Gutter = 20;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const MaxContentWidth = 640;
