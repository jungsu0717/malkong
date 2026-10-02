"""답변 피드백 서비스 (SPEC-ASK-06) — 기기 키와 떼어 저장한다."""

import hashlib
import threading
from collections import defaultdict
from datetime import UTC, date, datetime
from http import HTTPStatus

from app.common.core.exception import ApiException
from app.domain.entitlements.service import Device
from app.domain.feedback.schema import FeedbackRequest
from app.infra.db.feedback_store import FeedbackRow, FeedbackStore
from app.infra.db.usage_store import StoreError

# 같은 기기에서 하루에 받는 피드백 수 — 장난으로 표를 채우지 못하게. 메모리에서만 센다
MAX_PER_DEVICE_PER_DAY = 50


class FeedbackService:
    def __init__(self, store: FeedbackStore) -> None:
        self._store = store
        self._lock = threading.Lock()
        self._counts: dict[tuple[str, date], int] = defaultdict(int)
        self._purged_on: date | None = None

    def save(self, device: Device, req: FeedbackRequest, today: date) -> None:
        with self._lock:
            for stale in [k for k in self._counts if k[1] != today]:
                del self._counts[stale]
            slot = (device.key_hash, today)
            if self._counts[slot] >= MAX_PER_DEVICE_PER_DAY:
                raise ApiException(
                    HTTPStatus.TOO_MANY_REQUESTS,
                    "TOO_MANY_FEEDBACK",
                    "오늘은 의견을 더 받을 수 없어요",
                )
            self._counts[slot] += 1

        shared = req.shared
        row = FeedbackRow(
            # 앱의 말풍선 id 를 그대로 두지 않는다 — 같은 답의 피드백을 하나로 묶는 데만 쓴다
            answer_id_hash=hashlib.sha256(req.answer_id.encode()).hexdigest(),
            rating=req.rating,
            comment=(req.comment or "").strip() or None,
            level=req.answer.level,
            source_ids=req.answer.source_ids,
            eco=req.answer.eco,
            shared_question=(shared.question or "").strip() or None if shared else None,
            shared_answer=(shared.answer or "").strip() or None if shared else None,
        )
        try:
            self._store.save(row)
            if self._purged_on != today:
                self._purged_on = today
                self._store.purge(datetime.now(UTC))
        except StoreError:
            raise ApiException(
                HTTPStatus.SERVICE_UNAVAILABLE, "STORE_UNAVAILABLE", "잠시 뒤에 다시 시도해 주세요"
            ) from None
