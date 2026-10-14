"""모든 도메인이 함께 쓰는 모형의 바탕.

JSON 필드는 api-contract 대로 camelCase 이고(clientMessageId, recordLabel), 파이썬 쪽 이름은
snake_case 다. 도메인 schema 는 ApiModel 을 상속해 이 변환을 따로 적지 않는다.
"""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints
from pydantic.alias_generators import to_camel

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
    )
