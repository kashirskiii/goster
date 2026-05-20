from abc import ABC, abstractmethod

from core.models import ParsedDocument, ValidationError


class BaseValidator(ABC):
    """Базовый интерфейс для всех валидаторов."""

    @abstractmethod
    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        """Проверяет документ и возвращает список ошибок."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Человекочитаемое имя валидатора."""
        ...
