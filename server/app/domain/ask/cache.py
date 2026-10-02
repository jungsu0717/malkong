"""같은 clientMessageId 의 응답을 잠깐 기억한다 — 재시도 안전(api-contract `/v1/ask`).

답에는 아기 기록이 섞일 수 있어서 **메모리에만, 10분만** 둔다. 디스크·DB 에 쓰지 않는다
(backend 「사용량을 세는 법」). 다른 인스턴스로 간 재시도는 다시 생성될 수 있지만
한도는 두 번 깎이지 않는다.
"""

import threading
import time
from collections import OrderedDict

from app.domain.ask.schema import AskResponse

TTL_S = 600
MAX_ENTRIES = 2000


class ResponseCache:
    def __init__(self, ttl_s: float = TTL_S, max_entries: int = MAX_ENTRIES) -> None:
        self._ttl_s = ttl_s
        self._max = max_entries
        self._lock = threading.Lock()
        self._items: OrderedDict[tuple[str, str], tuple[float, AskResponse]] = OrderedDict()

    def get(self, key_hash: str, message_id: str) -> AskResponse | None:
        with self._lock:
            hit = self._items.get((key_hash, message_id))
            if hit is None:
                return None
            at, response = hit
            if time.monotonic() - at > self._ttl_s:
                del self._items[(key_hash, message_id)]
                return None
            return response

    def put(self, key_hash: str, message_id: str, response: AskResponse) -> None:
        with self._lock:
            self._items[(key_hash, message_id)] = (time.monotonic(), response)
            self._items.move_to_end((key_hash, message_id))
            while len(self._items) > self._max:
                self._items.popitem(last=False)
