from dataclasses import dataclass, field
from pathlib import Path

from core.interfaces import BaseValidator
from core.models import ParsedDocument, Severity, ValidationError
from core.parser import PDFParser


@dataclass
class CheckResult:
    validator_name: str
    issues: list[ValidationError] = field(default_factory=list)

    @property
    def errors(self) -> list[ValidationError]:
        return [e for e in self.issues if e.severity == Severity.ERROR]

    @property
    def warnings(self) -> list[ValidationError]:
        return [e for e in self.issues if e.severity == Severity.WARNING]

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


@dataclass
class ValidationReport:
    document_path: str
    page_count: int
    checks: list[CheckResult] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return all(c.is_valid for c in self.checks)

    def summary(self) -> str:
        lines: list[str] = []
        lines.append(f"Документ: {self.document_path}  •  {self.page_count} стр.")
        lines.append("")
        lines.append("Проверки:")

        for check in self.checks:
            n_err = len(check.errors)
            n_warn = len(check.warnings)

            if n_err == 0 and n_warn == 0:
                mark, status = "✓", "OK"
            elif n_err == 0:
                mark = "⚠"
                status = _plural(n_warn, "предупреждение", "предупреждения", "предупреждений")
            else:
                mark = "✗"
                parts = [_plural(n_err, "ошибка", "ошибки", "ошибок")]
                if n_warn:
                    parts.append(_plural(n_warn, "предупреждение", "предупреждения", "предупреждений"))
                status = ", ".join(parts)

            lines.append(f"  {mark}  {check.validator_name:<30} {status}")

        notable = [c for c in self.checks if c.errors or c.warnings]
        for check in notable:
            lines.append("")
            lines.append("─" * 54)
            header_parts = []
            if check.errors:
                header_parts.append(_plural(len(check.errors), "ошибка", "ошибки", "ошибок"))
            if check.warnings:
                header_parts.append(_plural(len(check.warnings), "предупреждение", "предупреждения", "предупреждений"))
            lines.append(f"{check.validator_name} — {', '.join(header_parts)}:")
            for issue in check.issues:
                lines.append(f"  {issue}")

        return "\n".join(lines)


def _plural(n: int, one: str, few: str, many: str) -> str:
    if 11 <= n % 100 <= 19:
        return f"{n} {many}"
    r = n % 10
    if r == 1:
        return f"{n} {one}"
    if 2 <= r <= 4:
        return f"{n} {few}"
    return f"{n} {many}"


class ValidationService:
    def __init__(self, validators: list[BaseValidator]) -> None:
        self._validators = validators
        self._parser = PDFParser()

    def validate(self, pdf_path: str | Path) -> ValidationReport:
        document: ParsedDocument = self._parser.parse(pdf_path)
        report = ValidationReport(
            document_path=str(pdf_path),
            page_count=document.page_count,
        )
        for validator in self._validators:
            report.checks.append(CheckResult(
                validator_name=validator.name,
                issues=validator.validate(document),
            ))
        return report
