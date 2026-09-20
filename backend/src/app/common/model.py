"""
Shared Pydantic base for API models. Field names are snake_case (matching DB
columns 1:1); `alias_generator` serializes them as camelCase in JSON, matching
the frontend's existing contract. Every feature's models.py builds on this.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
