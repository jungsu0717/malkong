import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// 베이비 아이콘 세트 — 탭·브랜드용 자체 아이콘 (정본: docs/app-design 아이콘 절)
// 탭: 버디=말풍선 속 쪽쪽이 · 우리 아기=아기 얼굴 · 성장=딸랑이 · 마이=곰돌이. 캐릭터 버디는 그림(brand.tsx)
// 24x24 · 선 1.8 · 끝 둥글게. 네 개가 한 세트로 보이도록 규격을 통일한다.
// 보조 UI 아이콘(셰브론·링크·전송 등)은 그대로 Ionicons 를 쓴다.

type IconProps = { size?: number; color: ColorValue };

const stroke = { strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const thin = { strokeWidth: 1.6, strokeLinecap: 'round' } as const;

/** 우리 아기 탭 — 아기 얼굴 (배냇머리 한 가닥) */
export function BabyFaceIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13} r={7.4} stroke={color} {...stroke} />
      <Path d="M12 5.6 C11.6 3.8 13.6 3 14.3 4.4" stroke={color} {...thin} />
      <Circle cx={9.4} cy={12.2} r={0.95} fill={color} />
      <Circle cx={14.6} cy={12.2} r={0.95} fill={color} />
      <Path d="M9.8 15.4 Q12 17.2 14.2 15.4" stroke={color} {...thin} />
    </Svg>
  );
}

/** 버디 탭 — 말풍선 안의 쪽쪽이 (대화) */
export function ChatBubbleIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.2 4.6 H18.8 Q20.6 4.6 20.6 6.4 V14.6 Q20.6 16.4 18.8 16.4 H10.4 L6.4 19.8 V16.4 H5.2 Q3.4 16.4 3.4 14.6 V6.4 Q3.4 4.6 5.2 4.6 Z"
        stroke={color}
        {...stroke}
      />
      <Circle cx={12} cy={10.5} r={2.3} stroke={color} {...thin} />
      <Circle cx={12} cy={10.5} r={0.6} fill={color} />
    </Svg>
  );
}

/** 쪽쪽이 */
export function PacifierIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={10} r={6.2} stroke={color} {...stroke} />
      <Circle cx={12} cy={10} r={2.1} stroke={color} {...thin} />
      <Path d="M9.2 16.9 Q12 20.4 14.8 16.9" stroke={color} {...stroke} />
    </Svg>
  );
}

/** 딸랑이 */
export function RattleIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={7.6} r={4.4} stroke={color} {...stroke} />
      <Path d="M12 12.2 L12 17" stroke={color} {...stroke} />
      <Circle cx={12} cy={18.8} r={1.7} stroke={color} {...stroke} />
      <Path d="M5.6 4.2 L6.9 5.5" stroke={color} {...thin} />
      <Path d="M18.4 4.2 L17.1 5.5" stroke={color} {...thin} />
    </Svg>
  );
}

/** 마이 — 곰돌이 (애착 인형) */
export function TeddyIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={7.4} cy={7.8} r={2.3} stroke={color} {...thin} />
      <Circle cx={16.6} cy={7.8} r={2.3} stroke={color} {...thin} />
      <Circle cx={12} cy={13} r={6.6} stroke={color} {...stroke} />
      <Circle cx={9.6} cy={12} r={0.9} fill={color} />
      <Circle cx={14.4} cy={12} r={0.9} fill={color} />
      <Circle cx={12} cy={14.5} r={0.8} fill={color} />
      <Path d="M10.6 16.6 Q12 17.6 13.4 16.6" stroke={color} {...thin} />
    </Svg>
  );
}
