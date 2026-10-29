/**
 * 아이폰 홈 화면 · 잠금 화면 위젯 (SPEC-MAIN-09, task today/008 · 010) — Expo 공식 expo-widgets.
 *
 * `'widget'` 표시 함수는 babel 이 글로 바꿔 두고, 위젯 확장 안의 작은 JS 런타임이 그린다. 바깥 변수 · 훅 · 다른 모듈을 쓸 수 없어서
 * 색과 글은 모두 함수 안에 적고 보일 내용은 props(widget-data.ts)로 받는다. `@expo/ui` 의 뷰와 수정자(shapes 포함)는 런타임에 전역으로 있다.
 * 단추의 onPress 가 돌려주는 값이 그 자리에서 위젯의 새 props 가 된다 — 앱이 꺼져 있어도.
 * 누른 루틴은 `pending` 에 남겨 두고 앱이 앞으로 오면 widget-sync 가 완료로 반영한다.
 * 이 파일은 아이폰 네이티브 빌드에서만 불러온다(ios-widgets.ts ← widgets-native.ts).
 *
 * 모양은 디데이 위젯처럼 함께한 날수를 크게, 아래에 다음 아기 일정 이름표와 이름 한 줄. 버디 얼굴은 오른쪽 위에 작게 —
 * 그림은 `resizable` 이 있어야 틀 크기로 줄어든다(없으면 원본 크기로 위젯을 덮는다, 2026-10-29 TestFlight).
 */

import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  resizable,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
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
  const tagBg = dark ? '#3B2623' : '#FCEBE8';
  const tagInk = dark ? '#F29A8A' : '#8F2E23';
  const panel = dark ? '#2A2A31' : '#F4F4F6';
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

  const face = (width: number, height: number) =>
    props.face ? <Image key="face" uiImage={props.face} modifiers={[resizable(), frame({ width, height })]} /> : null;

  // 생일 전 — 버디와 한 줄
  if (props.dayCount === 0) {
    return (
      <HStack modifiers={[containerBackground(bg, 'widget'), widgetURL(props.home)]}>
        <VStack alignment="leading">
          {face(44, 41)}
          <Spacer />
          <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(ink), lineLimit(2)]}>{props.headline}</Text>
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // 왼쪽 — 「함께한 지」와 버디, 큰 숫자, 아래에 다음 아기 일정
  const next = props.nextTitle ? (
    <VStack alignment="leading" spacing={5}>
      <Text
        modifiers={[
          font({ size: 12, weight: 'bold' }),
          foregroundStyle(tagInk),
          padding({ horizontal: 7, vertical: 2 }),
          background(tagBg, shapes.roundedRectangle({ cornerRadius: 7 })),
        ]}>
        {props.nextWhen}
      </Text>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{props.nextTitle}</Text>
    </VStack>
  ) : null;
  const left = (
    <VStack alignment="leading" spacing={2}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(dim)]}>함께한 지</Text>
        <Spacer />
        {face(26, 24)}
      </HStack>
      <HStack alignment="firstTextBaseline" spacing={2}>
        <Text modifiers={[font({ size: 50, weight: 'heavy', design: 'rounded' }), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.5)]}>
          {String(props.dayCount)}
        </Text>
        <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(ink)]}>일</Text>
      </HStack>
      <Spacer />
      {next}
    </VStack>
  );

  if (family === 'systemSmall') {
    return <VStack modifiers={[containerBackground(bg, 'widget'), widgetURL(props.home)]}>{left}</VStack>;
  }

  // 중간 — 오른쪽 회색 칸에 오늘 할 루틴 셋. 체크 루틴은 그 자리에서 토글, 단계 · 재고 확인과 「외 N개」는 루틴 화면으로
  const rows = props.routines.map((r) => {
    const mark = r.done ? (
      <Image systemName="checkmark.circle.fill" size={20} color={accent} />
    ) : (
      <Image systemName="circle" size={20} color={ink} />
    );
    const row = (
      <HStack spacing={9} modifiers={[frame({ height: 30 })]}>
        {mark}
        <Text modifiers={[font({ size: 14 }), foregroundStyle(r.done ? dim : ink), lineLimit(1)]}>{r.title}</Text>
        <Spacer />
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
  const head = [
    <Text key="title" modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(dim)]}>
      오늘 할 루틴
    </Text>,
    <Spacer key="gap" />,
  ];
  if (props.more > 0) {
    head.push(
      <Link key="more" destination={props.routinesUrl}>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(tagInk)]}>{`외 ${props.more}개`}</Text>
      </Link>,
    );
  }
  return (
    <HStack spacing={14} modifiers={[containerBackground(bg, 'widget'), widgetURL(props.home)]}>
      <VStack modifiers={[frame({ width: 132 })]}>{left}</VStack>
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[padding({ horizontal: 12, vertical: 10 }), background(panel, shapes.roundedRectangle({ cornerRadius: 14 }))]}>
        <HStack>{head}</HStack>
        {rows}
        <Spacer />
      </VStack>
    </HStack>
  );
};

export default createWidget<WidgetProps>(IOS_WIDGET, BuddyWidget);
