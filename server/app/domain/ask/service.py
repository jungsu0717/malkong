"""ask 서비스 — 질문에 어떤 답을 낼지 정한다.

지금은 목업이다. 질문과 상관없이 같은 답을 돌려준다. common/004 에서 이 자리에 라우팅
(① 위험 신호 규칙 ② 캐시 ③ 모델), L1 검색, 한도가 들어온다.
"""

from app.domain.ask.schema import AnswerResponse, AskRequest, AskResponse, Source, Usage

# 답 문장은 승인된 L1 항목 k-vacc-0401 의 내용만 옮기고, 출처도 그 항목의 것을 붙인다.
# L1 JSON(src/data/l1/)을 서버가 직접 읽는 것은 L1 검색을 넣을 때 한다.
MOCK_ANSWER = (
    "서버 연결을 시험하는 고정 답변이에요. 생후 4개월에는 DTaP 2차 접종이 있고, 3차는 6개월이에요."
)
MOCK_SOURCE = Source(
    id="k-vacc-0401",
    name="질병관리청 예방접종도우미",
    url="https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=115",
)
MOCK_REMAINING = 9


class AskService:
    def ask(self, req: AskRequest) -> AskResponse:
        return AnswerResponse(
            answer=MOCK_ANSWER,
            sources=[MOCK_SOURCE],
            usage=Usage(remaining=MOCK_REMAINING),
            eco=req.mode == "eco",
        )
