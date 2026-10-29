/**
 * 안드로이드 홈 화면 위젯 그림 (SPEC-MAIN-09, task today/008 · 010) — react-native-android-widget 의 FlexWidget · TextWidget · ImageWidget 으로 그린다.
 *
 * 아이폰 위젯(buddy-widget.tsx)과 같은 모양이다. 왼쪽은 「함께한 지」와 큰 숫자, 아래에 다음 아기 일정 이름표와 이름 한 줄, 버디 얼굴은 오른쪽 위에 작게.
 * 오른쪽 회색 칸은 오늘 할 루틴 셋과 「외 N개」. 좁거나 낮으면 왼쪽만.
 * 루틴 줄을 누르면 작업 처리기(android-widgets.tsx)가 `routine` 을 받아 토글하고, 나머지는 앱의 홈 · 루틴 화면을 연다.
 * 글꼴은 폰의 기본 글꼴 — 위젯은 앱의 글꼴 파일을 못 쓴다.
 */

import { FlexWidget, ImageWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import type { WidgetProps } from '@/data/widget-data';

const FACE = require('@/assets/images/mascot/face.png');

/** 오른쪽 루틴 칸이 들어가는 최소 크기(dp) */
const WIDE = 230;
const TALL = 100;
/** 두 칸일 때 왼쪽 너비(dp) */
const LEFT = 132;

export function BuddyAndroidWidget({ props, width, height, dark }: { props: WidgetProps; width: number; height: number; dark: boolean }) {
  const ink: ColorProp = dark ? '#F4F4F6' : '#16161A';
  const dim: ColorProp = dark ? '#A0A0AB' : '#5E5E69';
  const accent: ColorProp = dark ? '#E5705E' : '#C64536';
  const tagBg: ColorProp = dark ? '#3B2623' : '#FCEBE8';
  const tagInk: ColorProp = dark ? '#F29A8A' : '#8F2E23';
  const panel: ColorProp = dark ? '#2A2A31' : '#F4F4F6';
  const bg: ColorProp = dark ? '#1C1C22' : '#FFFFFF';
  const clear: ColorProp = 'rgba(0, 0, 0, 0)';
  const twoColumns = props.dayCount > 0 && width >= WIDE && height >= TALL;
  const root = {
    width: 'match_parent',
    height: 'match_parent',
    backgroundColor: bg,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    flexGap: 14,
  } as const;

  // 생일 전 — 버디와 한 줄
  if (props.dayCount === 0) {
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: props.home }} style={{ ...root, flexDirection: 'column', justifyContent: 'space-between' }}>
        <ImageWidget image={FACE} imageWidth={44} imageHeight={41} />
        <TextWidget text={props.headline} maxLines={2} style={{ fontSize: 15, fontWeight: '700', color: ink }} />
      </FlexWidget>
    );
  }

  const left = (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: props.home }}
      style={{ ...(twoColumns ? { width: LEFT } : { flex: 1 }), height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: 2 }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-start' }}>
          <TextWidget text="함께한 지" style={{ fontSize: 13, fontWeight: '600', color: dim }} />
          <FlexWidget style={{ flex: 1 }} />
          <ImageWidget image={FACE} imageWidth={26} imageHeight={24} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 2 }}>
          <TextWidget text={String(props.dayCount)} maxLines={1} style={{ fontSize: 50, fontWeight: '800', color: ink }} />
          <TextWidget text="일" style={{ fontSize: 22, fontWeight: '700', color: ink, paddingBottom: 8 }} />
        </FlexWidget>
      </FlexWidget>
      {props.nextTitle ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: 5 }}>
          <FlexWidget style={{ backgroundColor: tagBg, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 }}>
            <TextWidget text={props.nextWhen} style={{ fontSize: 12, fontWeight: '700', color: tagInk }} />
          </FlexWidget>
          <TextWidget text={props.nextTitle} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '600', color: ink }} />
        </FlexWidget>
      ) : (
        <FlexWidget />
      )}
    </FlexWidget>
  );

  if (!twoColumns) return <FlexWidget style={root}>{left}</FlexWidget>;

  const routines =
    props.routines.length === 0
      ? [<TextWidget key="none" text="오늘 할 루틴이 없어요" maxLines={2} style={{ fontSize: 13, color: dim }} />]
      : props.routines.map((r) => (
          <FlexWidget
            key={r.id}
            clickAction={r.tap ? 'routine' : 'OPEN_URI'}
            clickActionData={r.tap ? { id: r.id } : { uri: props.routinesUrl }}
            style={{ width: 'match_parent', height: 30, flexDirection: 'row', alignItems: 'center', flexGap: 9 }}>
            <FlexWidget
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: r.done ? accent : ink,
                backgroundColor: r.done ? accent : clear,
              }}
            />
            <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 14, color: r.done ? dim : ink }} />
          </FlexWidget>
        ));

  return (
    <FlexWidget style={root}>
      {left}
      <FlexWidget
        style={{
          flex: 1,
          height: 'match_parent',
          backgroundColor: panel,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'column',
          flexGap: 4,
        }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text="오늘 할 루틴" style={{ fontSize: 12, fontWeight: '600', color: dim }} />
          <FlexWidget style={{ flex: 1 }} />
          {props.more > 0 ? (
            <TextWidget
              text={`외 ${props.more}개`}
              clickAction="OPEN_URI"
              clickActionData={{ uri: props.routinesUrl }}
              style={{ fontSize: 12, fontWeight: '700', color: tagInk }}
            />
          ) : (
            <FlexWidget />
          )}
        </FlexWidget>
        {routines}
      </FlexWidget>
    </FlexWidget>
  );
}
