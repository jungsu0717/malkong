/**
 * 브리핑 안부에 칩으로 답하기 (SPEC-HOME-06 답, task home/008) — 대화 속 요약과 일정 탭의 브리핑 카드가 같이 쓴다.
 *
 * 아기 안부: 답을 브리핑에 적고, 아기에 관한 답은 기록 한 줄(「10월 5일 발열: 내렸어요」)로 남긴다 — 다음 날 같은 일을
 * 다시 묻지 않게(care-signals 가 이 기록을 끝난 일로 센다). 걱정되는 답은 입력창에 담아 버디 탭으로 — 보내면 위험 신호 규칙을 거친다.
 * 부모 안부: 답을 브리핑에 적고 버디가 한 마디 답한다. 아기 기록이 아니라 기록하지 않는다. 모델을 부르지 않는다.
 */

import { router } from 'expo-router';

import { tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import type { CareOption, ParentOption } from '@/data/care-signals';
import type { MalkongMessage } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useDraft } from '@/data/draft-context';
import { monthDay } from '@/data/quick-ask';
import { useRecords } from '@/data/records-context';

export function useBriefingAnswer() {
  const { age } = useBaby();
  const { updateMeta } = useChat();
  const { add } = useRecords();
  const { setDraft, requestFocus } = useDraft();

  const answerCare = async (message: MalkongMessage, option: CareOption) => {
    if (message.meta.type !== 'briefing' || !message.meta.care || message.meta.care.answer) return;
    tap('success');
    await updateMeta(message.id, { ...message.meta, care: { ...message.meta.care, answer: option.label } });
    if (option.record) {
      await add({
        kind: '기록',
        label: `${monthDay(new Date())} ${option.record}`,
        covers: [],
        whenLabel: age ? `D+${age.days}에 알림` : null,
      });
    }
    if (option.prefill) {
      setDraft(option.prefill);
      requestFocus();
      router.navigate('/');
    }
  };

  const answerParent = async (message: MalkongMessage, option: ParentOption) => {
    if (message.meta.type !== 'briefing' || !message.meta.parent || message.meta.parent.answer) return;
    tap('success');
    await updateMeta(message.id, { ...message.meta, parent: { ...message.meta.parent, answer: option.label } });
  };

  return { answerCare, answerParent };
}
