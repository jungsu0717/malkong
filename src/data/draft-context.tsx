/**
 * 말콩 탭 입력창의 글 — 다른 탭에서 말머리를 담아 보낼 수 있게 한곳에 둔다
 * (SPEC-BABY-04 「알려 주기」, 브리핑의 상태 확인). 바로 보내지 않고 담기만 한다.
 */

import { createContext, useContext, useMemo, useState } from 'react';

type DraftValue = {
  draft: string;
  setDraft: (text: string) => void;
  /** 담은 뒤 입력창에 커서를 둘지 — 말콩 탭이 보이면 한 번 쓰고 지운다 */
  focusRequest: number;
  requestFocus: () => void;
};

const DraftContext = createContext<DraftValue | null>(null);

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const value = useMemo(
    () => ({ draft, setDraft, focusRequest, requestFocus: () => setFocusRequest((n) => n + 1) }),
    [draft, focusRequest],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error('useDraft 는 DraftProvider 안에서만 쓸 수 있어요');
  return value;
}
