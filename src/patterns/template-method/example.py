import re
from abc import ABC, abstractmethod


# [reportGenerator]
class ReportGenerator(ABC):
    def __init__(self, records: list[str]) -> None:
        self._records = records

    # [generate]
    # The template method — fixed skeleton. By convention never overridden;
    # Python has no `final` keyword to enforce that (Java's `final`, or
    # C#'s methods being non-virtual by default, would).
    def generate(self) -> str:
        rows = self._fetch_data()
        formatted = self._format_data(rows)
        return self._export_data(formatted)
    # [/generate]

    # [fetch]
    # Concrete step — implemented once here and inherited unmodified by
    # every subclass; nothing below overrides it.
    def _fetch_data(self) -> list[str]:
        return list(self._records)
    # [/fetch]

    # [hook]
    # Hook — an optional extension point; the default is a safe no-op.
    def _format_data(self, rows: list[str]) -> list[str]:
        return rows
    # [/hook]

    # Abstract primitive operation — every subclass must supply its own export format.
    @abstractmethod
    def _export_data(self, rows: list[str]) -> str: ...
# [/reportGenerator]


# [csvReport]
class CsvReportGenerator(ReportGenerator):
    def __init__(self) -> None:
        super().__init__(["id,name,total", "1,Widget,42.00", "2,Gadget,17.50"])

    # _fetch_data() and _format_data() are not overridden — both base-class
    # implementations above (one concrete, one a hook) run unchanged.

    # [csvExport]
    def _export_data(self, rows: list[str]) -> str:
        return "\n".join(rows)
    # [/csvExport]
# [/csvReport]


# [pdfReport]
class PdfReportGenerator(ReportGenerator):
    def __init__(self) -> None:
        # Deliberately messy — the extra spaces are what _format_data() below cleans up.
        super().__init__(["  Invoice   #1042  ", "  Total   due:    $59.50  "])

    # [pdfHook]
    # Overrides the hook to compress whitespace before export.
    def _format_data(self, rows: list[str]) -> list[str]:
        return [re.sub(r"\s+", " ", r.strip()) for r in rows]
    # [/pdfHook]

    # [pdfExport]
    def _export_data(self, rows: list[str]) -> str:
        return "%PDF-1.4\n" + "\n".join(rows)
    # [/pdfExport]
# [/pdfReport]


# Usage
# [usage]
csv: ReportGenerator = CsvReportGenerator()
csv.generate()  # "id,name,total\n1,Widget,42.00\n2,Gadget,17.50"

pdf: ReportGenerator = PdfReportGenerator()
pdf.generate()  # "%PDF-1.4\nInvoice #1042\nTotal due: $59.50"
# [/usage]
