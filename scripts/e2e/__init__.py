"""Hikari E2E Testing Framework - Python-based visual regression testing powered by Tairitsu MCP."""

from .browser import TairitsuBrowser
from .compare import ScreenshotComparator, ComparisonResult
from .baseline import BaselineManager, BaselineMeta
from .runner import E2ERunner, SuiteResult, TestResult
from .report import ReportGenerator

__version__ = "2.0.0"
__all__ = [
    "TairitsuBrowser",
    "ScreenshotComparator",
    "ComparisonResult",
    "BaselineManager",
    "BaselineMeta",
    "E2ERunner",
    "SuiteResult",
    "TestResult",
    "ReportGenerator",
]
