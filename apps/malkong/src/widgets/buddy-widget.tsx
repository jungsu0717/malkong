/**
 * 아이폰 홈 화면 · 잠금 화면 위젯 (SPEC-MAIN-09, task today/008) — Expo 공식 expo-widgets.
 *
 * `'widget'` 표시 함수는 babel 이 글로 바꿔 두고, 위젯 확장 안의 작은 JS 런타임이 그린다. 바깥 변수 · 훅 · 다른 모듈을 쓸 수 없어서
 * 색과 글은 모두 함수 안에 적고 보일 내용은 props(widget-data.ts)로 받는다. 단추의 onPress 가 돌려주는 값이 그 자리에서 위젯의 새 props 가 된다 — 앱이 꺼져 있어도.
 * 누른 루틴은 `pending` 에 남겨 두고 앱이 앞으로 오면 widget-sync 가 완료로 반영한다.
 * 이 파일은 아이폰 네이티브 빌드에서만 불러온다(ios-widgets.ts ← widgets-native.ts).
 */

import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetProps } from '@/data/widget-data';

/** app.json 의 expo-widgets `widgets[].name` 과 같아야 한다 */
export const IOS_WIDGET = 'BuddyWidget';

const BuddyWidget = (props: WidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily;
  const dark = environment.colorScheme === 'dark';
  const ink = dark ? '#F4F4F6' : '#16161A';
  const dim = dark ? '#A0A0AB' : '#5E5E69';
  const accent = dark ? '#E5705E' : '#C64536';
  const bg = dark ? '#1C1C22' : '#FFFFFF';

  // 잠금 화면 — 시스템이 흑백으로 그리므로 색을 정하지 않는다
  if (family === 'accessoryInline') {
    return <Text modifiers={[widgetURL(props.home)]}>{props.next || props.headline}</Text>;
  }
  if (family === 'accessoryRectangular') {
    const lines = [];
    if (props.days) lines.push(<Text key="days" modifiers={[font({ size: 12 })]}>{props.days}</Text>);
    lines.push(
      <Text key="next" modifiers={[font({ size: 14, weight: 'bold' }), lineLimit(1)]}>
        {props.next || props.headline}
      </Text>,
    );
    if (props.left > 0) lines.push(<Text key="left" modifiers={[font({ size: 12 })]}>{`루틴 ${props.left}개 남음`}</Text>);
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL(props.home)]}>
        {lines}
      </VStack>
    );
  }

  const head = [];
  if (props.face) head.push(<Image key="face" uiImage={props.face} modifiers={[frame({ width: 26, height: 24 })]} />);
  head.push(
    <Text key="days" modifiers={[font({ size: 12 }), foregroundStyle(dim)]}>
      {props.days || '육아버디'}
    </Text>,
  );
  const body = [
    <Text key="headline" modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(ink), lineLimit(2)]}>
      {props.headline}
    </Text>,
  ];
  if (props.next) {
    body.push(
      <Text key="next" modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>
        {props.next}
      </Text>,
    );
  }
  const left = (
    <VStack alignment="leading" spacing={4}>
      <HStack spacing={6}>{head}</HStack>
      <Spacer />
      {body}
    </VStack>
  );

  if (family === 'systemSmall') {
    return <VStack modifiers={[containerBackground(bg, 'widget'), widgetURL(props.home)]}>{left}</VStack>;
  }

  // 중간 — 오른쪽에 오늘 할 루틴. 체크 루틴은 그 자리에서 토글, 단계 · 재고 확인은 루틴 화면으로
  const rows = props.routines.map((r) => {
    const row = (
      <HStack spacing={8}>
        <Image systemName={r.done ? 'checkmark.circle.fill' : 'circle'} size={18} color={r.done ? accent : ink} />
        <Text modifiers={[font({ size: 13 }), foregroundStyle(r.done ? dim : ink), lineLimit(1)]}>{r.title}</Text>
      </HStack>
    );
    if (!r.tap) {
      return (
        <Link key={r.id} destination={props.routinesUrl}>
          {row}
        </Link>
      );
    }
    return (
      <Button
        key={r.id}
        target={`routine:${r.id}`}
        onPress={() => {
          const routines = props.routines.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x));
          const pending = props.pending.includes(r.id) ? props.pending.filter((p) => p !== r.id) : [...props.pending, r.id];
          const left = Math.max(0, props.left + (r.done ? 1 : -1));
          return { routines, pending, left };
        }}>
        {row}
      </Button>
    );
  });
  if (rows.length === 0) {
    rows.push(
      <Text key="none" modifiers={[font({ size: 13 }), foregroundStyle(dim)]}>
        오늘 할 루틴이 없어요
      </Text>,
    );
  }
  return (
    <HStack spacing={14} modifiers={[containerBackground(bg, 'widget'), widgetURL(props.home)]}>
      {left}
      <VStack alignment="leading" spacing={6}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(dim)]}>오늘 할 루틴</Text>
        {rows}
        <Spacer />
      </VStack>
    </HStack>
  );
};

export default createWidget<WidgetProps>(IOS_WIDGET, BuddyWidget);
