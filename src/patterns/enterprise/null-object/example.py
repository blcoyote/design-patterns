from dataclasses import dataclass
from typing import Protocol


# Shared types used by both versions below.
@dataclass
class ReportData:
    rows: list[object]


@dataclass
class Report:
    warnings: list[str]


def build_report(data: ReportData) -> Report:
    return Report(warnings=["low confidence"] if len(data.rows) > 2 else [])


clean_data = ReportData(rows=[1, 2])
data_with_warnings = ReportData(rows=[1, 2, 3])

# ============================================================
# Before: "no logger" is represented by None.
# ============================================================
# [before]
class Logger(Protocol):
    def info(self, msg: str) -> None: ...
    def warn(self, msg: str) -> None: ...
    def error(self, msg: str) -> None: ...


class ReportGeneratorBefore:
    def __init__(self, logger: Logger | None) -> None:
        self._logger = logger

    def generate(self, data: ReportData) -> Report:
        # [guard]
        if self._logger is not None:
            self._logger.info("starting report")
        result = build_report(data)
        if self._logger is not None:
            self._logger.info("report ready")
        # [/guard]

        # [forgotten]
        if len(result.warnings) > 0:
            # forgot the None check every other call site remembered. A type
            # checker (mypy, pyright) would flag this given the `Logger | None`
            # annotation and force a guard here too — exactly the clutter Null
            # Object removes — but nothing stops the code from running, so it crashes.
            self._logger.warn(f"report has {len(result.warnings)} warnings")
        # [/forgotten]

        return result


# Fine on the happy path — the guarded calls just no-op:
ReportGeneratorBefore(None).generate(clean_data)

# Crashes the moment a report has warnings:
try:
    ReportGeneratorBefore(None).generate(data_with_warnings)
except AttributeError:
    print("crashed: nil logger call")
# crashed: nil logger call
# [/before]

# ============================================================
# After: a Null Object stands in for "no logger".
# ============================================================
# [logger]
class Logger(Protocol):
    def info(self, msg: str) -> None: ...
    def warn(self, msg: str) -> None: ...
    def error(self, msg: str) -> None: ...
# [/logger]


# [nullLogger]
class NullLogger:
    def info(self, msg: str) -> None:
        pass

    def warn(self, msg: str) -> None:
        pass

    def error(self, msg: str) -> None:
        pass
# [/nullLogger]


# [consoleLogger]
class ConsoleLogger:
    def info(self, msg: str) -> None:
        print(msg)

    def warn(self, msg: str) -> None:
        print(msg)

    def error(self, msg: str) -> None:
        print(msg)
# [/consoleLogger]


# [reportGenerator]
class ReportGenerator:
    # [holds]
    def __init__(self, logger: Logger | None = None) -> None:
        self._logger: Logger = logger if logger is not None else NullLogger()
    # [/holds]

    # [generate]
    def generate(self, data: ReportData) -> Report:
        self._logger.info("starting report")
        result = build_report(data)
        self._logger.info("report ready")
        if len(result.warnings) > 0:
            self._logger.warn(f"report has {len(result.warnings)} warnings")
        return result
    # [/generate]
# [/reportGenerator]


# [client]
# Usage
quiet = ReportGenerator()  # no logger passed — defaults to NullLogger
quiet.generate(data_with_warnings)  # runs to completion: no guard, no crash, no noise

verbose = ReportGenerator(ConsoleLogger())
verbose.generate(data_with_warnings)  # the exact same generate() — now it actually logs
# [/client]
