/**
 * 안드로이드 홈 화면 위젯 그림 (SPEC-MAIN-09, task today/008) — react-native-android-widget 의 FlexWidget · TextWidget · ImageWidget 으로 그린다.
 *
 * 왼쪽은 버디 얼굴 · 태어난 지 며칠 · 이번 주 챙길 일 · 다음 D-day, 오른쪽은 오늘 할 루틴 셋. 좁거나 낮으면 왼쪽만.
 * 루틴 줄을 누르면 작업 처리기(android-widgets.tsx)가 `routine` 을 받아 토글하고, 나머지는 앱의 홈 · 루틴 화면을 연다.
 * 글꼴은 폰의 기본 글꼴 — 위젯은 앱의 글꼴 파일을 못 쓴다.
 */

import { FlexWidget, ImageWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import type { WidgetProps } from '@/data/widget-data';

const FACE = require('@/assets/images/mascot/face.png');

/** 오른쪽 루틴 칸이 들어가는 최소 크기(dp) */
const WIDE = 230;
const TALL = 100;

export function BuddyAndroidWidget({ props, width, height, dark }: { props: WidgetProps; width: number; height: number; dark: boolean }) {
  const ink: ColorProp = dark ? '#F4F4F6' : '#16161A';
  const dim: ColorProp = dark ? '#A0A0AB' : '#5E5E69';
  const accent: ColorProp = dark ? '#E5705E' : '#C64536';
  const bg: ColorProp = dark ? '#1C1C22' : '#FFFFFF';
  const clear: ColorProp = 'rgba(0, 0, 0, 0)';
  const twoColumns = width >= WIDE && height >= TALL;

  const left = (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: props.home }}
      style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
        <ImageWidget image={FACE} imageWidth={28} imageHeight={26} />
        <TextWidget text={props.days || '육아버디'} maxLines={1} style={{ fontSize: 12, color: dim }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', flexGap: 2 }}>
        <TextWidget text={props.headline} maxLines={2} style={{ fontSize: 15, fontWeight: '700', color: ink }} />
        {props.next ? <TextWidget text={props.next} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '600', color: accent }} /> : <FlexWidget />}
      </FlexWidget>
    </FlexWidget>
  );

  const routines =
    props.routines.length === 0
      ? [<TextWidget key="none" text="오늘 할 루틴이 없어요" maxLines={2} style={{ fontSize: 13, color: dim }} />]
      : props.routines.map((r) => (
          <FlexWidget
            key={r.id}
            clickAction={r.tap ? 'routine' : 'OPEN_URI'}
            clickActionData={r.tap ? { id: r.id } : { uri: props.routinesUrl }}
            style={{ flexDirection: 'row', alignItems: 'center', flexGap: 8, paddingVertical: 3 }}>
            <FlexWidget
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: r.done ? accent : ink,
                backgroundColor: r.done ? accent : clear,
              }}
            />
            <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 13, color: r.done ? dim : ink }} />
          </FlexWidget>
        ));

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: bg,
        borderRadius: 20,
        padding: 14,
        flexDirection: 'row',
        flexGap: 14,
      }}>
      {left}
      {twoColumns ? (
        <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', flexGap: 4 }}>
          <TextWidget text="오늘 할 루틴" style={{ fontSize: 11, color: dim }} />
          {routines}
        </FlexWidget>
      ) : (
        <FlexWidget />
      )}
    </FlexWidget>
  );
}
