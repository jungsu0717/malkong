/**
 * 「챙길 것」 한 줄 — 브리핑 카드와 우리 아기 탭의 일정이 같은 모양을 쓴다 (SPEC-HOME-02 · 06).
 * 다가오는 일정은 D-day, 지금·놓친 것은 「완료」(생활 항목은 「확인」) 단추. 끝난 줄은 흐리게.
 */

import { ThemedText } from '@/components/themed-text';
import { Button, ListRow, type IconName } from '@/components/ui';
import { whenText, type BriefingTodo } from '@/data/briefing';
import { useTheme } from '@/hooks/use-theme';

const ICONS: Record<string, IconName> = {
  접종: 'medkit-outline',
  검진: 'clipboard-outline',
  수면: 'moon-outline',
  수유: 'nutrition-outline',
  안전: 'shield-checkmark-outline',
  생활: 'happy-outline',
  발달: 'footsteps-outline',
};

export function TodoRow({
  todo,
  birthDate,
  currentMonth,
  done = false,
  divider = false,
  onPick,
}: {
  todo: BriefingTodo;
  birthDate: string;
  currentMonth: number;
  done?: boolean;
  divider?: boolean;
  onPick: () => void;
}) {
  const c = useTheme();
  const when = whenText(todo, birthDate, currentMonth);
  const verb = todo.life ? '확인' : '완료';
  const missed = todo.status === 'missed' && !done;
  return (
    <ListRow
      divider={divider}
      icon={done ? 'checkmark' : (ICONS[todo.category] ?? 'ellipse-outline')}
      iconTone={todo.status === 'soon' && !done ? 'accent' : 'neutral'}
      title={todo.label}
      detail={done ? `${verb}했어요` : when.text}
      muted={done}
      // 단추가 있는 줄은 단추만 누른다 — 줄 전체까지 누르게 하면 웹에서 단추 안에 단추가 된다
      onPress={done || when.dday === null ? undefined : onPick}
      right={
        done ? null : when.dday !== null ? (
          <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
            {when.dday === 0 ? '오늘' : `D-${when.dday}`}
          </ThemedText>
        ) : (
          <Button label={missed ? '했어요' : verb} size="sm" variant="secondary" onPress={onPick} />
        )
      }
    />
  );
}
